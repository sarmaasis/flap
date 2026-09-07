import type { Context } from "hono";
import { clerkAuthorizedParties, flapClerk, requestWithClerkToken } from "./clerk";
import { ensureFlapUser, referralFromCookieHeader } from "./flap-user";
import { markEmailVerified } from "./referrals";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: number;
};

export type SessionUser = UserRow & {
  /** Clerk primary email verified — source of truth for /app access. */
  emailVerified: boolean;
};

type AppEnv = { Bindings: Env };

export async function userCount(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  return Number(row?.n ?? 0);
}

function signupOpen(env: Env): boolean {
  return (env.SAAS_MODE || "true").toLowerCase() !== "false";
}

/**
 * Resolve the Flap product user from a Clerk session JWT (Bearer or cookie).
 * Lazily provisions / links `users` (workspace id stays Flap `users.id`).
 * Does not enforce email verification (use `requireUser` for product APIs).
 */
export async function getSessionUser(c: Context<AppEnv>): Promise<SessionUser | null> {
  if (!(c.env.CLERK_SECRET_KEY || "").trim() || !(c.env.CLERK_PUBLISHABLE_KEY || "").trim()) {
    return null;
  }

  const raw = c.req.raw;
  const clerk = flapClerk(c.env);
  const requestState = await clerk.authenticateRequest(requestWithClerkToken(raw), {
    authorizedParties: clerkAuthorizedParties(c.env, raw),
  });

  if (!requestState.isAuthenticated) {
    const quiet =
      requestState.reason === "session-token-and-uat-missing" ||
      requestState.reason === "session-token-missing" ||
      requestState.reason === "dev-browser-missing" ||
      requestState.reason === "client-uat-but-no-session-token";
    if (!quiet) {
      console.warn(
        "Clerk authenticateRequest failed",
        requestState.status,
        requestState.reason,
        requestState.message,
      );
    }
    return null;
  }

  const auth = requestState.toAuth();
  const clerkUserId = auth.userId;
  if (!clerkUserId) return null;

  const existing = await c.env.DB.prepare(
    `SELECT id, email, password_hash, created_at, email_verified_at, clerk_user_id
     FROM users WHERE clerk_user_id = ?`,
  )
    .bind(clerkUserId)
    .first<UserRow & { email_verified_at: number | null; clerk_user_id: string | null }>();

  if (existing) {
    let emailVerified = Boolean(existing.email_verified_at);
    // Sync Clerk verification onto legacy / partial rows so magic-link users are not stuck.
    if (!emailVerified) {
      try {
        const clerkUser = await clerk.users.getUser(clerkUserId);
        const primary =
          clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId) ||
          clerkUser.emailAddresses[0];
        if (primary?.verification?.status === "verified") {
          await markEmailVerified(c.env.DB, existing.id);
          emailVerified = true;
        }
      } catch (err) {
        console.warn("Could not sync Clerk email verification", err);
      }
    }
    return {
      id: existing.id,
      email: existing.email,
      password_hash: existing.password_hash,
      created_at: existing.created_at,
      emailVerified,
    };
  }

  const clerkUser = await clerk.users.getUser(clerkUserId);
  const primary =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId) ||
    clerkUser.emailAddresses[0];
  const email = (primary?.emailAddress || "").trim().toLowerCase();
  if (!email) return null;

  const emailVerified = primary?.verification?.status === "verified";
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim();

  const byEmail = await c.env.DB.prepare(
    `SELECT id, email, password_hash, created_at, email_verified_at, clerk_user_id
     FROM users WHERE email = ?`,
  )
    .bind(email)
    .first<UserRow & { email_verified_at: number | null; clerk_user_id: string | null }>();

  if (byEmail) {
    if (byEmail.clerk_user_id && byEmail.clerk_user_id !== clerkUserId) {
      console.warn("Flap user email linked to a different Clerk id", email);
      return null;
    }
    if (!byEmail.clerk_user_id) {
      await c.env.DB.prepare("UPDATE users SET clerk_user_id = ? WHERE id = ?")
        .bind(clerkUserId, byEmail.id)
        .run();
    }
    await ensureFlapUser(
      c.env,
      {
        id: byEmail.id,
        clerkUserId,
        email,
        name,
        emailVerified,
      },
      { linkOnly: true },
    );
    return {
      id: byEmail.id,
      email: byEmail.email,
      password_hash: byEmail.password_hash,
      created_at: byEmail.created_at,
      emailVerified: emailVerified || Boolean(byEmail.email_verified_at),
    };
  }

  if (!signupOpen(c.env) && (await userCount(c.env.DB)) > 0) {
    return null;
  }

  const referral = referralFromCookieHeader(c.req.header("cookie"));
  const provisioned = await ensureFlapUser(
    c.env,
    {
      id: "", // generated inside ensureFlapUser when creating
      clerkUserId,
      email,
      name,
      emailVerified,
    },
    { referralCode: referral, createIfMissing: true },
  );

  if (!provisioned) return null;

  const row = await c.env.DB.prepare(
    `SELECT id, email, password_hash, created_at, email_verified_at FROM users WHERE id = ?`,
  )
    .bind(provisioned.id)
    .first<UserRow & { email_verified_at: number | null }>();

  if (!row) return null;
  return {
    ...row,
    emailVerified: emailVerified || Boolean(row.email_verified_at),
  };
}

/** Session required and email verified. */
export async function requireUser(c: Context<AppEnv>): Promise<UserRow | Response> {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Sign in required." }, 401);
  if (!user.emailVerified) {
    return c.json({ error: "Email not verified.", code: "EMAIL_NOT_VERIFIED" }, 403);
  }
  return user;
}
