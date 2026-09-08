/**
 * Customer-domain mail transport.
 *
 * Primary (all plans): Amazon SES — identity/DKIM/send from Worker; inbound via
 * SES → S3 → queue → Lambda → POST /api/inbound/ses.
 * System mail (useflap.online): Cloudflare SEB (prefer) / never customer SES config.
 * Legacy: Mailgun webhook + CF Email Routing `email` handler remain for cutover.
 *
 * Important: never send customer-domain mail via SEB. SEB only delivers for
 * Cloudflare Email Routing–verified addresses and will otherwise “succeed”
 * without the recipient ever getting the message.
 */

import {
  defaultSesDnsRecords,
  deleteSesDomain,
  parseStoredSesDns,
  provisionSesDomain,
  sendRawViaSes,
  sesConfigured,
  sesRegion,
} from "./ses";
import { isFlapMxForProvider, isFlapSpfForProvider } from "../../shared/ses-dns";

export type DnsRecordRow = {
  type: string;
  name: string;
  priority?: number;
  value: string;
  purpose?: string;
};

export type MailProviderId = "ses" | "mailgun" | "cloudflare";

export type FlapDnsBundle = {
  provider: MailProviderId;
  note: string;
  mx: Array<{ type: string; name: string; priority: number; value: string }>;
  spf: { type: string; name: string; value: string };
  dkim: Array<{ type: string; name: string; value: string }>;
  /** SES domain verification TXT (_amazonses). */
  verification?: Array<{ type: string; name: string; value: string }>;
  dmarc: { type: string; name: string; value: string };
  /** @deprecated CF Worker rule — empty for SES/Mailgun; kept for API shape. */
  worker_rule: string;
  send_note: string;
  /** Legacy single-DKIM field for older clients. */
  dkim_legacy?: { type: string; name: string; value: string };
  region?: string;
};

const MAILGUN_MX = [
  { host: "mxa.mailgun.org", priority: 10 },
  { host: "mxb.mailgun.org", priority: 10 },
] as const;

export function mailgunConfigured(env: Env): boolean {
  return Boolean((env.MAILGUN_API_KEY || "").trim());
}

export function canSendMail(env: Env): boolean {
  // SEB alone is not enough for customer domains (hello@yourdomain.com).
  return sesConfigured(env) || mailgunConfigured(env) || Boolean(env.SEB);
}

/** True when this From domain can be sent with a real transport. */
export function canSendFromDomain(env: Env, fromAddress: string): boolean {
  const fromDomain = extractAddr(fromAddress).split("@")[1]?.toLowerCase() || "";
  const systemDomain =
    (env.SYSTEM_FROM_EMAIL || "noreply@useflap.online").split("@")[1]?.toLowerCase() || "useflap.online";
  if (fromDomain === systemDomain) return Boolean(env.SEB) || sesConfigured(env) || mailgunConfigured(env);
  return sesConfigured(env) || mailgunConfigured(env);
}

export function mailgunApiBase(env: Env): string {
  const raw = (env.MAILGUN_API_BASE || "https://api.mailgun.net").trim().replace(/\/$/, "");
  return raw || "https://api.mailgun.net";
}

function basicAuth(apiKey: string): string {
  return `Basic ${btoa(`api:${apiKey}`)}`;
}

/** @deprecated Legacy Mailgun template — kept for domains still on mailgun. */
export function defaultMailgunDnsRecords(domain: string): FlapDnsBundle {
  const dkim = [
    {
      type: "TXT",
      name: `smtp._domainkey.${domain}`,
      value:
        "After Flap provisions this domain with Mailgun, replace this with the exact DKIM TXT/CNAME values shown below (or in Settings). Typical selectors are smtp, s1, or s2.",
    },
  ];
  return {
    provider: "mailgun",
    note:
      "Legacy Mailgun DNS. New domains use Amazon SES — see Settings for SES records if this domain is migrating.",
    mx: MAILGUN_MX.map((r) => ({
      type: "MX",
      name: domain,
      priority: r.priority,
      value: r.host,
    })),
    spf: {
      type: "TXT",
      name: domain,
      value: "v=spf1 include:mailgun.org ~all",
    },
    dkim,
    dmarc: {
      type: "TXT",
      name: `_dmarc.${domain}`,
      value: "v=DMARC1; p=none; rua=mailto:dmarc@" + domain,
    },
    worker_rule: "",
    send_note: "Legacy outbound via Mailgun. Prefer migrating to SES (Settings → Setup).",
    dkim_legacy: dkim[0],
  };
}

