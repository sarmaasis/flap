import { nowMs } from "./ids";
import { ensureSubscription } from "./billing";
import { ensureOwnerMembership } from "./team";
import { attributeReferral, ensureReferralCode, markEmailVerified } from "./referrals";

export type BaUserLike = {
  id: string;
  email: string;
  name?: string | null;
  emailVerified?: boolean;
};

/**
 * Bridge Better Auth `user` → Flap product `users`.
 * Same id is used as the personal workspace id everywhere billing/domains hang off.
 */
export async function ensureFlapUser(
  env: Env,
  baUser: BaUserLike,
  opts?: { referralCode?: string | null },
): Promise<void> {
  const email = baUser.email.trim().toLowerCase();
  const byId = await env.DB.prepare(
    "SELECT id, email, name, email_verified_at FROM users WHERE id = ?",
  )
    .bind(baUser.id)
    .first<{ id: string; email: string; name: string | null; email_verified_at: number | null }>();

  if (byId) {
    if (byId.email !== email) {
      await env.DB.prepare("UPDATE users SET email = ? WHERE id = ?").bind(email, baUser.id).run();
    }
    if (baUser.name) {
      await env.DB.prepare("UPDATE users SET name = ? WHERE id = ? AND (name IS NULL OR name = '')")
        .bind(baUser.name.slice(0, 120), baUser.id)
        .run();
    }
    // Only write + referral scans when verification is newly set (hot-path skip for verified users).
    if (baUser.emailVerified && !byId.email_verified_at) {
      await markEmailVerified(env.DB, baUser.id);
    }
    return;
  }

  const byEmail = await env.DB.prepare("SELECT id, email_verified_at FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; email_verified_at: number | null }>();

  if (byEmail) {
    // Should not happen after id-preserving migration; log and attach product state to BA id only if empty.
    console.warn("Flap user email exists with different id than Better Auth user", email);
    if (baUser.emailVerified && !byEmail.email_verified_at) {
      await markEmailVerified(env.DB, byEmail.id);
    }
    return;
  }

  const now = nowMs();
  const name = (baUser.name ?? "").trim().slice(0, 120);
  await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, created_at, name, plan_id) VALUES (?, ?, '', ?, ?, 'free')",
  )
    .bind(baUser.id, email, now, name)
    .run();

  if ((await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>())?.n === 1) {
    await env.DB.prepare("INSERT OR IGNORE INTO setup_state (id, user_id, created_at) VALUES (1, ?, ?)")
      .bind(baUser.id, now)
      .run();
  }

  await ensureSubscription(env.DB, baUser.id);
  await ensureOwnerMembership(env.DB, baUser.id);
  await ensureReferralCode(env.DB, baUser.id);
  if (baUser.emailVerified) await markEmailVerified(env.DB, baUser.id);
  if (opts?.referralCode) {
    await attributeReferral(env.DB, baUser.id, email, opts.referralCode);
  }
}

export function referralFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)flap_ref=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}
