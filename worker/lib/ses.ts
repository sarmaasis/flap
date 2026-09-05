/**
 * Amazon SES for Flap customer-domain mail (all plans).
 * Identity / DKIM / send via SigV4 from the Worker.
 * Inbound: SES → S3 → SQS → Lambda → POST /api/inbound/ses (see infra/ses-inbound).
 */

import { awsFetch } from "./aws-sigv4";
import type { DnsRecordRow, FlapDnsBundle } from "./mail-provider";

export type SesEnv = {
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_SES_REGION?: string;
  SES_CONFIGURATION_SET?: string;
  SES_INBOUND_WEBHOOK_SECRET?: string;
  SES_RECEIPT_RULE_SET?: string;
  SES_INBOUND_BUCKET?: string;
};

export function sesRegion(env: SesEnv): string {
  return (env.AWS_SES_REGION || "us-east-1").trim() || "us-east-1";
}

export function sesConfigured(env: SesEnv): boolean {
  return Boolean((env.AWS_ACCESS_KEY_ID || "").trim() && (env.AWS_SECRET_ACCESS_KEY || "").trim());
}

export function sesInboundMxHost(region: string): string {
  return `inbound-smtp.${region}.amazonaws.com`;
}

/** Regions that support SES email receiving (Amazon docs). */
export const SES_RECEIVING_REGIONS = new Set([
  "us-east-1",
  "us-east-2",
  "us-west-2",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-south-1",
  "sa-east-1",
  "ca-central-1",
]);

function sesEndpoint(region: string): string {
  return `https://email.${region}.amazonaws.com`;
}

async function sesAction(
  env: SesEnv,
  params: Record<string, string>,
): Promise<{ ok: true; xml: string } | { ok: false; error: string; status: number }> {
  if (!sesConfigured(env)) {
    return { ok: false, error: "SES is not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).", status: 503 };
  }
  const region = sesRegion(env);
  const body = new URLSearchParams(params).toString();
  const res = await awsFetch({
    accessKeyId: env.AWS_ACCESS_KEY_ID!.trim(),
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!.trim(),
    region,
    service: "ses",
    method: "POST",
    url: sesEndpoint(region),
    headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8" },
    body,
  });
  const xml = await res.text();
  if (!res.ok) {
    const msg = xml.match(/<Message>([^<]+)<\/Message>/)?.[1] || xml.slice(0, 240);
    return { ok: false, error: msg, status: res.status };
  }
  return { ok: true, xml };
}

function xmlTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m?.[1] ?? null;
}

function xmlTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

export function defaultSesDnsRecords(domain: string, region: string): FlapDnsBundle {
  const mxHost = sesInboundMxHost(region);
  return {
    provider: "ses",
    note:
      "Log into wherever you manage DNS for this domain (registrar or DNS panel). Add each row below exactly — Type, Host/Name, and Value. Flap cannot change your DNS for you.",
    mx: [
      {
        type: "MX",
        name: domain,
        priority: 10,
        value: mxHost,
      },
    ],
    spf: {
      type: "TXT",
      name: domain,
      value: "v=spf1 include:amazonses.com ~all",
    },
    dkim: [
      {
        type: "CNAME",
        name: `one._domainkey.${domain}`,
        value: "Values appear here once Flap finishes preparing this domain — refresh Settings in a minute.",
      },
    ],
    verification: [
      {
        type: "TXT",
        name: `_amazonses.${domain}`,
        value: "Token appears here once Flap finishes preparing this domain — refresh Settings in a minute.",
      },
    ],
    dmarc: {
      type: "TXT",
      name: `_dmarc.${domain}`,
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
    },
    worker_rule: "",
    send_note:
      "After these records verify, you can send from addresses on this domain in Compose. Adding more addresses later never needs new DNS.",
    dkim_legacy: undefined,
    region,
  };
}

export function dnsBundleFromSes(
  domain: string,
  region: string,
  opts: {
    verificationToken?: string | null;
    dkimTokens?: string[];
  },
): FlapDnsBundle {
  const base = defaultSesDnsRecords(domain, region);
  const verification =
    opts.verificationToken
      ? [
          {
            type: "TXT",
            name: `_amazonses.${domain}`,
            value: opts.verificationToken,
          },
        ]
      : base.verification;
  const dkim =
    opts.dkimTokens && opts.dkimTokens.length
      ? opts.dkimTokens.map((token) => ({
          type: "CNAME",
          name: `${token}._domainkey.${domain}`,
          value: `${token}.dkim.amazonses.com`,
        }))
      : base.dkim;
  return {
    ...base,
    verification,
    dkim,
    dkim_legacy: dkim[0],
  };
}