export function defaultCustomerDnsRecords(domain: string, env?: Env): FlapDnsBundle {
  return defaultSesDnsRecords(domain, env ? sesRegion(env) : "us-east-1");
}

/** Map Mailgun Domains API sending/receiving DNS rows into Flap's UI shape. */
export function dnsBundleFromProviderRecords(
  domain: string,
  records: DnsRecordRow[],
): FlapDnsBundle {
  const base = defaultMailgunDnsRecords(domain);
  const mx = records
    .filter((r) => r.type.toUpperCase() === "MX")
    .map((r) => ({
      type: "MX",
      name: stripTrailingDot(r.name) || domain,
      priority: r.priority ?? 10,
      value: stripTrailingDot(r.value),
    }));
  const spfRow = records.find(
    (r) => r.type.toUpperCase() === "TXT" && /v=spf1/i.test(r.value),
  );
  const dkim = records
    .filter((r) => {
      const t = r.type.toUpperCase();
      const n = r.name.toLowerCase();
      return (t === "TXT" || t === "CNAME") && n.includes("_domainkey");
    })
    .map((r) => ({
      type: r.type.toUpperCase(),
      name: stripTrailingDot(r.name),
      value: stripTrailingDot(r.value),
    }));

  return {
    ...base,
    mx: mx.length ? mx : base.mx,
    spf: spfRow
      ? {
          type: "TXT",
          name: stripTrailingDot(spfRow.name) || domain,
          value: spfRow.value.replace(/^"|"$/g, ""),
        }
      : base.spf,
    dkim: dkim.length ? dkim : base.dkim,
    dkim_legacy: (dkim.length ? dkim : base.dkim)[0],
  };
}

export function isFlapMx(exchange: string, provider?: string | null, region?: string | null): boolean {
  return isFlapMxForProvider(exchange, provider, region);
}

export function isFlapSpf(spf: string, provider?: string | null): boolean {
  return isFlapSpfForProvider(spf, provider);
}

export function flapMxSummary(
  hasSes: boolean,
  hasMailgun: boolean,
  hasCf: boolean,
  expected?: string | null,
): string {
  if (expected === "ses" && hasSes) return "MX points at Amazon SES (Flap inbound).";
  if (expected === "mailgun" && hasMailgun) return "MX points at Mailgun (legacy Flap inbound).";
  if (expected === "cloudflare" && hasCf) return "MX points at Cloudflare Email Routing (legacy).";
  if (hasSes) return "MX points at Amazon SES (Flap inbound).";
  if (hasMailgun) return "MX points at Mailgun (legacy Flap path).";
  if (hasCf) return "MX points at Cloudflare Email Routing (legacy Flap path).";
  return "MX records found, but they do not yet point at Flap (Amazon SES).";
}

type MailgunDnsApiRecord = {
  record_type?: string;
  name?: string;
  value?: string;
  priority?: string | number;
  valid?: string;
};

/** Provision customer domain on SES (all new domains). */
export async function provisionCustomerDomain(
  env: Env,
  domain: string,
): Promise<
  | {
      ok: true;
      dns: FlapDnsBundle;
      state: string;
      provider: "ses";
      region: string;
      identityArn?: string;
    }
  | { ok: false; error: string }
