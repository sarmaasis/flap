import { randomId, nowMs } from "./ids";
import { trackServerEvent } from "./analytics";

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateReferralCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return out;
}

export async function ensureReferralCode(db: D1Database, userId: string): Promise<string> {
  const row = await db
    .prepare("SELECT referral_code FROM users WHERE id = ?")
    .bind(userId)
    .first<{ referral_code: string | null }>();
  if (row?.referral_code) return row.referral_code;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReferralCode();
    try {
      await db.prepare("UPDATE users SET referral_code = ? WHERE id = ? AND (referral_code IS NULL OR referral_code = '')")
        .bind(code, userId)
        .run();
      const again = await db
        .prepare("SELECT referral_code FROM users WHERE id = ?")
        .bind(userId)
        .first<{ referral_code: string | null }>();
      if (again?.referral_code) return again.referral_code;
    } catch {
      /* unique collision — retry */
    }
  }
  const fallback = `f${userId.replace(/[^a-z0-9]/gi, "").slice(-7)}`.toLowerCase();
  await db.prepare("UPDATE users SET referral_code = ? WHERE id = ?").bind(fallback, userId).run();
  return fallback;
}

/**
 * Referral abuse controls (enforced):
 * 1. Self-referral (same user id or same email)
 * 2. Disposable / throwaway mailbox domains (heuristic list)
 * 3. Shared Dodo customer_id between referrer and referee (when either has paid)
 * 4. Shared payment_fingerprint when Dodo webhook exposes a payment_method_id
 *    (or card fingerprint). Dodo subscription webhooks typically only include
 *    customer_id — PM fingerprint is stored when present on payment events.
 *
 * Not enforced (honest limits): device fingerprint, IP clustering, card BIN
 * matching without Dodo exposing it, manual review queue.
 */
const DISPOSABLE_HINTS = [
  "mailinator",
  "guerrillamail",
  "tempmail",
  "throwaway",
  "yopmail",
  "trashmail",
  "10minutemail",
  "temp-mail",
  "sharklasers",
  "discard.email",
  "mailnesia",
];

export function looksDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] || "";
  return DISPOSABLE_HINTS.some((h) => domain.includes(h));
}

export async function findReferrerByCode(
  db: D1Database,
  code: string,
): Promise<{ id: string; email: string } | null> {
  const trimmed = code.trim().toLowerCase();
  if (!trimmed || trimmed.length > 32) return null;
  const row = await db
    .prepare("SELECT id, email FROM users WHERE lower(referral_code) = ?")
    .bind(trimmed)
    .first<{ id: string; email: string }>();
  return row ?? null;
}

/**
 * Attach referral at signup. Skips self-referral and disposable emails.
 * Reward is granted later when the referred user verifies + connects a domain.
 */
export async function attributeReferral(
  db: D1Database,
  referredUserId: string,
  referredEmail: string,
  referralCode: string | null | undefined,
): Promise<{ ok: true; referrer_id: string } | { ok: false; reason: string }> {
  if (!referralCode) return { ok: false, reason: "no_code" };
  if (looksDisposableEmail(referredEmail)) return { ok: false, reason: "disposable" };

  const referrer = await findReferrerByCode(db, referralCode);
  if (!referrer) return { ok: false, reason: "invalid_code" };
  if (referrer.id === referredUserId) return { ok: false, reason: "self" };
  if (referrer.email.toLowerCase() === referredEmail.toLowerCase()) return { ok: false, reason: "self" };

  const existing = await db
    .prepare("SELECT id FROM referrals WHERE referred_user_id = ?")
    .bind(referredUserId)
    .first();
  if (existing) return { ok: false, reason: "already_attributed" };

  const now = nowMs();
  await db.batch([
    db.prepare("UPDATE users SET referred_by_user_id = ? WHERE id = ?").bind(referrer.id, referredUserId),
    db
      .prepare(
        `INSERT INTO referrals (id, referrer_user_id, referred_user_id, status, reward_domains, created_at)
         VALUES (?, ?, ?, 'pending', 1, ?)`,
      )
      .bind(randomId("ref"), referrer.id, referredUserId, now),
  ]);
  await trackServerEvent(db, "referral_signup", {
    userId: referredUserId,
    props: { referrer_id: referrer.id },
  });
  return { ok: true, referrer_id: referrer.id };
}

type IdentityRow = {
  id: string;
  dodo_customer_id: string | null;
  payment_fingerprint: string | null;
};

