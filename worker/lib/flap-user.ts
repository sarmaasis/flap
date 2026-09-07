import { nowMs, randomId } from "./ids";
import { ensureSubscription } from "./billing";
import { ensureOwnerMembership } from "./team";
import { attributeReferral, ensureReferralCode, markEmailVerified } from "./referrals";

export type ClerkUserLike = {
  /** Flap product user id when linking an existing row; empty when creating. */
  id: string;
  clerkUserId: string;
  email: string;
  name?: string | null;
  emailVerified?: boolean;
};

/**
 * Bridge Clerk identity → Flap product `users`.
 * Workspace id remains `users.id` (usr_…); Clerk id is stored in `clerk_user_id`.
 */
export async function ensureFlapUser(
  env: Env,
  clerkUser: ClerkUserLike,
  opts?: {
    referralCode?: string | null;
    createIfMissing?: boolean;
    linkOnly?: boolean;
  },
): Promise<{ id: string } | null> {
  const email = clerkUser.email.trim().toLowerCase();
  const clerkUserId = clerkUser.clerkUserId.trim();

  if (clerkUser.id) {
    const byId = await env.DB.prepare(
      "SELECT id, email, name, email_verified_at, clerk_user_id FROM users WHERE id = ?",
    )
      .bind(clerkUser.id)
      .first<{
        id: string;
        email: string;
        name: string | null;
        email_verified_at: number | null;
        clerk_user_id: string | null;
      }>();

    if (byId) {
      if (byId.email !== email) {
        await env.DB.prepare("UPDATE users SET email = ? WHERE id = ?").bind(email, byId.id).run();
      }
      if (!byId.clerk_user_id && clerkUserId) {
        await env.DB.prepare("UPDATE users SET clerk_user_id = ? WHERE id = ?")
          .bind(clerkUserId, byId.id)
          .run();
      }
      if (clerkUser.name) {
        await env.DB.prepare("UPDATE users SET name = ? WHERE id = ? AND (name IS NULL OR name = '')")
          .bind(clerkUser.name.slice(0, 120), byId.id)
          .run();
      }
      if (clerkUser.emailVerified && !byId.email_verified_at) {
        await markEmailVerified(env.DB, byId.id);
      }
      return { id: byId.id };
    }
  }

  const byClerk = clerkUserId
    ? await env.DB.prepare(
        "SELECT id, email, name, email_verified_at FROM users WHERE clerk_user_id = ?",
      )
        .bind(clerkUserId)
        .first<{ id: string; email: string; name: string | null; email_verified_at: number | null }>()
    : null;

  if (byClerk) {
    if (byClerk.email !== email) {
      await env.DB.prepare("UPDATE users SET email = ? WHERE id = ?").bind(email, byClerk.id).run();
    }
    if (clerkUser.name) {
      await env.DB.prepare("UPDATE users SET name = ? WHERE id = ? AND (name IS NULL OR name = '')")
        .bind(clerkUser.name.slice(0, 120), byClerk.id)
        .run();
    }
    if (clerkUser.emailVerified && !byClerk.email_verified_at) {
      await markEmailVerified(env.DB, byClerk.id);
    }
    return { id: byClerk.id };
  }

  const byEmail = await env.DB.prepare(
    "SELECT id, email_verified_at, clerk_user_id FROM users WHERE email = ?",
  )
    .bind(email)
    .first<{ id: string; email_verified_at: number | null; clerk_user_id: string | null }>();

  if (byEmail) {
    if (byEmail.clerk_user_id && byEmail.clerk_user_id !== clerkUserId) {
      console.warn("Flap user email exists with different Clerk id", email);
      return { id: byEmail.id };
    }
    if (!byEmail.clerk_user_id && clerkUserId) {
      await env.DB.prepare("UPDATE users SET clerk_user_id = ? WHERE id = ?")
        .bind(clerkUserId, byEmail.id)
        .run();
    }
    if (clerkUser.emailVerified && !byEmail.email_verified_at) {
      await markEmailVerified(env.DB, byEmail.id);
    }
    return { id: byEmail.id };
  }

  if (opts?.linkOnly || opts?.createIfMissing === false) return null;

  const id = randomId("usr");
  const now = nowMs();
  const name = (clerkUser.name ?? "").trim().slice(0, 120);
  await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, created_at, name, plan_id, clerk_user_id) VALUES (?, ?, '', ?, ?, 'free', ?)",
  )
    .bind(id, email, now, name, clerkUserId || null)
    .run();

  if ((await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>())?.n === 1) {
    await env.DB.prepare("INSERT OR IGNORE INTO setup_state (id, user_id, created_at) VALUES (1, ?, ?)")
      .bind(id, now)
      .run();
  }

  await ensureSubscription(env.DB, id);
  await ensureOwnerMembership(env.DB, id);
  await ensureReferralCode(env.DB, id);
  if (clerkUser.emailVerified) await markEmailVerified(env.DB, id);
  if (opts?.referralCode) {
    await attributeReferral(env.DB, id, email, opts.referralCode);
  }
  return { id };
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