> {
  const result = await provisionSesDomain(env, domain);
  if (!result.ok) return result;
  return {
    ok: true,
    dns: result.dns,
    state: result.state,
    provider: "ses",
    region: result.region,
    identityArn: result.identityArn,
  };
}

/** @deprecated Use provisionCustomerDomain — kept for migration scripts. */
export async function provisionMailgunDomain(
  env: Env,
  domain: string,
  inboundWebhookUrl: string,
): Promise<{ ok: true; dns: FlapDnsBundle; state: string } | { ok: false; error: string }> {
  const key = (env.MAILGUN_API_KEY || "").trim();
  if (!key) {
    return {
      ok: true,
      dns: defaultMailgunDnsRecords(domain),
      state: "pending_manual",
    };
  }

  const base = mailgunApiBase(env);
  const createRes = await fetch(`${base}/v3/domains`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(key),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      name: domain,
      wildcard: "true",
      dkim_host: "smtp",
      dkim_selector: "smtp",
      web_scheme: "https",
    }),
  });

  if (!createRes.ok && createRes.status !== 400) {
    const text = await createRes.text().catch(() => "");
    console.warn("Mailgun domain create failed", createRes.status, text.slice(0, 400));
    return { ok: false, error: "Could not register domain with the mail provider. Try again or contact support." };
  }

  const detailRes = await fetch(`${base}/v3/domains/${encodeURIComponent(domain)}`, {
    headers: { Authorization: basicAuth(key) },
  });
  if (!detailRes.ok) {
    return { ok: false, error: "Domain was registered but DNS details could not be loaded." };
  }
  const detail = (await detailRes.json()) as {
    domain?: { state?: string };
    sending_dns_records?: MailgunDnsApiRecord[];
    receiving_dns_records?: MailgunDnsApiRecord[];
  };

  const rows: DnsRecordRow[] = [];
  for (const r of [...(detail.receiving_dns_records ?? []), ...(detail.sending_dns_records ?? [])]) {
    if (!r.record_type || !r.name || r.value == null) continue;
    rows.push({
      type: r.record_type,
      name: r.name,
      value: String(r.value),
      priority: r.priority != null ? Number(r.priority) : undefined,
    });
  }

  await ensureInboundRoute(env, domain, inboundWebhookUrl).catch((err) =>
    console.warn("Mailgun route ensure failed", err),
  );

  return {
    ok: true,
    dns: dnsBundleFromProviderRecords(domain, rows),
    state: detail.domain?.state || "unverified",
  };
}

async function ensureInboundRoute(env: Env, domain: string, webhookUrl: string): Promise<void> {
  const key = (env.MAILGUN_API_KEY || "").trim();
  if (!key) return;
  const base = mailgunApiBase(env);
  const listRes = await fetch(`${base}/v3/routes?limit=100`, {
    headers: { Authorization: basicAuth(key) },
  });
  if (listRes.ok) {
    const list = (await listRes.json()) as {
      items?: Array<{ id: string; expression?: string; description?: string }>;
    };
    const needle = domain.toLowerCase();
    const existing = (list.items ?? []).find(
      (r) =>
        (r.description || "").includes(`flap:${needle}`) ||
        (r.expression || "").toLowerCase().includes(needle),
    );
    if (existing) return;
  }

  const body = new URLSearchParams();
  body.set("priority", "0");
  body.set("description", `flap:${domain}`);
  body.set("expression", `match_recipient(".*@${domain}")`);
  body.append("action", `store(notify="${webhookUrl}")`);
  body.append("action", "stop()");

  const res = await fetch(`${base}/v3/routes`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(key),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`route create ${res.status}: ${text.slice(0, 200)}`);
  }
}

export async function deleteCustomerDomain(env: Env, domain: string, provider?: string | null): Promise<void> {
  if (provider === "mailgun") {
    await deleteMailgunDomain(env, domain);
    return;
  }
  await deleteSesDomain(env, domain);
  // Also try Mailgun cleanup if dual-provisioned during migration.
  if (provider === "ses" || !provider) {
    await deleteMailgunDomain(env, domain).catch(() => undefined);
  }
}