async function paymentIdentityConflict(
  db: D1Database,
  referrerId: string,
  referredId: string,
): Promise<string | null> {
  const [a, b] = await Promise.all([
    db
      .prepare("SELECT id, dodo_customer_id, payment_fingerprint FROM users WHERE id = ?")
      .bind(referrerId)
      .first<IdentityRow>(),
    db
      .prepare("SELECT id, dodo_customer_id, payment_fingerprint FROM users WHERE id = ?")
      .bind(referredId)
      .first<IdentityRow>(),
  ]);
  if (!a || !b) return null;

  const aCust = (a.dodo_customer_id || "").trim();
  const bCust = (b.dodo_customer_id || "").trim();
  if (aCust && bCust && aCust === bCust) return "shared_dodo_customer";

  const aFp = (a.payment_fingerprint || "").trim();
  const bFp = (b.payment_fingerprint || "").trim();
  if (aFp && bFp && aFp === bFp) return "shared_payment_fingerprint";

  // Multi-account pattern: referee already linked to a customer that another
  // referred user of the same referrer also used.
  if (bCust) {
    const clash = await db
      .prepare(
        `SELECT u.id FROM users u
         JOIN referrals r ON r.referred_user_id = u.id
         WHERE r.referrer_user_id = ?
           AND u.id != ?
           AND u.dodo_customer_id = ?
         LIMIT 1`,
      )
      .bind(referrerId, referredId, bCust)
      .first();
    if (clash) return "referrer_customer_reuse";
  }

  return null;
}

/**
 * Qualifying event: referred user has verified email (or OAuth) AND connected a domain.
 * Grants +1 domain permanently to both accounts unless payment-identity abuse is detected.
 */
export async function maybeQualifyReferral(db: D1Database, referredUserId: string): Promise<void> {
  const user = await db
    .prepare(
      `SELECT id, email_verified_at, referred_by_user_id FROM users WHERE id = ?`,
    )
    .bind(referredUserId)
    .first<{ id: string; email_verified_at: number | null; referred_by_user_id: string | null }>();
  if (!user?.referred_by_user_id) return;
  if (!user.email_verified_at) return;

  const domainCount = await db
    .prepare("SELECT COUNT(*) AS n FROM domains WHERE user_id = ?")
    .bind(referredUserId)
    .first<{ n: number }>();
  if (Number(domainCount?.n ?? 0) < 1) return;

  const referral = await db
    .prepare("SELECT * FROM referrals WHERE referred_user_id = ?")
    .bind(referredUserId)
    .first<{
      id: string;
      referrer_user_id: string;
      status: string;
      reward_domains: number;
    }>();
  if (!referral || referral.status === "rewarded" || referral.status === "blocked") return;

  const abuse = await paymentIdentityConflict(db, referral.referrer_user_id, referredUserId);
  if (abuse) {
    await db
      .prepare(
        `UPDATE referrals SET status = 'blocked', block_reason = ?, qualified_at = COALESCE(qualified_at, ?) WHERE id = ?`,
      )
      .bind(abuse, nowMs(), referral.id)
      .run();
    return;
  }

  const now = nowMs();
  const reward = Math.max(1, Number(referral.reward_domains || 1));

  await db.batch([
    db
      .prepare(
        `UPDATE referrals SET status = 'rewarded', qualified_at = COALESCE(qualified_at, ?), rewarded_at = ? WHERE id = ?`,
      )
      .bind(now, now, referral.id),
    db
      .prepare("UPDATE users SET referral_bonus_domains = referral_bonus_domains + ? WHERE id = ?")
      .bind(reward, referral.referrer_user_id),
    db
      .prepare("UPDATE users SET referral_bonus_domains = referral_bonus_domains + ? WHERE id = ?")
      .bind(reward, referredUserId),
  ]);

  await trackServerEvent(db, "referral_qualified", {
    userId: referredUserId,
    props: { referrer_id: referral.referrer_user_id },
  });
  await trackServerEvent(db, "referral_reward_granted", {
    userId: referral.referrer_user_id,
    props: { referred_id: referredUserId, domains: reward },
  });
  await trackServerEvent(db, "referral_reward_granted", {
    userId: referredUserId,
    props: { referrer_id: referral.referrer_user_id, domains: reward },
  });
}

export async function markEmailVerified(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?")
    .bind(nowMs(), userId)
    .run();
  await maybeQualifyReferral(db, userId);
}

/**
 * Persist Dodo customer / payment identifiers for abuse checks.
 * Prefer payment_method_id or card fingerprint when present; always store customer_id.
 */
export async function storePaymentIdentity(
  db: D1Database,
  userId: string,
  opts: { customerId?: string | null; paymentFingerprint?: string | null },
): Promise<void> {
  const customerId = opts.customerId?.trim() || null;
  const fp = opts.paymentFingerprint?.trim() || null;
  if (!customerId && !fp) return;

  if (customerId) {
    await db
      .prepare("UPDATE users SET dodo_customer_id = COALESCE(dodo_customer_id, ?) WHERE id = ?")
      .bind(customerId, userId)
      .run();
  }
  if (fp) {
    await db
      .prepare("UPDATE users SET payment_fingerprint = COALESCE(payment_fingerprint, ?) WHERE id = ?")
      .bind(fp, userId)
      .run();
  }

  // Re-evaluate pending referrals in case identity now conflicts.
  await maybeQualifyReferral(db, userId);
}
