import { betterAuth, APIError } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { magicLink } from "better-auth/plugins";
import { randomId } from "./ids";
import { ensureFlapUser, referralFromCookieHeader } from "./flap-user";
import { appOrigin, escapeHtml, sendSystemEmail } from "./system-email";
import { markEmailVerified } from "./referrals";

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
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      sendResetPassword: async ({ user, url }) => {
        await sendSystemEmail(
          env,
          {
            to: user.email,
            subject: "Reset your Flap password",
            text: [
              "Reset your Flap password",
              "",
              "Open this link to choose a new password (expires soon):",
              url,
              "",
              "If you did not request this, you can ignore this email.",
            ].join("\n"),
            html: `<p>Reset your Flap password</p>
<p><a href="${url}">Choose a new password</a></p>
<p style="color:#666;font-size:13px;">If you did not request this, ignore this email.</p>`,
          },
          execCtx,
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendSystemEmail(
          env,
          {
            to: user.email,
            subject: "Verify your Flap email",
            text: [
              "Verify your Flap account",
              "",
              `Confirm ${user.email} by opening this link:`,
              url,
              "",
              "If you did not create a Flap account, you can ignore this email.",
            ].join("\n"),
            html: `<p>Verify your Flap account</p>
<p>Confirm <strong>${escapeHtml(user.email)}</strong> by clicking the link below:</p>
<p><a href="${url}">Verify email</a></p>
<p style="color:#666;font-size:13px;">If you did not create a Flap account, ignore this email.</p>`,
          },
          execCtx,
        );
      },
    },
    socialProviders,
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const path = ctx.path || "";
        if (!signupOpen(env) && (path === "/sign-up/email" || path === "/sign-in/magic-link")) {
          const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
          if (Number(row?.n ?? 0) > 0) {
            throw new APIError("FORBIDDEN", {
              message: "Open signup is disabled. Ask an operator to enable SAAS_MODE.",
            });
          }
        }
      }),
    },
    plugins: [
      magicLink({
        expiresIn: 60 * 15,
        disableSignUp: !signupOpen(env),
        sendMagicLink: async ({ email, url }) => {
          await sendSystemEmail(
            env,
            {
              to: email,
              subject: "Your Flap sign-in link",
              text: [
                "Sign in to Flap",
                "",
                "Open this one-time link to continue (expires in 15 minutes):",
                url,
                "",
                "If you did not request this, you can ignore this email.",
              ].join("\n"),
              html: `<p>Sign in to Flap</p>
<p><a href="${url}">Continue to Flap</a></p>
<p style="color:#666;font-size:13px;">This link expires in 15 minutes. If you did not request it, ignore this email.</p>`,
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
    },
  });
}

export function googleConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function githubConfigured(env: Env): boolean {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}