export async function provisionSesDomain(
  env: SesEnv,
  domain: string,
): Promise<
  | {
      ok: true;
      dns: FlapDnsBundle;
      state: string;
      region: string;
      identityArn?: string;
    }
  | { ok: false; error: string }
> {
  const region = sesRegion(env);
  if (!SES_RECEIVING_REGIONS.has(region)) {
    return {
      ok: false,
      error: `SES region ${region} does not support inbound receiving. Use us-east-1, us-west-2, or eu-west-1.`,
    };
  }

  if (!sesConfigured(env)) {
    // Dev / pre-AWS: still return authoritative template so UI works.
    return {
      ok: true,
      dns: defaultSesDnsRecords(domain, region),
      state: "pending_manual",
      region,
    };
  }

  const verify = await sesAction(env, {
    Action: "VerifyDomainIdentity",
    Domain: domain,
  });
  if (!verify.ok) {
    console.warn("SES VerifyDomainIdentity failed", verify.status, verify.error);
    return { ok: false, error: "Could not register domain with Amazon SES. Try again or contact support." };
  }
  const verificationToken = xmlTag(verify.xml, "VerificationToken");

  const dkim = await sesAction(env, {
    Action: "VerifyDomainDkim",
    Domain: domain,
  });
  const dkimTokens = dkim.ok ? xmlTags(dkim.xml, "member") : [];

  // Enable Easy DKIM signing when identity exists.
  await sesAction(env, {
    Action: "SetIdentityDkimEnabled",
    Identity: domain,
    DkimEnabled: "true",
  }).catch(() => undefined);

  // Best-effort: add domain to active receipt rule set (infra may own the rule set).
  await ensureSesReceiptRule(env, domain).catch((err) =>
    console.warn("SES receipt rule ensure failed", err instanceof Error ? err.message : err),
  );

  const dns = dnsBundleFromSes(domain, region, { verificationToken, dkimTokens });
  return {
    ok: true,
    dns,
    state: "DNS_PENDING",
    region,
    identityArn: `arn:aws:ses:${region}:identity/${domain}`,
  };
}

/** Ensure a recipient rule exists for this domain on the configured rule set. */
export async function ensureSesReceiptRule(env: SesEnv, domain: string): Promise<void> {
  const ruleSet = (env.SES_RECEIPT_RULE_SET || "").trim();
  const bucket = (env.SES_INBOUND_BUCKET || "").trim();
  if (!ruleSet || !bucket || !sesConfigured(env)) return;

  const ruleName = `flap-${domain.replace(/[^a-z0-9-]/gi, "-").slice(0, 50)}`;
  // CreateReceiptRule — store to S3 with object key prefix by domain.
  const params: Record<string, string> = {
    Action: "CreateReceiptRule",
    RuleSetName: ruleSet,
    "Rule.Name": ruleName,
    "Rule.Enabled": "true",
    "Rule.ScanEnabled": "true",
    "Rule.Recipients.member.1": domain,
    "Rule.Actions.member.1.S3Action.BucketName": bucket,
    "Rule.Actions.member.1.S3Action.ObjectKeyPrefix": `raw/${domain}/`,
  };
  const res = await sesAction(env, params);
  if (!res.ok) {
    // AlreadyExists is fine.
    if (/AlreadyExists|already exists/i.test(res.error)) return;
    throw new Error(res.error);
  }
}

export async function deleteSesDomain(env: SesEnv, domain: string): Promise<void> {
  if (!sesConfigured(env)) return;
  await sesAction(env, { Action: "DeleteIdentity", Identity: domain }).catch(() => undefined);
  const ruleSet = (env.SES_RECEIPT_RULE_SET || "").trim();
  if (!ruleSet) return;
  const ruleName = `flap-${domain.replace(/[^a-z0-9-]/gi, "-").slice(0, 50)}`;
  await sesAction(env, {
    Action: "DeleteReceiptRule",
    RuleSetName: ruleSet,
    RuleName: ruleName,
  }).catch(() => undefined);
}

export type SesIdentityStatus = {
  verificationStatus: string;
  dkimEnabled: boolean;
  dkimVerificationStatus: string;
  identityVerified: boolean;
  sendingReady: boolean;
};

