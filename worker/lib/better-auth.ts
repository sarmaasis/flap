import { betterAuth, APIError } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { magicLink } from "better-auth/plugins";
import { randomId } from "./ids";
import { ensureFlapUser, referralFromCookieHeader } from "./flap-user";
import { appOrigin, sendSystemEmail } from "./system-email";
import { markEmailVerified } from "./referrals";
import {
  assertAuthEmailRateLimit,
  clientIpFromHeaders,
} from "./auth-email-rate-limit";
import {
  magicLinkEmail,
  verifyEmailContent,
} from "./auth-email-templates";

export type FlapAuth = ReturnType<typeof createAuth>;

function authSecret(env: Env): string {
  const secret = (env.BETTER_AUTH_SECRET || env.SESSION_SECRET || "").trim();
  if (secret.length < 32) {
    console.warn("BETTER_AUTH_SECRET / SESSION_SECRET should be at least 32 characters");
  }
  return secret || "dev-only-insecure-better-auth-secret!!";
}

function signupOpen(env: Env): boolean {
  return (env.SAAS_MODE || "true").toLowerCase() !== "false";
}

function requestHeaders(ctx: { request?: Request; headers?: Headers }): Headers | undefined {
  return ctx.headers ?? ctx.request?.headers;
}

/**
 * Per-request Better Auth instance (D1 binding + waitUntil for mail).
 * Product identity stays in Flap `users` with the same id as Better Auth `user.id`.
 */
export function createAuth(env: Env, execCtx?: { waitUntil?: (promise: Promise<unknown>) => void }) {
  const baseURL = appOrigin(env);

  const socialProviders: {
    google?: { clientId: string; clientSecret: string };
    github?: { clientId: string; clientSecret: string };
  } = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    socialProviders.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    };
  }

  return betterAuth({
    database: env.DB,
    baseURL,
    secret: authSecret(env),
    trustedOrigins: [baseURL],
    account: {
      // Better Auth 1.7+: explicit identity namespace (avoids issuer-compat warning)
      identityStrategy: "provider-id",
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "github"],
      },
    },
    // Password auth is off — magic link + OAuth only (public UI and APIs).
    emailAndPassword: {
      enabled: false,
    },
    emailVerification: {
      sendOnSignUp: false,
      sendOnSignIn: false,
      autoSignInAfterVerification: true,
      expiresIn: 48 * 60 * 60,
      sendVerificationEmail: async ({ user, url }, request) => {
        await assertAuthEmailRateLimit(env.DB, {
          kind: "verify_email",
          email: user.email,
          ip: clientIpFromHeaders(request?.headers ?? null),
        });
        const mail = verifyEmailContent(user.email, url);
        await sendSystemEmail(
          env,
          {
            to: user.email,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
          },
          execCtx,
        );
      },
    },
    socialProviders,
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const path = ctx.path || "";
        if (!signupOpen(env) && path === "/sign-in/magic-link") {
          const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
          if (Number(row?.n ?? 0) > 0) {
            throw new APIError("FORBIDDEN", {
              message: "Open signup is disabled. Ask an operator to enable SAAS_MODE.",
            });
          }
        }

        if (path === "/sign-in/magic-link") {
          const email = typeof ctx.body?.email === "string" ? ctx.body.email : "";
          await assertAuthEmailRateLimit(env.DB, {
            kind: "magic_link",
            email,
            ip: clientIpFromHeaders(requestHeaders(ctx)),
          });
        }
      }),
    },
    plugins: [
      magicLink({
        expiresIn: 60 * 15,
        disableSignUp: !signupOpen(env),
        // Secondary IP-ish window (Better Auth memory/DB); D1 limits above are authoritative.
        rateLimit: { window: 60 * 60, max: 10 },
        sendMagicLink: async ({ email, url }) => {
          const mail = magicLinkEmail(url);
          await sendSystemEmail(
            env,
            {
              to: email,
              subject: mail.subject,
              text: mail.text,
              html: mail.html,
            },
            execCtx,
          );
        },
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (user, ctx) => {
            const referral = referralFromCookieHeader(ctx?.headers?.get("cookie") ?? null);
            await ensureFlapUser(env, user, { referralCode: referral });
          },
        },
        update: {
          after: async (user) => {
            const email = user.email.trim().toLowerCase();
            await env.DB.prepare(
              "UPDATE users SET email = ?, name = CASE WHEN ? != '' THEN ? ELSE name END WHERE id = ?",
            )
              .bind(email, user.name || "", (user.name || "").slice(0, 120), user.id)
              .run();
            if (user.emailVerified) {
              await markEmailVerified(env.DB, user.id);
            }
          },
        },
      },
    },
    advanced: {
      database: {
        generateId: () => randomId("usr"),
      },
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
      },
    },
  });
}

export function googleConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function githubConfigured(env: Env): boolean {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}
