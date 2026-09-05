/**
 * Domain readiness: identity ≠ MX ≠ receipt rule ≠ receiving ≠ sending.
 * Never mark a domain fully ready from DNS alone.
 */

import { nowMs } from "./ids";
import { getSesIdentityStatus, isSesMx, sesRegion } from "./ses";
import { isFlapMx, isFlapSpf } from "./mail-provider";
import { trackServerEvent } from "./analytics";
import {
  domainIsReceivingReady as sharedReceivingReady,
  domainIsSendingReady as sharedSendingReady,
  lifecycleFromRow as sharedLifecycle,
} from "../../shared/ses-dns";

export type DomainProviderRow = {
  id: string;
  name: string;
  user_id: string;
  mail_provider: string | null;
  provider_state: string | null;
  provider_region: string | null;
  provider_dns_json: string | null;
  ses_identity_arn: string | null;
  identity_verified_at: number | null;
  mx_verified_at: number | null;
  inbound_rule_ready_at: number | null;
  receiving_ready_at: number | null;
  sending_ready_at: number | null;
  last_provider_check_at: number | null;
  last_provider_error: string | null;
  migration_from: string | null;
  migration_state: string | null;
  catch_all_mailbox_id?: string | null;
  created_at?: number;
};

export type ReadinessReport = {
  domain: string;
  provider: string;
  region: string;
  lifecycle: string;
  receiving: {
    identity_verified: boolean;
    mx_configured: boolean;
    inbound_rule_active: boolean;
    receiving_ready: boolean;
  };
  sending: {
    ses_sending: boolean;
    sending_ready: boolean;
  };
  issues: string[];
  verified: boolean;
  guide_path: string | null;
  dns_provider: string;
  nameservers: string[];
  records: { mx: string[]; spf: string[] };
  identity_status?: string;
  dkim_status?: string;
};

const DOMAIN_SELECT = `id, name, user_id, mail_provider, provider_state, provider_region, provider_dns_json,
  ses_identity_arn, identity_verified_at, mx_verified_at, inbound_rule_ready_at,
  receiving_ready_at, sending_ready_at, last_provider_check_at, last_provider_error,
  migration_from, migration_state, catch_all_mailbox_id, created_at`;

export async function loadDomain(db: D1Database, id: string): Promise<DomainProviderRow | null> {
  return db
    .prepare(`SELECT ${DOMAIN_SELECT} FROM domains WHERE id = ?`)
    .bind(id)
    .first<DomainProviderRow>();
}

export function domainIsReceivingReady(row: DomainProviderRow): boolean {
  return sharedReceivingReady(row);
}

export function domainIsSendingReady(row: DomainProviderRow): boolean {
  return sharedSendingReady(row);
}

export function lifecycleFromRow(row: DomainProviderRow): string {
  return sharedLifecycle(row);
}

type DnsAnswer = { name: string; type: number; TTL?: number; data: string };

async function dohQuery(name: string, type: string): Promise<{ Answer?: DnsAnswer[] }> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/dns-json" },
    signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(8_000) : undefined,
  });
  if (!res.ok) throw new Error(`DNS lookup failed (${res.status})`);
  return (await res.json()) as { Answer?: DnsAnswer[] };
}

