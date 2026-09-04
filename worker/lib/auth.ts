import type { Context } from "hono";
import { createAuth } from "./better-auth";
import { ensureFlapUser } from "./flap-user";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: number;
};

export type SessionUser = UserRow & {
  /** Better Auth `user.emailVerified` — source of truth for /app access. */
  emailVerified: boolean;
};

type AppEnv = { Bindings: Env };

export async function userCount(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/**
 * Resolve the Flap product user from the Better Auth session cookie.
 * Lazily provisions `users` (workspace id === auth user id) when missing.
 * Does not enforce email verification (use `requireUser` for product APIs).
 */
export async function getSessionUser(c: Context<AppEnv>): Promise<SessionUser | null> {
  const auth = createAuth(c.env, c.executionCtx);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return null;

  const emailVerified = Boolean(session.user.emailVerified);

  await ensureFlapUser(c.env, {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    emailVerified,
  });

  const row = await c.env.DB.prepare(
    `SELECT id, email, password_hash, created_at FROM users WHERE id = ?`,
  )
    .bind(session.user.id)
    .first<UserRow>();

  if (row) return { ...row, emailVerified };

  // Rare: email matched an older Flap row with a different id during migration edge cases.
  const byEmail = await c.env.DB.prepare(
    `SELECT id, email, password_hash, created_at FROM users WHERE email = ?`,
  )
    .bind(session.user.email.trim().toLowerCase())
    .first<UserRow>();
  return byEmail ? { ...byEmail, emailVerified } : null;
}

/** Session required and email verified (blocks password signup before verify). */
export async function requireUser(c: Context<AppEnv>): Promise<UserRow | Response> {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Sign in required." }, 401);
  if (!user.emailVerified) {
    return c.json(
      { error: "Email not verified.", code: "EMAIL_NOT_VERIFIED" },
      403,
    );
  }
  return user;
}

/** @deprecated Prefer Better Auth signOut — kept for thin /api/logout wrapper. */
export async function destroySession(c: Context<AppEnv>): Promise<void> {
  const auth = createAuth(c.env, c.executionCtx);
  await auth.api.signOut({ headers: c.req.raw.headers });
}
