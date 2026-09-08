/**
 * Central outbound send readiness / policy checks (pure + DB-facing helpers).
 * All mailbox-backed sends should go through `dispatchStoredMessage`, which applies these.
 */
import { domainIsSendingReady, type ReadinessRow } from "./ses-dns.ts";

export type OutboundDomainRow = ReadinessRow & {
  provider_state?: string | null;
};

export type OutboundPolicyFailure =
  | { code: "missing_domain"; message: string }
  | { code: "not_sending_ready"; message: string }
  | { code: "domain_suspended"; message: string }
  | { code: "suppressed"; message: string };

/** Evaluate domain readiness / suspension for a From domain. */
export function evaluateOutboundDomainPolicy(
  domainName: string,
  row: OutboundDomainRow | null | undefined,
): OutboundPolicyFailure | null {
  if (!row || !domainIsSendingReady(row)) {
    return {
      code: "not_sending_ready",
      message: `Finish sending setup for ${domainName} before sending from this address.`,
    };
  }
  if (/SUSPENDED|FAILED/i.test(row.provider_state || "")) {
    return {
      code: "domain_suspended",
      message: `Domain ${domainName} is suspended and cannot send.`,
    };
  }
  return null;
}

export function outboundPolicyErrorMessage(failure: OutboundPolicyFailure): string {
  return failure.message;
}
