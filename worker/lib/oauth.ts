import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { createSession } from "./auth";
import { ensureSubscription } from "./billing";
import { randomId, nowMs } from "./ids";
import { acceptInvite, ensureOwnerMembership } from "./team";
import { attributeReferral, ensureReferralCode, markEmailVerified } from "./referrals";

type AppEnv = { Bindings: Env };

const STATE_TTL_MS = 15 * 60 * 1000;

export function googleConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function githubConfigured(env: Env): boolean {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}

function appOrigin(c: Context<AppEnv>): string {
  return (c.env.APP_URL || new URL(c.req.url).origin).replace(/\/$/, "");
}

function callbackUrl(c: Context<AppEnv>, provider: "google" | "github"): string {
  return `${appOrigin(c)}/api/auth/${provider}/callback`;
}

async function saveState(
  db: D1Database,
  provider: string,
  redirectTo: string,
  inviteToken?: string,
): Promise<string> {
  const state = randomId("oas");
  const now = nowMs();
  await db
    .prepare(
      `INSERT INTO oauth_states (state, provider, redirect_to, invite_token, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(state, provider, redirectTo.slice(0, 200), inviteToken || null, now + STATE_TTL_MS, now)
    .run();
  return state;
}

async function consumeState(db: D1Database, state: string, provider: string) {
  const row = await db
    .prepare(
      `SELECT state, redirect_to, invite_token, expires_at FROM oauth_states
       WHERE state = ? AND provider = ?`,
    )
    .bind(state, provider)
    .first<{ state: string; redirect_to: string; invite_token: string | null; expires_at: number }>();
  if (row) {
    await db.prepare("DELETE FROM oauth_states WHERE state = ?").bind(state).run();
  }
  if (!row || row.expires_at < nowMs()) return null;
  return row;
}

export async function startGoogleOAuth(
  c: Context<AppEnv>,
  opts: { redirectTo?: string; inviteToken?: string } = {},
): Promise<Response> {
  if (!googleConfigured(c.env)) {
    return c.json({ error: "Google sign-in is not configured." }, 503);
  }
  const redirectTo = safeRedirect(opts.redirectTo || "/app");
  const state = await saveState(c.env.DB, "google", redirectTo, opts.inviteToken);
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl(c, "google"),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

export async function handleGoogleCallback(c: Context<AppEnv>): Promise<Response> {
  if (!googleConfigured(c.env)) {
    return c.redirect("/login?error=oauth_not_configured");
  }
  const url = new URL(c.req.url);
  const err = url.searchParams.get("error");
  if (err) return c.redirect(`/login?error=${encodeURIComponent(err)}`);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return c.redirect("/login?error=missing_code");

  const saved = await consumeState(c.env.DB, state, "google");
  if (!saved) return c.redirect("/login?error=invalid_state");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID!,
      client_secret: c.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl(c, "google"),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    console.error("Google token exchange failed", await tokenRes.text());
    return c.redirect("/login?error=token_exchange");
  }
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return c.redirect("/login?error=token_exchange");

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) {
    console.error("Google profile failed", await profileRes.text());
    return c.redirect("/login?error=profile");
  }
  const profile = (await profileRes.json()) as {
    id?: string;
    email?: string;
    name?: string;
    verified_email?: boolean;
  };
  if (!profile.id || !profile.email) return c.redirect("/login?error=profile");

  const userId = await upsertOAuthUser(c.env.DB, {
    provider: "google",
    providerUserId: profile.id,
    email: profile.email.toLowerCase(),
    name: (profile.name || "").slice(0, 120),
    referralCode: getCookie(c, "flap_ref") || undefined,
  });

  await createSession(c, userId);

  if (saved.invite_token) {
    const accepted = await acceptInvite(c.env.DB, saved.invite_token, userId);
    if (accepted.ok) {
      return c.redirect(`/app/settings?tab=team&joined=1`);
    }
  }

  return c.redirect(saved.redirect_to || "/app");
}

export async function startGitHubOAuth(
  c: Context<AppEnv>,
  opts: { redirectTo?: string; inviteToken?: string } = {},
): Promise<Response> {
  if (!githubConfigured(c.env)) {
    return c.json({ error: "GitHub sign-in is not configured." }, 503);
  }
  const redirectTo = safeRedirect(opts.redirectTo || "/app");
  const state = await saveState(c.env.DB, "github", redirectTo, opts.inviteToken);
  const params = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID!,
    redirect_uri: callbackUrl(c, "github"),
    scope: "read:user user:email",
    state,
  });
  return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
}

export async function handleGitHubCallback(c: Context<AppEnv>): Promise<Response> {
  if (!githubConfigured(c.env)) {
    return c.redirect("/login?error=oauth_not_configured");
  }
  const url = new URL(c.req.url);
  const err = url.searchParams.get("error");
  if (err) return c.redirect(`/login?error=${encodeURIComponent(err)}`);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return c.redirect("/login?error=missing_code");

  const saved = await consumeState(c.env.DB, state, "github");
  if (!saved) return c.redirect("/login?error=invalid_state");

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl(c, "github"),
    }),
  });
  if (!tokenRes.ok) {
    console.error("GitHub token exchange failed", await tokenRes.text());
    return c.redirect("/login?error=token_exchange");
  }
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return c.redirect("/login?error=token_exchange");

  const [userRes, emailsRes] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Flap-OAuth",
      },
    }),
    fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Flap-OAuth",
      },
    }),
  ]);
  if (!userRes.ok) {
    console.error("GitHub profile failed", await userRes.text());
    return c.redirect("/login?error=profile");
  }
  const profile = (await userRes.json()) as { id?: number; email?: string | null; name?: string | null; login?: string };
  let email = (profile.email || "").toLowerCase();
  if (!email && emailsRes.ok) {
    const emails = (await emailsRes.json()) as { email: string; primary: boolean; verified: boolean }[];
    const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified);
    email = (primary?.email || "").toLowerCase();
  }
  if (!profile.id || !email) return c.redirect("/login?error=profile");

  const userId = await upsertOAuthUser(c.env.DB, {
    provider: "github",
    providerUserId: String(profile.id),
    email,
    name: (profile.name || profile.login || "").slice(0, 120),
    referralCode: getCookie(c, "flap_ref") || undefined,
  });

  await createSession(c, userId);

  if (saved.invite_token) {
    const accepted = await acceptInvite(c.env.DB, saved.invite_token, userId);
    if (accepted.ok) {
      return c.redirect(`/app/settings?tab=team&joined=1`);
    }
  }

  return c.redirect(saved.redirect_to || "/app");
}

async function upsertOAuthUser(
  db: D1Database,
  input: { provider: string; providerUserId: string; email: string; name: string; referralCode?: string },
): Promise<string> {
  const linked = await db
    .prepare(
      `SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?`,
    )
    .bind(input.provider, input.providerUserId)
    .first<{ user_id: string }>();
  if (linked) return linked.user_id;

  const existing = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(input.email)
    .first<{ id: string }>();

  let userId = existing?.id;
  const now = nowMs();
  let created = false;
  if (!userId) {
    userId = randomId("usr");
    created = true;
    // OAuth-only users: empty password_hash (password login rejected)
    await db
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at, name, plan_id)
         VALUES (?, ?, '', ?, ?, 'free')`,
      )
      .bind(userId, input.email, now, input.name)
      .run();
    await ensureSubscription(db, userId);
    await ensureOwnerMembership(db, userId);
  }

  await markEmailVerified(db, userId);
  await ensureReferralCode(db, userId);

  if (created && input.referralCode) {
    await attributeReferral(db, userId, input.email, input.referralCode);
  }

  await db
    .prepare(
      `INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, email, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(randomId("oa"), userId, input.provider, input.providerUserId, input.email, now)
    .run();

  return userId;
}

function safeRedirect(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return "/app";
  return path.slice(0, 200);
}
