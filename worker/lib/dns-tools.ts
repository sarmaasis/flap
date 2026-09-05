import { Hono } from "hono";
import { requireUser } from "./auth";
import { nowMs, randomId } from "./ids";
import { flapMxSummary, isFlapMx, isFlapSpf } from "./mail-provider";
import { checkDomainSetup, classifyMx, loadDomain } from "./domain-readiness";
import { afterDnsVerified } from "./activation";
import { trackServerEvent } from "./analytics";

type App = { Bindings: Env };

const DOMAIN_RE = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

type DnsAnswer = { name: string; type: number; TTL?: number; data: string };

async function dohQuery(name: string, type: string): Promise<{ Status: number; Answer?: DnsAnswer[]; Authority?: DnsAnswer[] }> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/dns-json" },
    signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(8_000)
      : undefined,
  });
  if (!res.ok) throw new Error(`DNS lookup failed (${res.status})`);
  return (await res.json()) as { Status: number; Answer?: DnsAnswer[]; Authority?: DnsAnswer[] };
}

async function rateLimitDns(db: D1Database, ip: string, tool: string, domain: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(ip || "unknown"));
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  const since = nowMs() - 60_000;
  const count = await db
    .prepare("SELECT COUNT(*) AS n FROM dns_check_log WHERE ip_hash = ? AND created_at > ?")
    .bind(hash, since)
    .first<{ n: number }>();
  if (Number(count?.n ?? 0) >= 30) return false;
  await db
    .prepare("INSERT INTO dns_check_log (id, ip_hash, tool, domain, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(randomId("dns"), hash, tool, domain.slice(0, 253), nowMs())
    .run();
  return true;
}

function normalizeDomainInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

function txtValues(answers: DnsAnswer[] | undefined): string[] {
  return (answers ?? [])
    .filter((a) => a.type === 16)
    .map((a) => a.data.replace(/^"|"$/g, "").replace(/" "/g, ""));
}

function parseMxRecords(answers: DnsAnswer[] | undefined) {
  return (answers ?? [])
    .filter((a) => a.type === 15)
    .map((a) => {
      const parts = a.data.trim().split(/\s+/);
      const priority = Number(parts[0]);
      const exchange = (parts.slice(1).join(" ") || "").replace(/\.$/, "");
      return { priority: Number.isFinite(priority) ? priority : 0, exchange };
    })
    .sort((a, b) => a.priority - b.priority);
}

