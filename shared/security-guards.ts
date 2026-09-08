/**
 * Pure security helpers for Phase B (authz, webhooks, reply identity).
 * Keep free of Worker/DOM imports so unit tests can run with `tsx`.
 */

/** Soft bounces expire after 72h so transient failures do not permanently brick delivery. */
export const SOFT_BOUNCE_TTL_MS = 72 * 60 * 60 * 1000;

/** Inbound idempotency rows stuck in `processing` older than this may be reclaimed. */
export const INBOUND_CLAIM_STALE_MS = 5 * 60 * 1000;

export function softBounceExpiresAt(nowMs: number): number {
  return nowMs + SOFT_BOUNCE_TTL_MS;
}

export function inboundClaimIsFreshProcessing(
  outcome: string,
  createdAt: number,
  now: number,
  staleMs = INBOUND_CLAIM_STALE_MS,
): boolean {
  return outcome === "processing" && now - createdAt < staleMs;
}

export function inboundClaimIsTerminalDuplicate(outcome: string): boolean {
  return outcome === "stored" || outcome === "duplicate";
}

/**
 * SNS subscription confirmation must only fetch AWS SNS SubscribeURL hosts.
 * Prevents open SSRF via forged SubscriptionConfirmation JSON.
 */
export function isAllowedSnsSubscribeUrl(raw: string): boolean {
  return isAllowedSnsHttpsHost(raw);
}

/**
 * SigningCertURL must be HTTPS on sns.<region>.amazonaws.com (same host allowlist as SubscribeURL).
 * Path typically ends in .pem; we require a non-empty path to avoid origin-only probes.
 */
export function isAllowedSnsSigningCertUrl(raw: string): boolean {
  if (!isAllowedSnsHttpsHost(raw)) return false;
  try {
    const url = new URL(raw);
    return url.pathname.length > 1;
  } catch {
    return false;
  }
}

function isAllowedSnsHttpsHost(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  // sns.us-east-1.amazonaws.com / sns.eu-west-1.amazonaws.com
  if (!/^sns\.[a-z0-9-]+\.amazonaws\.com$/i.test(url.hostname)) return false;
  // Reject userinfo / odd ports
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  return true;
}

/** True when the JSON body looks like an AWS SNS HTTPS envelope (not a bare SES event). */
export function isSnsEnvelope(payload: Record<string, unknown>): boolean {
  const type = payload.Type;
  const sig = payload.Signature;
  const cert = payload.SigningCertURL ?? payload.SigningCertUrl;
  return typeof type === "string" && typeof sig === "string" && typeof cert === "string";
}

/**
 * Build the AWS SNS canonical string-to-sign.
 * Field order is fixed (byte-sort); optional Subject only when present on Notifications.
 * Trailing newline after the last value is required.
 */
export function buildSnsStringToSign(payload: Record<string, unknown>): string | null {
  const type = String(payload.Type || "");
  let keys: string[];
  if (type === "Notification") {
    keys = ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"];
  } else if (type === "SubscriptionConfirmation" || type === "UnsubscribeConfirmation") {
    keys = ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];
  } else {
    return null;
  }

  const parts: string[] = [];
  for (const key of keys) {
    if (key === "Subject" && (payload.Subject === undefined || payload.Subject === null)) {
      continue;
    }
    const value = payload[key];
    if (typeof value !== "string") return null;
    parts.push(key, value);
  }
  return parts.join("\n") + "\n";
}

