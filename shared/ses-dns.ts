/**
 * Pure SES DNS helpers shared by Worker + unit tests (no Env / AWS calls).
 */

export type FlapDnsBundleLite = {
  provider: "ses";
  note: string;
  mx: Array<{ type: string; name: string; priority: number; value: string }>;
  spf: { type: string; name: string; value: string };
  dkim: Array<{ type: string; name: string; value: string }>;
  verification?: Array<{ type: string; name: string; value: string }>;
  dmarc: { type: string; name: string; value: string };
  worker_rule: string;
  send_note: string;
  region: string;
};

export function sesInboundMxHost(region: string): string {
  return `inbound-smtp.${region}.amazonaws.com`;
}

export function isSesMx(exchange: string, region?: string): boolean {
  const host = exchange.replace(/\.$/, "").toLowerCase();
  if (region) return host === sesInboundMxHost(region).toLowerCase();
  return /^inbound-smtp\.[a-z0-9-]+\.amazonaws\.com$/i.test(host);
}

export function isSesSpf(spf: string): boolean {
  return /include:amazonses\.com/i.test(spf);
}

export function defaultSesDnsRecords(domain: string, region: string): FlapDnsBundleLite {
  const mxHost = sesInboundMxHost(region);
  return {
    provider: "ses",
    note:
      "Add these records at your DNS host (Namecheap, GoDaddy, Cloudflare DNS-only, Route 53, etc.). Your domain does not need to be a Cloudflare zone. Flap does not write DNS for you.",
    mx: [{ type: "MX", name: domain, priority: 10, value: mxHost }],
    spf: { type: "TXT", name: domain, value: "v=spf1 include:amazonses.com ~all" },
    dkim: [
      {
        type: "CNAME",
        name: `one._domainkey.${domain}`,
        value:
          "After Flap provisions this domain with SES, replace with the three Easy DKIM CNAME values shown in Settings.",
      },
    ],
    verification: [
      {
        type: "TXT",
        name: `_amazonses.${domain}`,
        value: "Verification token appears here after SES identity provisioning.",
      },
    ],
    dmarc: {
      type: "TXT",
      name: `_dmarc.${domain}`,
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
    },
    worker_rule: "",
    send_note:
      "Outbound mail for customer domains uses Amazon SES after identity + DKIM verify. System mail for useflap.online stays on Cloudflare Email Sending.",
    region,
  };
}

export function dnsBundleFromSes(
  domain: string,
  region: string,
  opts: { verificationToken?: string | null; dkimTokens?: string[] },
): FlapDnsBundleLite {
  const base = defaultSesDnsRecords(domain, region);
  const verification = opts.verificationToken
    ? [{ type: "TXT", name: `_amazonses.${domain}`, value: opts.verificationToken }]
    : base.verification;
  const dkim =
    opts.dkimTokens && opts.dkimTokens.length
      ? opts.dkimTokens.map((token) => ({
          type: "CNAME",
          name: `${token}._domainkey.${domain}`,
          value: `${token}.dkim.amazonses.com`,
        }))
      : base.dkim;
  return { ...base, verification, dkim };
}

export function isFlapMxForProvider(
  exchange: string,
  provider?: string | null,
  region?: string | null,
): boolean {
  const host = exchange.replace(/\.$/, "").toLowerCase();
  if (provider === "ses") return isSesMx(host, region || undefined);
  if (provider === "mailgun") return /^(mxa|mxb)\.mailgun\.org$/i.test(host);
  if (provider === "cloudflare") return /mx\.cloudflare\.net$/i.test(host);
  return (
    isSesMx(host) ||
    /^(mxa|mxb)\.mailgun\.org$/i.test(host) ||
    /mx\.cloudflare\.net$/i.test(host)
  );
}

export function isFlapSpfForProvider(spf: string, provider?: string | null): boolean {
  if (provider === "ses") return isSesSpf(spf);
  if (provider === "mailgun") return /include:mailgun\.org/i.test(spf);
  if (provider === "cloudflare") return /include:_spf\.mx\.cloudflare\.net/i.test(spf);
  return isSesSpf(spf) || /include:mailgun\.org/i.test(spf) || /include:_spf\.mx\.cloudflare\.net/i.test(spf);
}

export type ReadinessRow = {
  mail_provider: string | null;
  provider_state: string | null;
  identity_verified_at: number | null;
  mx_verified_at: number | null;
  inbound_rule_ready_at: number | null;
  receiving_ready_at: number | null;
  sending_ready_at: number | null;
};

export function domainIsReceivingReady(row: ReadinessRow): boolean {
  if (row.receiving_ready_at) return true;
  const p = (row.mail_provider || "").toLowerCase();
  if (p === "mailgun" || p === "cloudflare") {
    return Boolean(row.mx_verified_at) || /verified|active|dns/i.test(row.provider_state || "");
  }
  return Boolean(row.identity_verified_at && row.mx_verified_at && row.inbound_rule_ready_at);
}

export function domainIsSendingReady(row: ReadinessRow): boolean {
  if (row.sending_ready_at) return true;
  const p = (row.mail_provider || "").toLowerCase();
  if (p === "mailgun" || p === "cloudflare") {
    return Boolean(row.mx_verified_at) || /verified|active/i.test(row.provider_state || "");
  }
  return false;
}

export function lifecycleFromRow(row: ReadinessRow): string {
  if ((row.provider_state || "").toUpperCase() === "SUSPENDED") return "SUSPENDED";
  if ((row.provider_state || "").toUpperCase() === "FAILED") return "FAILED";
  if (row.receiving_ready_at && row.sending_ready_at) return "ACTIVE";
  if (row.sending_ready_at) return "SENDING_READY";
  if (row.receiving_ready_at) return "RECEIVING_READY";
  if (row.identity_verified_at) return "IDENTITY_VERIFIED";
  if ((row.provider_state || "").toUpperCase() === "DNS_PENDING") return "DNS_PENDING";
  return row.provider_state || "PENDING";
}
