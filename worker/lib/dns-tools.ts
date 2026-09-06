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
    const ALLOWED = [
      "mx","spf","dmarc","dkim","setup","bimi","mta-sts","ptr","ns","propagation","rbl","catchall","scorecard","smtp-banner"
    ];
    if (!ALLOWED.includes(tool)) {
      return c.json({ error: "Unknown tool." }, 400);
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


      if (tool === "bimi") {
        const data = await dohQuery(`default._bimi.${domain}`, "TXT");
        const texts = txtValues(data.Answer);
        const bimi = texts.filter((t) => /v=BIMI1/i.test(t));
        return c.json({
          tool, domain, ok: bimi.length > 0, status: bimi.length ? "valid" : "invalid",
          summary: bimi.length ? "BIMI TXT found at default._bimi." : "No BIMI record. Publish default._bimi TXT after DMARC enforcement.",
          records: bimi, raw: texts,
        });
      }

      if (tool === "mta-sts") {
        const [sts, tls] = await Promise.all([
          dohQuery(`_mta-sts.${domain}`, "TXT"),
          dohQuery(`_smtp._tls.${domain}`, "TXT"),
        ]);
        const stsTxt = txtValues(sts.Answer).filter((t) => /v=STSv1/i.test(t));
        const tlsTxt = txtValues(tls.Answer).filter((t) => /v=TLSRPTv1/i.test(t));
        return c.json({
          tool, domain,
          ok: stsTxt.length > 0,
          status: stsTxt.length && tlsTxt.length ? "valid" : stsTxt.length ? "partial" : "invalid",
          summary: stsTxt.length
            ? "MTA-STS TXT present. Also host https://mta-sts." + domain + "/.well-known/mta-sts.txt"
            : "No _mta-sts TXT. Add STSv1 policy id and host the policy file.",
          records: { mta_sts: stsTxt, tlsrpt: tlsTxt },
        });
      }

      if (tool === "ptr") {
        const ip = domain; // allow IP in domain field for PTR
        const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
        if (!isIp) {
          // resolve A then PTR
          const a = await dohQuery(domain, "A");
          const addrs = (a.Answer ?? []).filter((x) => x.type === 1).map((x) => x.data);
          if (!addrs.length) return c.json({ tool, domain, ok: false, status: "invalid", summary: "No A record to reverse-lookup.", records: [] });
          const first = addrs[0];
          const rev = first.split(".").reverse().join(".") + ".in-addr.arpa";
          const ptr = await dohQuery(rev, "PTR");
          const names = (ptr.Answer ?? []).filter((x) => x.type === 12).map((x) => x.data.replace(/\.$/, ""));
          return c.json({ tool, domain, ok: names.length > 0, status: names.length ? "valid" : "invalid", summary: names.length ? `PTR for ${first}: ${names.join(", ")}` : `No PTR for ${first}.`, records: names, ip: first });
        }
        const rev = ip.split(".").reverse().join(".") + ".in-addr.arpa";
        const ptr = await dohQuery(rev, "PTR");
        const names = (ptr.Answer ?? []).filter((x) => x.type === 12).map((x) => x.data.replace(/\.$/, ""));
        return c.json({ tool, domain: ip, ok: names.length > 0, status: names.length ? "valid" : "invalid", summary: names.length ? `PTR: ${names.join(", ")}` : "No PTR found.", records: names });
      }

      if (tool === "ns") {
        const ns = await dohQuery(domain, "NS");
        const nameservers = (ns.Answer ?? []).filter((a) => a.type === 2).map((a) => a.data.replace(/\.$/, "").toLowerCase());
        const provider = detectDnsProvider(nameservers);
        return c.json({
          tool, domain, ok: nameservers.length > 0, status: nameservers.length ? "valid" : "invalid",
          summary: nameservers.length ? `Nameservers via ${provider}.` : "No NS records.",
          records: nameservers, provider, whois_hint: `https://who.is/whois/${domain}`,
        });
      }

      if (tool === "propagation") {
        const resolvers = [
          { name: "cloudflare", url: "https://cloudflare-dns.com/dns-query" },
          { name: "google", url: "https://dns.google/resolve" },
        ];
        const results = [];
        for (const r of resolvers) {
          const url = `${r.url}?name=${encodeURIComponent(domain)}&type=MX`;
          const res = await fetch(url, { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(8000) });
          const data = await res.json() as { Answer?: DnsAnswer[] };
          results.push({ resolver: r.name, mx: parseMxRecords(data.Answer) });
        }
        const same = JSON.stringify(results[0]?.mx) === JSON.stringify(results[1]?.mx);
        return c.json({
          tool, domain, ok: true, status: same ? "valid" : "partial",
          summary: same ? "MX looks consistent across Cloudflare and Google resolvers." : "MX differs between resolvers — propagation in progress.",
          records: results,
        });
      }

      if (tool === "rbl") {
        const a = await dohQuery(domain, "A");
        const ips = (a.Answer ?? []).filter((x) => x.type === 1).map((x) => x.data);
        if (!ips.length) return c.json({ tool, domain, ok: false, status: "invalid", summary: "No A record to check RBLs against.", records: [] });
        const ip = ips[0];
        const rev = ip.split(".").reverse().join(".");
        const lists = ["zen.spamhaus.org", "bl.spamcop.net", "b.barracudacentral.org"];
        const hits = [];
        for (const list of lists) {
          try {
            const q = await dohQuery(`${rev}.${list}`, "A");
            const listed = (q.Answer ?? []).some((x) => x.type === 1);
            hits.push({ list, listed });
          } catch {
            hits.push({ list, listed: false, error: true });
          }
        }
        const any = hits.some((h) => h.listed);
        return c.json({
          tool, domain, ok: !any, status: any ? "invalid" : "valid",
          summary: any ? `${ip} appears on one or more RBLs.` : `${ip} not listed on checked RBLs (sample).`,
          records: hits, ip,
        });
      }

      if (tool === "catchall") {
        const mx = await dohQuery(domain, "MX");
        const mxParsed = parseMxRecords(mx.Answer);
        return c.json({
          tool, domain, ok: mxParsed.length > 0, status: mxParsed.length ? "partial" : "invalid",
          summary: mxParsed.length
            ? "MX exists. Catch-all cannot be proven from DNS alone. Use Flap plus-address tester or send to a random local-part after MX points at Flap."
            : "No MX — catch-all cannot work yet.",
          records: mxParsed.map((r) => `${r.priority} ${r.exchange}`),
          detector: "dns_hint_only",
        });
      }

      if (tool === "scorecard") {
        const [mx, spf, dmarc] = await Promise.all([
          dohQuery(domain, "MX"),
          dohQuery(domain, "TXT"),
          dohQuery(`_dmarc.${domain}`, "TXT"),
        ]);
        const mxParsed = parseMxRecords(mx.Answer);
        const spfRecords = txtValues(spf.Answer).filter((t) => /^v=spf1\b/i.test(t));
        const dmarcRecords = txtValues(dmarc.Answer).filter((t) => /^v=DMARC1\b/i.test(t));
        let score = 0;
        if (mxParsed.length) score += 30;
        if (mxParsed.some((r) => isFlapMx(r.exchange))) score += 15;
        if (spfRecords.length) score += 25;
        if (spfRecords.some((t) => isFlapSpf(t))) score += 10;
        if (dmarcRecords.length) score += 20;
        const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 55 ? "C" : score >= 35 ? "D" : "F";
        return c.json({
          tool, domain, ok: score >= 55, status: grade, score, grade,
          summary: `Deliverability scorecard ${grade} (${score}/100) based on MX/SPF/DMARC presence.`,
          records: { mx: mxParsed, spf: spfRecords, dmarc: dmarcRecords },
        });
      }

      if (tool === "smtp-banner") {
        return c.json({
          tool, domain, ok: true, status: "partial",
          summary: "Safe SMTP banner probe is limited on Workers (no raw TCP). Use your host's port-25 check or Flap after MX cutover. We never send mail from this tool.",
          records: [],
          safe: true,
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
        recommendations: report.recommendations,
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
