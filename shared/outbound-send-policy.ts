/**
 * Central outbound send readiness / policy checks (pure + DB-facing helpers).
 * All mailbox-backed sends should go through `dispatchStoredMessage`, which applies these.
 */
import { domainIsSendingReady, type ReadinessRow } from "./ses-dns.ts";

export type OutboundDomainRow = ReadinessRow & {
  provider_state?: string | null;
};

export type WorkspaceSendRow = {
  send_status?: string | null;
  outbound_access_status?: string | null;
};

export type OutboundPolicyFailure =
  | { code: "missing_domain"; message: string }
  | { code: "not_sending_ready"; message: string }
  | { code: "domain_suspended"; message: string }
  | { code: "workspace_suspended"; message: string }
  | { code: "workspace_restricted"; message: string }
  | { code: "outbound_pending"; message: string }
  | { code: "sender_not_authorized"; message: string }
  | { code: "suppressed"; message: string };

export type OutboundAccessStatus = "PENDING" | "APPROVED" | "RESTRICTED" | "SUSPENDED";
export type WorkspaceSendStatus = "ACTIVE" | "SEND_RESTRICTED" | "SUSPENDED";

export function normalizeOutboundAccess(raw: string | null | undefined): OutboundAccessStatus {
  const v = (raw || "APPROVED").toUpperCase();
  if (v === "PENDING" || v === "RESTRICTED" || v === "SUSPENDED") return v;
  return "APPROVED";
}

export function normalizeSendStatus(raw: string | null | undefined): WorkspaceSendStatus {
  const v = (raw || "ACTIVE").toUpperCase();
  if (v === "SEND_RESTRICTED" || v === "SUSPENDED") return v;
  return "ACTIVE";
}

/** Evaluate domain readiness / suspension for a From domain. */
export function evaluateOutboundDomainPolicy(
  domainName: string,
  row: OutboundDomainRow | null | undefined,
): OutboundPolicyFailure | null {
  if (!row) {
    return {
      code: "missing_domain",
      message: `Finish sending setup for ${domainName} before sending from this address.`,
    };
  }
  if (!domainIsSendingReady(row)) {
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

/** Workspace-level outbound access (manual review / abuse restriction). */
export function evaluateOutboundWorkspacePolicy(
  row: WorkspaceSendRow | null | undefined,
): OutboundPolicyFailure | null {
  const access = normalizeOutboundAccess(row?.outbound_access_status);
  const send = normalizeSendStatus(row?.send_status);
  if (access === "SUSPENDED" || send === "SUSPENDED") {
    return {
      code: "workspace_suspended",
      message: "This workspace is suspended from sending.",
    };
  }
  if (access === "RESTRICTED" || send === "SEND_RESTRICTED") {
    return {
      code: "workspace_restricted",
      message: "Outbound sending is restricted for this workspace.",
    };
  }
  if (access === "PENDING") {
    return {
      code: "outbound_pending",
      message: "Outbound access is pending review for this workspace.",
    };
  }
  return null;
}

/** From address must match a mailbox on the active workspace. */
export function evaluateOutboundSenderIdentity(
  fromEmail: string,
  mailboxAddress: string | null | undefined,
): OutboundPolicyFailure | null {
  const from = fromEmail.trim().toLowerCase();
  const mailbox = (mailboxAddress || "").trim().toLowerCase();
  if (!from || !mailbox || from !== mailbox) {
    return {
      code: "sender_not_authorized",
      message: "Sender address is not an authorized mailbox on this workspace.",
    };
  }
  return null;
}

export function outboundPolicyErrorMessage(failure: OutboundPolicyFailure): string {
  return failure.message;
}

/**
 * User-facing domain lifecycle (avoid leaking AWS jargon).
 * Maps stored readiness timestamps / provider_state.
 */
export function publicDomainLifecycle(row: OutboundDomainRow | null | undefined): string {
  if (!row) return "PENDING_OWNERSHIP";
  const state = (row.provider_state || "").toUpperCase();
  if (state === "SUSPENDED") return "SUSPENDED";
  if (state === "FAILED" || state === "DISCONNECTED") return "DISCONNECTED";
  if (state === "DEGRADED") return "DEGRADED";
  if (row.receiving_ready_at && row.sending_ready_at) return "OUTBOUND_READY";
  if (row.sending_ready_at) return "OUTBOUND_READY";
  if (row.receiving_ready_at) return "INBOUND_READY";
  if (row.identity_verified_at) return "VERIFIED";
  if (state === "DNS_PENDING" || state === "VERIFYING") return "VERIFYING";
  return "PENDING_OWNERSHIP";
}