export function registerDnsToolRoutes(app: Hono<App>) {
  app.post("/api/tools/dns-check", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { domain?: string; tool?: string; selector?: string };
    const tool = (body.tool || "mx").toLowerCase();
    if (!["mx", "spf", "dmarc", "dkim", "setup"].includes(tool)) {
      return c.json({ error: "Unknown tool. Use mx, spf, dmarc, dkim, or setup." }, 400);
    }
    const domain = normalizeDomainInput(body.domain || "");
    if (!DOMAIN_RE.test(domain)) return c.json({ error: "Enter a valid domain name." }, 400);

    const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() || "unknown";
    const allowed = await rateLimitDns(c.env.DB, ip, tool, domain).catch(() => true);
    if (!allowed) return c.json({ error: "Too many DNS checks. Try again in a minute." }, 429);

    try {
      if (tool === "mx") {
        const data = await dohQuery(domain, "MX");
        const records = parseMxRecords(data.Answer);
        let hasSes = false;
        let hasMailgun = false;
        let hasCf = false;
        for (const r of records) {
          const c = classifyMx(r.exchange);
          hasSes ||= c.ses;
          hasMailgun ||= c.mailgun;
          hasCf ||= c.cf;
        }
        const flapReady = records.some((r) => isFlapMx(r.exchange));
        const ok = records.length > 0;
        return c.json({
          tool,
          domain,
          ok,
          status: ok ? (flapReady ? "valid_flap_ready" : "valid") : "invalid",
          summary: ok
            ? flapMxSummary(hasSes, hasMailgun, hasCf)
            : "No MX records found. Mail cannot be delivered to this domain yet.",
          records,
          raw: data.Answer ?? [],
        });
      }

      if (tool === "spf") {
        const data = await dohQuery(domain, "TXT");
        const texts = txtValues(data.Answer);
        const spf = texts.filter((t) => /^v=spf1\b/i.test(t));
        const includesFlap = spf.some((t) => isFlapSpf(t));
        const ok = spf.length > 0;
        return c.json({
          tool,
          domain,
          ok,
          status: !ok ? "invalid" : includesFlap ? "valid_flap_ready" : "partial",
          summary: !ok
            ? "No SPF TXT record found. Add an SPF record so receivers know who may send as this domain."
            : includesFlap
              ? "SPF includes Flap’s mail provider (Amazon SES include:amazonses.com, or legacy Mailgun/Cloudflare)."
              : "We found your SPF record, but it does not yet include Flap (include:amazonses.com).",
          records: spf,
          raw: texts,
        });
      }

      if (tool === "dmarc") {
        const data = await dohQuery(`_dmarc.${domain}`, "TXT");
        const texts = txtValues(data.Answer);
        const dmarc = texts.filter((t) => /^v=DMARC1\b/i.test(t));
        const ok = dmarc.length > 0;
        return c.json({
          tool,
          domain,
          ok,
          status: ok ? "valid" : "invalid",
          summary: ok
            ? "DMARC policy found. Review the policy (p=) matches how strict you want failing mail handled."
            : "No DMARC record at _dmarc." + domain + ". Add one to publish a policy for spoofed mail.",
          records: dmarc,
          raw: texts,
        });
      }

      if (tool === "dkim") {
        const selector = (body.selector || "").trim().replace(/[^a-z0-9._-]/gi, "");
        // SES Easy DKIM uses token CNAMEs; Mailgun often used smtp.
        const candidates = selector
          ? [`${selector}._domainkey.${domain}`]
          : [`smtp._domainkey.${domain}`, `_amazonses.${domain}`];
        const results: string[] = [];
        for (const name of candidates) {
          const [txt, cname] = await Promise.all([dohQuery(name, "TXT"), dohQuery(name, "CNAME")]);
          const texts = txtValues(txt.Answer);
          const cnames = (cname.Answer ?? [])
            .filter((a) => a.type === 5)
            .map((a) => a.data.replace(/\.$/, ""));
          if (texts.some((t) => /v=DKIM1|p=/i.test(t)) || cnames.length > 0 || texts.length > 0) {
            results.push(...(texts.length ? texts : cnames));
          }
        }
        const ok = results.length > 0;
        return c.json({
          tool,
          domain,
          selector: selector || "auto",
          ok,
          status: ok ? "valid" : "invalid",
          summary: ok
            ? "DKIM / SES verification records found."
            : "No DKIM CNAME or SES verification TXT found. Copy exact values from Flap Settings → Setup.",
          records: results,
          raw: results,
        });
      }

      // setup — combined
      const [mx, spf, dmarc, ns] = await Promise.all([
        dohQuery(domain, "MX"),
        dohQuery(domain, "TXT"),
        dohQuery(`_dmarc.${domain}`, "TXT"),
        dohQuery(domain, "NS"),
      ]);
      const mxParsed = parseMxRecords(mx.Answer);
      const mxRecords = mxParsed.map((r) => `${r.priority} ${r.exchange}`);
      const spfRecords = txtValues(spf.Answer).filter((t) => /^v=spf1\b/i.test(t));
      const dmarcRecords = txtValues(dmarc.Answer).filter((t) => /^v=DMARC1\b/i.test(t));
      const nameservers = (ns.Answer ?? [])
        .filter((a) => a.type === 2)
        .map((a) => a.data.replace(/\.$/, "").toLowerCase());
      const provider = detectDnsProvider(nameservers);
      const mxOk = mxParsed.length > 0;
      const mxFlap = mxParsed.some((r) => isFlapMx(r.exchange));
      const spfOk = spfRecords.some((t) => isFlapSpf(t));
      return c.json({
        tool: "setup",
        domain,
        ok: mxOk && mxFlap && spfOk,
        status: mxOk && mxFlap && spfOk ? "valid_flap_ready" : "partial",
        provider,
        nameservers,
        checks: {
          mx: { ok: mxOk, flap_ready: mxFlap, records: mxRecords },
          spf: { ok: spfRecords.length > 0, flap_ready: spfOk, records: spfRecords },
          dmarc: { ok: dmarcRecords.length > 0, records: dmarcRecords },
        },
        summary:
          mxOk && mxFlap && spfOk
            ? "DNS looks ready for Flap (Amazon SES MX + SPF, or legacy Mailgun/Cloudflare)."
            : "Some required records are missing or not yet pointing at Flap (Amazon SES).",
        guide_path:
          provider === "cloudflare"
            ? "/guides/cloudflare-custom-domain-email"
            : providerGuide(provider),
      });
    } catch (err) {
      console.error("DNS tool error", err);
      return c.json({
        error: err instanceof Error && err.name === "TimeoutError"
          ? "DNS lookup timed out. Try again in a moment."
          : "DNS lookup failed. Check the domain and try again.",
      }, 502);
    }
  });

  /** Authenticated domain setup check — SES identity + DNS + receipt readiness. */
  app.get("/api/domains/:id/dns-status", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const domain = await loadDomain(c.env.DB, c.req.param("id"));
    if (!domain) return c.json({ error: "Domain not found." }, 404);

    const member = await c.env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
    )
      .bind(domain.user_id, user.id)
      .first<{ role: string }>();
    if (!member && domain.user_id !== user.id) {
      return c.json({ error: "Domain not found." }, 404);
    }

    try {
      await trackServerEvent(c.env.DB, "domain_check_started", {
        userId: domain.user_id,
        props: { domain: domain.name },
      });
      const report = await checkDomainSetup(c.env, domain, {
        dnsProviderDetect: detectDnsProvider,
        guidePath: (p) => (p === "cloudflare" ? "/guides/cloudflare-custom-domain-email" : providerGuide(p)),
      });

      if (report.verified) {
        await afterDnsVerified(c.env.DB, domain.user_id, domain.name).catch(() => undefined);
      }

      return c.json({
        domain: report.domain,
        provider: report.dns_provider,
        mail_provider: report.provider,
        region: report.region,
        lifecycle: report.lifecycle,
        receiving: report.receiving,
        sending: report.sending,
        mx_ok: report.receiving.mx_configured,
        spf_ok: report.records.spf.some((t) => isFlapSpf(t, report.provider)),
        verified: report.verified,
        issues: report.issues,
        guide_path: report.guide_path,
        nameservers: report.nameservers,
        records: report.records,
        identity_status: report.identity_status,
        dkim_status: report.dkim_status,
      });
    } catch (err) {
      return c.json({
        error: err instanceof Error ? err.message : "DNS check failed.",
        verified: false,
      }, 502);
    }
  });
}

export function detectDnsProvider(nameservers: string[]): string {
  const joined = nameservers.join(" ");
  if (/cloudflare\.com/i.test(joined)) return "cloudflare";
  if (/domaincontrol\.com|godaddy/i.test(joined)) return "godaddy";
  if (/registrar-servers\.com|namecheap/i.test(joined)) return "namecheap";
  if (/porkbun\.com/i.test(joined)) return "porkbun";
  if (/awsdns/i.test(joined)) return "route53";
  if (/squarespace|domaincontrol/i.test(joined)) return "squarespace";
  if (/vercel-dns/i.test(joined)) return "vercel";
  return "unknown";
}

function providerGuide(provider: string): string | null {
  if (provider === "namecheap") return "/guides/namecheap-custom-domain-email";
  if (provider === "porkbun") return "/guides/porkbun-custom-domain-email";
  if (provider === "godaddy") return "/guides/godaddy-custom-domain-email";
  if (provider === "route53") return "/guides/route53-custom-domain-email";
  if (provider === "squarespace") return "/guides/squarespace-custom-domain-email";
  if (provider === "vercel") return "/guides/vercel-custom-domain-email";
  return null;
}