function parseMx(answers: DnsAnswer[] | undefined) {
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

function txtValues(answers: DnsAnswer[] | undefined): string[] {
  return (answers ?? [])
    .filter((a) => a.type === 16)
    .map((a) => a.data.replace(/^"|"$/g, "").replace(/" "/g, ""));
}

/**
 * Check setup: SES identity + public DNS MX/DKIM + receipt rule flag.
 * Updates domain readiness timestamps when checks pass.
 */
export async function checkDomainSetup(
  env: Env,
  row: DomainProviderRow,
  opts?: { dnsProviderDetect?: (ns: string[]) => string; guidePath?: (p: string) => string | null },
): Promise<ReadinessReport> {
  const provider = (row.mail_provider || "ses").toLowerCase();
  const region = row.provider_region || sesRegion(env);
  const issues: string[] = [];

  const [mx, spf, ns] = await Promise.all([
    dohQuery(row.name, "MX"),
    dohQuery(row.name, "TXT"),
    dohQuery(row.name, "NS"),
  ]);
  const mxParsed = parseMx(mx.Answer);
  const mxRecords = mxParsed.map((r) => `${r.priority} ${r.exchange}`);
  const spfRecords = txtValues(spf.Answer).filter((t) => /^v=spf1\b/i.test(t));
  const nameservers = (ns.Answer ?? [])
    .filter((a) => a.type === 2)
    .map((a) => a.data.replace(/\.$/, "").toLowerCase());
  const dnsProvider = opts?.dnsProviderDetect?.(nameservers) || "unknown";

  const mxOk = mxParsed.some((r) => isFlapMx(r.exchange, provider, region));
  const spfOk = spfRecords.some((t) => isFlapSpf(t, provider));

  if (!mxParsed.length) issues.push("MX record is missing");
  else if (!mxOk) {
    if (provider === "ses") {
      issues.push(`MX must point at inbound-smtp.${region}.amazonaws.com (Amazon SES receiving)`);
    } else if (provider === "mailgun") {
      issues.push("MX must point at mxa/mxb.mailgun.org (legacy Mailgun)");
    } else {
      issues.push("MX records do not point at Flap yet");
    }
  }
  if (!spfRecords.length) issues.push("SPF record is missing");
  else if (!spfOk) {
    issues.push(
      provider === "ses"
        ? "SPF must include amazonses.com"
        : "SPF does not yet include Flap’s mail provider",
    );
  }

  let identityVerified = Boolean(row.identity_verified_at);
  let sendingReady = Boolean(row.sending_ready_at);
  let identityStatus = identityVerified ? "Success" : "Pending";
  let dkimStatus = sendingReady ? "Success" : "Pending";

  if (provider === "ses") {
    const status = await getSesIdentityStatus(env, row.name);
    if (status) {
      identityVerified = status.identityVerified;
      sendingReady = status.sendingReady;
      identityStatus = status.verificationStatus;
      dkimStatus = status.dkimVerificationStatus;
      if (!status.identityVerified) issues.push("SES domain identity is not verified yet (publish _amazonses TXT + wait)");
      if (!status.sendingReady) issues.push("SES DKIM / sending verification is still pending (publish Easy DKIM CNAMEs)");
    } else if (!sesKeysPresent(env)) {
      // Without AWS keys, MX+SPF alone cannot mark identity — keep honest.
      if (!identityVerified) issues.push("SES API not configured yet — identity check skipped (ops: set AWS credentials)");
    }
  } else {
    // Legacy: MX+SPF green ≈ identity for product purposes.
    identityVerified = mxOk && spfOk;
    sendingReady = mxOk && spfOk;
  }

  // Receipt rule: set when ops marks inbound_rule_ready_at, or when SES env has rule set + identity verified.
  let inboundRuleActive = Boolean(row.inbound_rule_ready_at);
  if (provider === "ses" && identityVerified && (env.SES_RECEIPT_RULE_SET || "").trim()) {
    // Rule ensure runs at provision; treat identity+MX as enough to mark rule ready when rule set configured.
    inboundRuleActive = true;
  } else if (provider !== "ses") {
    inboundRuleActive = mxOk;
  }
  if (provider === "ses" && !inboundRuleActive) {
    issues.push("Inbound receipt route is not active yet (Flap ops: SES receipt rule set)");
  }

  const receivingReady =
    provider === "ses"
      ? identityVerified && mxOk && inboundRuleActive
      : mxOk && spfOk;

  const now = nowMs();
  const patches: string[] = [];
  const binds: Array<string | number | null> = [];

  if (identityVerified && !row.identity_verified_at) {
    patches.push("identity_verified_at = ?");
    binds.push(now);
    await trackServerEvent(env.DB, "domain_identity_verified", { userId: row.user_id, props: { domain: row.name } });
  }
  if (mxOk && !row.mx_verified_at) {
    patches.push("mx_verified_at = ?");
    binds.push(now);
    await trackServerEvent(env.DB, "domain_mx_verified", { userId: row.user_id, props: { domain: row.name } });
  }
  if (inboundRuleActive && !row.inbound_rule_ready_at) {
    patches.push("inbound_rule_ready_at = ?");
    binds.push(now);
  }
  if (receivingReady && !row.receiving_ready_at) {
    patches.push("receiving_ready_at = ?");
    binds.push(now);
    await trackServerEvent(env.DB, "domain_receiving_ready", { userId: row.user_id, props: { domain: row.name } });
  }
  if (sendingReady && !row.sending_ready_at) {
    patches.push("sending_ready_at = ?");
    binds.push(now);
  }

  let nextState = row.provider_state || "DNS_PENDING";
  if (receivingReady && sendingReady) nextState = "ACTIVE";
  else if (sendingReady) nextState = "SENDING_READY";
  else if (receivingReady) nextState = "RECEIVING_READY";
  else if (identityVerified) nextState = "IDENTITY_VERIFIED";
  else nextState = "DNS_PENDING";

  patches.push("provider_state = ?", "last_provider_check_at = ?", "last_provider_error = ?");
  binds.push(nextState, now, issues.length ? issues.slice(0, 3).join("; ").slice(0, 500) : null);
  binds.push(row.id);

  if (patches.length) {
    await env.DB.prepare(`UPDATE domains SET ${patches.join(", ")} WHERE id = ?`)
      .bind(...binds)
      .run()
      .catch((err: unknown) => console.warn("domain readiness update failed", err));
  }

  const verified = receivingReady; // UI "receiving path green" — not full ACTIVE
  return {
    domain: row.name,
    provider,
    region,
    lifecycle: nextState,
    receiving: {
      identity_verified: identityVerified,
      mx_configured: mxOk,
      inbound_rule_active: inboundRuleActive,
      receiving_ready: receivingReady,
    },
    sending: {
      ses_sending: sendingReady,
      sending_ready: sendingReady,
    },
    issues,
    verified,
    guide_path: opts?.guidePath?.(dnsProvider) ?? null,
    dns_provider: dnsProvider,
    nameservers,
    records: { mx: mxRecords, spf: spfRecords },
    identity_status: identityStatus,
    dkim_status: dkimStatus,
  };
}

function sesKeysPresent(env: Env): boolean {
  return Boolean((env.AWS_ACCESS_KEY_ID || "").trim() && (env.AWS_SECRET_ACCESS_KEY || "").trim());
}

/** Public helper for MX classification in DNS tools. */
export function classifyMx(exchange: string): { ses: boolean; mailgun: boolean; cf: boolean } {
  const host = exchange.replace(/\.$/, "").toLowerCase();
  return {
    ses: isSesMx(host),
    mailgun: /^(mxa|mxb)\.mailgun\.org$/i.test(host),
    cf: /mx\.cloudflare\.net$/i.test(host),
  };
}
