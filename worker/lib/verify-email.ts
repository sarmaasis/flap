import { EmailMessage } from "cloudflare:email";
import { randomId, nowMs } from "./ids";
import { buildRawMime } from "./mime";
import { markEmailVerified } from "./referrals";
import { trackServerEvent } from "./analytics";

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60_000;

function systemFrom(env: Env): string {
  const raw = (env.SYSTEM_FROM_EMAIL || "noreply@useflap.online").trim();
  return raw.includes("@") ? raw : "noreply@useflap.online";
}

function appOrigin(env: Env): string {
  return (env.APP_URL || "https://useflap.online").replace(/\/$/, "");
}

export async function issueEmailVerification(
  env: Env,
  userId: string,
  email: string,
  opts?: { force?: boolean },
): Promise<{ ok: true; sent: boolean; reason?: string } | { ok: false; error: string; status: number }> {
  const user = await env.DB.prepare(
    "SELECT id, email, email_verified_at, email_verify_sent_at FROM users WHERE id = ?",
  )
    .bind(userId)
    .first<{
      id: string;
      email: string;
      email_verified_at: number | null;
      email_verify_sent_at: number | null;
    }>();
  if (!user) return { ok: false, error: "Account not found.", status: 404 };
  if (user.email_verified_at) return { ok: true, sent: false, reason: "already_verified" };

  const now = nowMs();
  if (
    !opts?.force &&
    user.email_verify_sent_at &&
    now - Number(user.email_verify_sent_at) < RESEND_COOLDOWN_MS
  ) {
    return { ok: false, error: "Wait a minute before requesting another verification email.", status: 429 };
  }

  const token = randomId("evt");
  await env.DB.prepare(
    "UPDATE users SET email_verify_token = ?, email_verify_sent_at = ? WHERE id = ?",
  )
    .bind(token, now, userId)
    .run();

  if (!env.SEB) {
    console.warn("SEB missing — verification token stored but email not sent", userId);
    return { ok: true, sent: false, reason: "seb_unavailable" };
  }

  const link = `${appOrigin(env)}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const from = systemFrom(env);
  const text = [
    "Verify your Flap account",
    "",
    `Confirm ${email} by opening this link (expires in 48 hours):`,
    link,
    "",
    "If you did not create a Flap account, you can ignore this email.",
  ].join("\n");
  const html = `<p>Verify your Flap account</p>
<p>Confirm <strong>${escapeHtml(email)}</strong> by clicking the link below (expires in 48 hours):</p>
<p><a href="${link}">Verify email</a></p>
<p style="color:#666;font-size:13px;">If you did not create a Flap account, ignore this email.</p>`;

  const raw = buildRawMime({
    from: `Flap <${from}>`,
    to: email,
    subject: "Verify your Flap email",
    text,
    html,
    messageId: `<${token}@useflap.online>`,
  });

  try {
    await env.SEB.send(new EmailMessage(from, email, raw));
    return { ok: true, sent: true };
  } catch (err) {
    console.error("verification email send failed", err);
    return { ok: true, sent: false, reason: "send_failed" };
  }
}

export async function consumeEmailVerificationToken(
  env: Env,
  token: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const trimmed = token.trim();
  if (!trimmed || trimmed.length > 80) return { ok: false, error: "Invalid verification link." };

  const row = await env.DB.prepare(
    `SELECT id, email_verified_at, email_verify_sent_at FROM users WHERE email_verify_token = ?`,
  )
    .bind(trimmed)
    .first<{ id: string; email_verified_at: number | null; email_verify_sent_at: number | null }>();

  if (!row) return { ok: false, error: "This verification link is invalid or already used." };
  if (row.email_verified_at) {
    await env.DB.prepare("UPDATE users SET email_verify_token = NULL WHERE id = ?").bind(row.id).run();
    return { ok: true, userId: row.id };
  }

  const sentAt = Number(row.email_verify_sent_at ?? 0);
  if (sentAt && nowMs() - sentAt > TOKEN_TTL_MS) {
    return { ok: false, error: "This verification link has expired. Request a new one from Settings." };
  }

  await markEmailVerified(env.DB, row.id);
  await env.DB.prepare("UPDATE users SET email_verify_token = NULL WHERE id = ?").bind(row.id).run();
  await trackServerEvent(env.DB, "email_verified", { userId: row.id });
  return { ok: true, userId: row.id };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
