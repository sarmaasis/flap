import type { Context } from "hono";
import { createAuth } from "./better-auth";
import { ensureFlapUser } from "./flap-user";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: number;
};

type AppEnv = { Bindings: Env };

export async function userCount(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/**
 * Resolve the Flap product user from the Better Auth session cookie.
 * Lazily provisions `users` (workspace id === auth user id) when missing.
 */
export async function getSessionUser(c: Context<AppEnv>): Promise<UserRow | null> {
  const auth = createAuth(c.env, c.executionCtx);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return null;

  await ensureFlapUser(c.env, {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    emailVerified: Boolean(session.user.emailVerified),
  });

  const row = await c.env.DB.prepare(
    `SELECT id, email, password_hash, created_at FROM users WHERE id = ?`,
  )
    .bind(session.user.id)
    .first<UserRow>();

  if (row) return row;

  // Rare: email matched an older Flap row with a different id during migration edge cases.
  const byEmail = await c.env.DB.prepare(
    `SELECT id, email, password_hash, created_at FROM users WHERE email = ?`,
  )
    .bind(session.user.email.trim().toLowerCase())
    .first<UserRow>();
  return byEmail ?? null;
}

export async function requireUser(c: Context<AppEnv>): Promise<UserRow | Response> {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Sign in required." }, 401);
  return user;
}

/** @deprecated Prefer Better Auth signOut — kept for thin /api/logout wrapper. */
export async function destroySession(c: Context<AppEnv>): Promise<void> {
  const auth = createAuth(c.env, c.executionCtx);
  await auth.api.signOut({ headers: c.req.raw.headers });
}
