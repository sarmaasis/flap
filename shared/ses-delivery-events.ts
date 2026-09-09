/**
 * Pure SES configuration-set event helpers (no Env / AWS SDK).
 */

export type SesDeliveryKind =
  | "send"
  | "delivery"
  | "bounce"
  | "soft_bounce"
  | "complaint"
  | "reject"
  | "suppressed"
  | "open"
  | "click";

const TYPE_MAP: Array<{ match: RegExp; kind: SesDeliveryKind }> = [
  { match: /soft.?bounce|transient/i, kind: "soft_bounce" },
  { match: /bounce/i, kind: "bounce" },
  { match: /complaint/i, kind: "complaint" },
  { match: /reject/i, kind: "reject" },
  { match: /delivery/i, kind: "delivery" },
  { match: /^send$|renderingfailure/i, kind: "send" },
  { match: /open/i, kind: "open" },
  { match: /click/i, kind: "click" },
  { match: /suppress/i, kind: "suppressed" },
];

export function classifySesEventType(
  notificationType: string,
  bounceType?: string | null,
): SesDeliveryKind | null {
  const raw = `${notificationType} ${bounceType || ""}`.trim();
  if (!raw) return null;
  if (/bounce/i.test(notificationType) && /transient/i.test(bounceType || "")) {
    return "soft_bounce";
  }
  for (const row of TYPE_MAP) {
    if (row.match.test(notificationType)) return row.kind;
  }
  return null;
}

export function humanDeliveryStatus(kind: string): string {
  switch (kind) {
    case "send":
      return "Accepted";
    case "delivery":
      return "Delivered";
    case "bounce":
      return "Bounced";
    case "soft_bounce":
      return "Bounced";
    case "complaint":
      return "Complained";
    case "reject":
      return "Rejected";
    case "suppressed":
      return "Suppressed";
    case "queued":
      return "Queued";
    default:
      return kind;
  }
}

export function deliveryEventIdempotencyKey(
  providerMessageId: string,
  recipientEmail: string,
  kind: string,
): string {
  return `${providerMessageId.trim()}|${recipientEmail.trim().toLowerCase()}|${kind}`;
}

export function shouldWriteWorkspaceSuppression(kind: SesDeliveryKind): boolean {
  return kind === "bounce" || kind === "soft_bounce" || kind === "complaint";
}

export function shouldUnsubscribeNewsletter(kind: SesDeliveryKind): boolean {
  return kind === "bounce" || kind === "complaint";
}

/** Operational reputation targets (not product-hard limits). */
export const REPUTATION_WATCH = {
  bounce_rate_warn: 0.05,
  complaint_rate_warn: 0.001,
  min_events: 20,
} as const;

export function reputationWarning(
  bounce: number,
  complaint: number,
  delivery: number,
): { bounce_warn: boolean; complaint_warn: boolean } {
  const denom = bounce + complaint + delivery;
  if (denom < REPUTATION_WATCH.min_events) {
    return { bounce_warn: false, complaint_warn: false };
  }
  return {
    bounce_warn: bounce / denom >= REPUTATION_WATCH.bounce_rate_warn,
    complaint_warn: complaint / denom >= REPUTATION_WATCH.complaint_rate_warn,
  };
}