export async function deleteMailgunDomain(env: Env, domain: string): Promise<void> {
  const key = (env.MAILGUN_API_KEY || "").trim();
  if (!key) return;
  const base = mailgunApiBase(env);
  await fetch(`${base}/v3/domains/${encodeURIComponent(domain)}`, {
    method: "DELETE",
    headers: { Authorization: basicAuth(key) },
  }).catch(() => undefined);
}

/** Send raw MIME via Mailgun for the From domain (legacy). */
export async function sendRawViaMailgun(
  env: Env,
  opts: { from: string; to: string[]; rawMime: string },
): Promise<void> {
  const key = (env.MAILGUN_API_KEY || "").trim();
  if (!key) throw new Error("Mailgun is not configured (MAILGUN_API_KEY).");
  const fromEmail = extractAddr(opts.from);
  const domain = fromEmail.split("@")[1];
  if (!domain) throw new Error("Invalid From address.");
  if (!opts.to.length) throw new Error("No recipients.");

  const form = new FormData();
  form.set("to", opts.to.join(","));
  form.set("message", new Blob([opts.rawMime], { type: "message/rfc822" }), "message.mime");

  const base = mailgunApiBase(env);
  const res = await fetch(`${base}/v3/${encodeURIComponent(domain)}/messages.mime`, {
    method: "POST",
    headers: { Authorization: basicAuth(key) },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mailgun send failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

export type SendRawResult = { provider: "ses" | "mailgun" | "seb"; messageId?: string };

/**
 * System From on useflap.online → SEB when bound.
 * Customer domains → SES when configured (or domain mail_provider=ses); legacy Mailgun otherwise.
 */
export async function sendRawEmail(
  env: Env,
  opts: {
    envelopeFrom: string;
    recipients: string[];
    rawMime: string;
    preferSeb?: boolean;
    mailProvider?: string | null;
  },
): Promise<SendRawResult> {
  const fromDomain = extractAddr(opts.envelopeFrom).split("@")[1]?.toLowerCase() || "";
  const systemDomain =
    (env.SYSTEM_FROM_EMAIL || "noreply@useflap.online").split("@")[1]?.toLowerCase() || "useflap.online";
  const isSystemFrom = fromDomain === systemDomain;
  const useSeb =
    Boolean(env.SEB) &&
    (opts.preferSeb === true || isSystemFrom);

  if (useSeb && env.SEB) {
    const { EmailMessage } = await import("cloudflare:email");
    await Promise.all(
      opts.recipients.map((recipient) =>
        env.SEB!.send(new EmailMessage(opts.envelopeFrom, recipient, opts.rawMime)),
      ),
    );
    return { provider: "seb" };
  }

  const provider = (opts.mailProvider || "ses").toLowerCase();
  const preferSes = provider === "ses" || (!opts.mailProvider && sesConfigured(env));

  if (preferSes && sesConfigured(env) && !isSystemFrom) {
    const sent = await sendRawViaSes(env, {
      from: opts.envelopeFrom,
      to: opts.recipients,
      rawMime: opts.rawMime,
    });
    return { provider: "ses", messageId: sent.messageId };
  }

  if (mailgunConfigured(env) && (provider === "mailgun" || !sesConfigured(env))) {
    await sendRawViaMailgun(env, {
      from: opts.envelopeFrom,
      to: opts.recipients,
      rawMime: opts.rawMime,
    });
    return { provider: "mailgun" };
  }

  if (sesConfigured(env) && !isSystemFrom) {
    const sent = await sendRawViaSes(env, {
      from: opts.envelopeFrom,
      to: opts.recipients,
      rawMime: opts.rawMime,
    });
    return { provider: "ses", messageId: sent.messageId };
  }

  if (isSystemFrom && env.SEB) {
    const { EmailMessage } = await import("cloudflare:email");
    await Promise.all(
      opts.recipients.map((recipient) =>
        env.SEB!.send(new EmailMessage(opts.envelopeFrom, recipient, opts.rawMime)),
      ),
    );
    return { provider: "seb" };
  }

  if (!isSystemFrom && !sesConfigured(env) && !mailgunConfigured(env)) {
    throw new Error(
      "Customer-domain sending needs Amazon SES credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY). Cloudflare Email (SEB) cannot deliver mail from your custom domain.",
    );
  }

  throw new Error("No mail transport configured (Amazon SES credentials, Mailgun API key, or SEB binding for system mail).");
}

/** Verify Mailgun webhook signature (timestamp + token). */
export async function verifyMailgunWebhook(
  env: Env,
  opts: { timestamp: string; token: string; signature: string },
): Promise<boolean> {
  const signingKey = (env.MAILGUN_WEBHOOK_SIGNING_KEY || env.MAILGUN_API_KEY || "").trim();
  if (!signingKey) {
    return (env.MAILGUN_WEBHOOK_ALLOW_UNSIGNED || "").trim() === "true";
  }
  const encoded = new TextEncoder().encode(opts.timestamp + opts.token);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoded);
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(hex, opts.signature.toLowerCase());
}

/** HMAC-SHA256 hex of body for SES Lambda → Worker inbound. */
export async function verifySesInboundSignature(
  env: Env,
  opts: { body: string; signature: string; timestamp?: string },
): Promise<boolean> {
  const secret = (env.SES_INBOUND_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    return (env.SES_INBOUND_ALLOW_UNSIGNED || "").trim() === "true";
  }
  if (opts.timestamp) {
    const ts = Number(opts.timestamp) * 1000;
    if (Number.isFinite(ts) && Math.abs(Date.now() - ts) > 15 * 60 * 1000) return false;
  }
  const payload = (opts.timestamp || "") + "." + opts.body;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const given = opts.signature.replace(/^sha256=/i, "").toLowerCase();
  return timingSafeEqual(hex, given);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function stripTrailingDot(value: string): string {
  return value.replace(/\.$/, "");
}

function extractAddr(value: string): string {
  const m = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return (m?.[0] || value).trim().toLowerCase();
}

export function parseStoredDnsJson(
  raw: string | null | undefined,
  domain: string,
  opts?: { provider?: string | null; region?: string | null },
): FlapDnsBundle {
  const provider = (opts?.provider || "").toLowerCase();
  const region = opts?.region || "us-east-1";
  if (provider === "mailgun") {
    if (!raw) return defaultMailgunDnsRecords(domain);
    try {
      const parsed = JSON.parse(raw) as FlapDnsBundle;
      if (parsed?.mx?.length && parsed.spf) {
        const defaults = defaultMailgunDnsRecords(domain);
        return { ...parsed, provider: "mailgun", dmarc: parsed.dmarc ?? defaults.dmarc };
      }
    } catch {
      /* ignore */
    }
    return defaultMailgunDnsRecords(domain);
  }
  if (provider === "cloudflare") {
    // Minimal CF routing template for legacy domains.
    return {
      provider: "cloudflare",
      note: "Legacy Cloudflare Email Routing. Migrate MX to Amazon SES when ready.",
      mx: [
        { type: "MX", name: domain, priority: 10, value: "route1.mx.cloudflare.net" },
        { type: "MX", name: domain, priority: 20, value: "route2.mx.cloudflare.net" },
      ],
      spf: { type: "TXT", name: domain, value: "v=spf1 include:_spf.mx.cloudflare.net ~all" },
      dkim: [],
      dmarc: {
        type: "TXT",
        name: `_dmarc.${domain}`,
        value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
      },
      worker_rule: "Catch-all → Send to Worker `flap`",
      send_note: "Legacy CF path — migrate to SES for DNS-anywhere sending.",
    };
  }
  return parseStoredSesDns(raw, domain, region);
}