/** Decode PEM (CERTIFICATE / PUBLIC KEY) to DER bytes. */
export function pemToDer(pem: string): Uint8Array | null {
  const match = /-----BEGIN [^-]+-----([\s\S]*?)-----END [^-]+-----/.exec(pem);
  if (!match) return null;
  const b64 = match[1].replace(/\s+/g, "");
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function readAsn1TagLength(buf: Uint8Array, offset: number): { tag: number; length: number; headerLen: number } | null {
  if (offset >= buf.length) return null;
  const tag = buf[offset];
  if (offset + 1 >= buf.length) return null;
  const first = buf[offset + 1];
  if (first < 0x80) return { tag, length: first, headerLen: 2 };
  const numBytes = first & 0x7f;
  if (numBytes === 0 || numBytes > 4 || offset + 1 + numBytes >= buf.length) return null;
  let length = 0;
  for (let i = 0; i < numBytes; i++) length = (length << 8) | buf[offset + 2 + i];
  return { tag, length, headerLen: 2 + numBytes };
}

/**
 * Extract SubjectPublicKeyInfo DER from an X.509 certificate DER (for WebCrypto importKey "spki").
 * No ASN.1 library — walks Certificate → tbsCertificate → subjectPublicKeyInfo.
 */
export function extractSpkiFromX509Der(certDer: Uint8Array): Uint8Array | null {
  // Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }
  const outer = readAsn1TagLength(certDer, 0);
  if (!outer || outer.tag !== 0x30) return null;
  const tbsOffset = outer.headerLen;
  const tbs = readAsn1TagLength(certDer, tbsOffset);
  if (!tbs || tbs.tag !== 0x30) return null;
  const tbsStart = tbsOffset + tbs.headerLen;
  const tbsEnd = tbsStart + tbs.length;
  if (tbsEnd > certDer.length) return null;

  // Walk tbsCertificate children; SPKI is index 6 with version, else 5.
  const children: { start: number; end: number; tag: number }[] = [];
  let pos = tbsStart;
  while (pos < tbsEnd) {
    const node = readAsn1TagLength(certDer, pos);
    if (!node) return null;
    const end = pos + node.headerLen + node.length;
    if (end > tbsEnd) return null;
    children.push({ start: pos, end, tag: node.tag });
    pos = end;
  }
  const hasVersion = children[0]?.tag === 0xa0;
  const spki = children[hasVersion ? 6 : 5];
  if (!spki || certDer[spki.start] !== 0x30) return null;
  return certDer.slice(spki.start, spki.end);
}

export function snsSignatureHashName(signatureVersion: string): "SHA-1" | "SHA-256" | null {
  if (signatureVersion === "1") return "SHA-1";
  if (signatureVersion === "2") return "SHA-256";
  return null;
}

/** Base64 → bytes (SNS Signature field). */
export function decodeBase64(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64.replace(/\s+/g, ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Verify SNS Signature against a PEM X.509 signing certificate (WebCrypto, no extra deps).
 * Caller must already allowlist SigningCertURL and supply the fetched PEM body.
 */
export async function verifySnsSignatureWithPem(
  payload: Record<string, unknown>,
  certPem: string,
): Promise<boolean> {
  const stringToSign = buildSnsStringToSign(payload);
  if (!stringToSign) return false;
  const version = String(payload.SignatureVersion || "1");
  const hash = snsSignatureHashName(version);
  if (!hash) return false;
  const sigB64 = typeof payload.Signature === "string" ? payload.Signature : "";
  const signature = decodeBase64(sigB64);
  if (!signature) return false;
  const certDer = pemToDer(certPem);
  if (!certDer) return false;
  const spki = extractSpkiFromX509Der(certDer);
  if (!spki) return false;

  try {
    // Copy into a fresh ArrayBuffer-backed view for DOM lib BufferSource typing.
    const spkiBytes = Uint8Array.from(spki);
    const sigBytes = Uint8Array.from(signature);
    const key = await crypto.subtle.importKey(
      "spki",
      spkiBytes,
      { name: "RSASSA-PKCS1-v1_5", hash },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      sigBytes,
      new TextEncoder().encode(stringToSign),
    );
  } catch {
    return false;
  }
}

export type ReplyMailbox = { id: string; address: string };

/**
 * Deterministic reply-from: receiving mailbox first, then exact To match in owned mailboxes.
 * Never returns an external address (avoids Compose falling back to the wrong domain).
 */
export function resolveReplyFromAddress(
  msg: { mailbox_id: string | null; to_addr: string },
  mailboxes: ReplyMailbox[],
  extractEmail: (raw: string) => string,
): string | undefined {
  const byId = msg.mailbox_id ? mailboxes.find((m) => m.id === msg.mailbox_id) : undefined;
  if (byId?.address) return byId.address;
  const to = extractEmail(msg.to_addr);
  if (to && mailboxes.some((m) => m.address.toLowerCase() === to.toLowerCase())) {
    return mailboxes.find((m) => m.address.toLowerCase() === to.toLowerCase())!.address;
  }
  return undefined;
}

/** Mirror of worker mailbox ACL: null = owner/admin (all), [] = no access, else grant list. */
export type MailboxAccessCtx = { mailboxIds: string[] | null };

/**
 * SQL fragment for message/attachment queries. Must be paired with `user_id = ?` (workspace).
 * Used by mail get/thread/attachment/move routes to prevent mailbox IDOR for restricted members.
 */
export function mailboxAccessSql(
  ctx: MailboxAccessCtx,
  column = "mailbox_id",
): { sql: string; binds: string[] } {
  if (ctx.mailboxIds === null) {
    return { sql: "", binds: [] };
  }
  if (ctx.mailboxIds.length === 0) {
    return { sql: ` AND 1 = 0`, binds: [] };
  }
  const placeholders = ctx.mailboxIds.map(() => "?").join(", ");
  return { sql: ` AND ${column} IN (${placeholders})`, binds: [...ctx.mailboxIds] };
}

/** Authz WHERE for reading a single message (and JOIN'd attachments via messages row). */
export function messageAuthzWhere(
  workspaceId: string,
  ctx: MailboxAccessCtx,
  column = "mailbox_id",
): { sql: string; binds: unknown[] } {
  const access = mailboxAccessSql(ctx, column);
  return {
    sql: `user_id = ?${access.sql}`,
    binds: [workspaceId, ...access.binds],
  };
}

/** True when a restricted member cannot see the given mailbox. */
export function memberDeniedMailbox(ctx: MailboxAccessCtx, mailboxId: string): boolean {
  if (ctx.mailboxIds === null) return false;
  return !ctx.mailboxIds.includes(mailboxId);
}
