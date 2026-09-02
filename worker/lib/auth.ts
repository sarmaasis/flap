import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import { randomId, nowMs } from "./ids";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: number;
};

type AppEnv = { Bindings: Env };

const COOKIE = "inlet_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export async function userCount(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  return Number(row?.n ?? 0);
}

export async function createSession(c: Context<AppEnv>, userId: string): Promise<void> {
  const id = randomId("ses");
  const now = nowMs();
  await c.env.DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(id, userId, now + SESSION_MS, now)
    .run();
  setCookie(c, COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: isSecure(c),
    maxAge: Math.floor(SESSION_MS / 1000),
  });
}

export async function destroySession(c: Context<AppEnv>): Promise<void> {
  const id = getCookie(c, COOKIE);
  if (id) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
  }
  deleteCookie(c, COOKIE, { path: "/" });
}

export async function getSessionUser(c: Context<AppEnv>): Promise<UserRow | null> {
  const id = getCookie(c, COOKIE);
  if (!id) return null;
  const now = nowMs();
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.password_hash, u.created_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`,
  )
    .bind(id, now)
    .first<UserRow>();
  return row ?? null;
}

export async function requireUser(c: Context<AppEnv>): Promise<UserRow | Response> {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Sign in required." }, 401);
  return user;
}

function isSecure(c: Context<AppEnv>): boolean {
  const url = new URL(c.req.url);
  return url.protocol === "https:";
}