export async function getSesIdentityStatus(env: SesEnv, domain: string): Promise<SesIdentityStatus | null> {
  if (!sesConfigured(env)) return null;

  const [ver, dkim] = await Promise.all([
    sesAction(env, {
      Action: "GetIdentityVerificationAttributes",
      "Identities.member.1": domain,
    }),
    sesAction(env, {
      Action: "GetIdentityDkimAttributes",
      "Identities.member.1": domain,
    }),
  ]);

  const verificationStatus = ver.ok
    ? ver.xml.match(/<VerificationStatus>([^<]+)<\/VerificationStatus>/)?.[1] || "Pending"
    : "Unknown";
  const dkimEnabled = dkim.ok ? /<DkimEnabled>true<\/DkimEnabled>/i.test(dkim.xml) : false;
  const dkimVerificationStatus = dkim.ok
    ? dkim.xml.match(/<DkimVerificationStatus>([^<]+)<\/DkimVerificationStatus>/)?.[1] || "Pending"
    : "Unknown";
  const identityVerified = /^Success$/i.test(verificationStatus);
  const sendingReady = identityVerified && /^Success$/i.test(dkimVerificationStatus);

  return {
    verificationStatus,
    dkimEnabled,
    dkimVerificationStatus,
    identityVerified,
    sendingReady,
  };
}

export async function sendRawViaSes(
  env: SesEnv,
  opts: { from: string; to: string[]; rawMime: string | Uint8Array },
): Promise<{ messageId: string }> {
  if (!sesConfigured(env)) throw new Error("Amazon SES is not configured.");
  if (!opts.to.length) throw new Error("No recipients.");

  const raw =
    typeof opts.rawMime === "string" ? new TextEncoder().encode(opts.rawMime) : opts.rawMime;
  // SES SendRawEmail expects base64 Data.
  let binary = "";
  for (let i = 0; i < raw.byteLength; i++) binary += String.fromCharCode(raw[i]!);
  const dataB64 = btoa(binary);

  const params: Record<string, string> = {
    Action: "SendRawEmail",
    "RawMessage.Data": dataB64,
    Source: extractAddr(opts.from),
  };
  opts.to.forEach((addr, i) => {
    params[`Destinations.member.${i + 1}`] = extractAddr(addr);
  });
  const configSet = (env.SES_CONFIGURATION_SET || "").trim();
  if (configSet) params.ConfigurationSetName = configSet;

  const res = await sesAction(env, params);
  if (!res.ok) throw new Error(`SES send failed (${res.status}): ${res.error}`);
  const messageId = xmlTag(res.xml, "MessageId") || "";
  return { messageId };
}

export function isSesMx(exchange: string, region?: string): boolean {
  const host = exchange.replace(/\.$/, "").toLowerCase();
  if (region) return host === sesInboundMxHost(region).toLowerCase();
  return /^inbound-smtp\.[a-z0-9-]+\.amazonaws\.com$/i.test(host);
}

export function isSesSpf(spf: string): boolean {
  return /include:amazonses\.com/i.test(spf);
}

export function parseStoredSesDns(
  raw: string | null | undefined,
  domain: string,
  region: string,
): FlapDnsBundle {
  if (!raw) return defaultSesDnsRecords(domain, region);
  try {
    const parsed = JSON.parse(raw) as FlapDnsBundle;
    if (parsed?.mx?.length && parsed.spf) {
      return { ...parsed, provider: parsed.provider || "ses", region: parsed.region || region };
    }
  } catch {
    /* ignore */
  }
  return defaultSesDnsRecords(domain, region);
}

/** Map generic DNS rows (tests / tooling) into SES bundle shape. */
export function dnsBundleFromProviderRecordsSes(
  domain: string,
  region: string,
  records: DnsRecordRow[],
): FlapDnsBundle {
  const base = defaultSesDnsRecords(domain, region);
  const mx = records
    .filter((r) => r.type.toUpperCase() === "MX")
    .map((r) => ({
      type: "MX",
      name: stripTrailingDot(r.name) || domain,
      priority: r.priority ?? 10,
      value: stripTrailingDot(r.value),
    }));
  const spfRow = records.find((r) => r.type.toUpperCase() === "TXT" && /v=spf1/i.test(r.value));
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
  const verification = records
    .filter((r) => r.type.toUpperCase() === "TXT" && /_amazonses/i.test(r.name))
    .map((r) => ({
      type: "TXT",
      name: stripTrailingDot(r.name),
      value: r.value.replace(/^"|"$/g, ""),
    }));
  return {
    ...base,
    mx: mx.length ? mx : base.mx,
    spf: spfRow
      ? { type: "TXT", name: stripTrailingDot(spfRow.name) || domain, value: spfRow.value.replace(/^"|"$/g, "") }
      : base.spf,
    dkim: dkim.length ? dkim : base.dkim,
    verification: verification.length ? verification : base.verification,
    dkim_legacy: (dkim.length ? dkim : base.dkim)[0],
  };
}

function stripTrailingDot(value: string): string {
  return value.replace(/\.$/, "");
}

function extractAddr(value: string): string {
  const m = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return (m?.[0] || value).trim().toLowerCase();
}
