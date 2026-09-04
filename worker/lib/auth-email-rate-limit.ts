import { APIError } from "better-auth";
import { nowMs, randomId } from "./ids";

/**
 * Auth outbound email rate limits (magic-link + verification).
 *
 * Per email + kind:
 *   - 3 requests / 15 minutes
 *   - 10 requests / rolling 24 hours
 * Per IP + kind:
 *   - 10 requests / hour
 *
 * Fail closed: D1 errors deny the send with 429.
 * Backed by `auth_email_rate_log` (migration 0011).
 */
export const AUTH_EMAIL_RATE_LIMITS = {
  perEmailBurst: { max: 3, windowMs: 15 * 60 * 1000 },
  perEmailDay: { max: 10, windowMs: 24 * 60 * 60 * 1000 },
  perIpHour: { max: 10, windowMs: 60 * 60 * 1000 },
} as const;

export type AuthEmailKind = "magic_link" | "verify_email";

const RATE_LIMIT_MESSAGE =
  "Too many email requests. Please wait a bit and try again.";

async function sha256HexPrefix(value: string, chars = 32): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, chars);
}

export function clientIpFromHeaders(headers: Headers | null | undefined): string {
  if (!headers) return "unknown";
  return (
    headers.get("CF-Connecting-IP") ||
    headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function countSince(
  db: D1Database,
  opts: { kind: AuthEmailKind; field: "email_hash" | "ip_hash"; hash: string; since: number },
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM auth_email_rate_log
       WHERE kind = ? AND ${opts.field} = ? AND created_at > ?`,
    )
    .bind(opts.kind, opts.hash, opts.since)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/**
 * Check + record an auth email send attempt.
 * Throws APIError TOO_MANY_REQUESTS when over limit or on D1 failure.
 */
export async function assertAuthEmailRateLimit(
  db: D1Database,
  opts: { kind: AuthEmailKind; email: string; ip: string },
): Promise<void> {
  const email = normalizeEmail(opts.email);
  if (!email || !email.includes("@")) {
    throw new APIError("BAD_REQUEST", { message: "Enter a valid email address." });
  }

  try {
    const emailHash = await sha256HexPrefix(`email:${email}`);
    const ipHash = await sha256HexPrefix(`ip:${opts.ip || "unknown"}`);
    const now = nowMs();
    const { perEmailBurst, perEmailDay, perIpHour } = AUTH_EMAIL_RATE_LIMITS;

    const [emailBurst, emailDay, ipHour] = await Promise.all([
      countSince(db, {
        kind: opts.kind,
        field: "email_hash",
        hash: emailHash,
        since: now - perEmailBurst.windowMs,
      }),
      countSince(db, {
        kind: opts.kind,
        field: "email_hash",
        hash: emailHash,
        since: now - perEmailDay.windowMs,
      }),
      countSince(db, {
        kind: opts.kind,
        field: "ip_hash",
        hash: ipHash,
        since: now - perIpHour.windowMs,
      }),
    ]);

    if (emailBurst >= perEmailBurst.max || emailDay >= perEmailDay.max || ipHour >= perIpHour.max) {
      throw new APIError("TOO_MANY_REQUESTS", { message: RATE_LIMIT_MESSAGE });
    }

    await db
      .prepare(
        `INSERT INTO auth_email_rate_log (id, kind, email_hash, ip_hash, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(randomId("aerl"), opts.kind, emailHash, ipHash, now)
      .run();
  } catch (err) {
    if (err instanceof APIError) throw err;
    console.error("auth email rate limit check failed", err);
    throw new APIError("TOO_MANY_REQUESTS", { message: RATE_LIMIT_MESSAGE });
  }
}
