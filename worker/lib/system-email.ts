import { EmailMessage } from "cloudflare:email";
import { buildRawMime } from "./mime";

export function systemFrom(env: Env): string {
  const raw = (env.SYSTEM_FROM_EMAIL || "noreply@useflap.online").trim();
  return raw.includes("@") ? raw : "noreply@useflap.online";
}

export function appOrigin(env: Env): string {
  return (env.BETTER_AUTH_URL || env.APP_URL || "https://useflap.online").replace(/\/$/, "");
}

export async function sendSystemEmail(
  env: Env,
  opts: { to: string; subject: string; text: string; html?: string; messageId?: string },
  execCtx?: { waitUntil?: (promise: Promise<unknown>) => void },
): Promise<{ ok: true; sent: boolean; reason?: string }> {
  if (!env.SEB) {
    console.warn("SEB missing — auth email not sent", opts.subject, opts.to.slice(0, 2) + "***");
    return { ok: true, sent: false, reason: "seb_unavailable" };
  }

  const from = systemFrom(env);
  const raw = buildRawMime({
    from: `Flap <${from}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    messageId: opts.messageId,
  });

  const send = async () => {
    try {
      await env.SEB!.send(new EmailMessage(from, opts.to, raw));
    } catch (err) {
      console.error("system email send failed", opts.subject, err);
    }
  };

  if (execCtx?.waitUntil) {
    execCtx.waitUntil(send());
    return { ok: true, sent: true };
  }
  await send();
  return { ok: true, sent: true };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
