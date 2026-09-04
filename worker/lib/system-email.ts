import { EmailMessage } from "cloudflare:email";
import { buildRawMime } from "./mime";

export function systemFrom(env: Env): string {
  const raw = (env.SYSTEM_FROM_EMAIL || "noreply@useflap.online").trim();
  return raw.includes("@") ? raw : "noreply@useflap.online";
}

export function appOrigin(env: Env): string {
  return (env.BETTER_AUTH_URL || env.APP_URL || "https://useflap.online").replace(/\/$/, "");
}

/** Extract Cloudflare Email Sending / SEB error fields for logs. */
export function formatSebError(err: unknown): { code?: string; message: string; detail: string } {
  if (err == null) return { message: "unknown error", detail: "unknown error" };
  if (typeof err === "string") return { message: err, detail: err };

  const e = err as {
    message?: unknown;
    code?: unknown;
    name?: unknown;
    cause?: unknown;
    toString?: () => string;
  };
  const code = typeof e.code === "string" && e.code ? e.code : undefined;
  const message =
    typeof e.message === "string" && e.message
      ? e.message
      : typeof e.toString === "function"
        ? e.toString()
        : String(err);
  const cause =
    e.cause != null
      ? typeof e.cause === "object" && e.cause !== null && "message" in e.cause
        ? String((e.cause as { message: unknown }).message)
        : String(e.cause)
      : undefined;
  const detail = [code ? `code=${code}` : null, message, cause ? `cause=${cause}` : null]
    .filter(Boolean)
    .join(" | ");
  return { code, message, detail };
}

/** Safe client-facing copy; never leak CF internal codes to end users. */
export function clientSebFailureMessage(code?: string): string {
  switch (code) {
    case "E_RECIPIENT_NOT_ALLOWED":
      return "Could not send email (recipient not allowed by Email Sending). Contact support if this continues.";
    case "E_SENDER_NOT_VERIFIED":
    case "E_SENDER_DOMAIN_NOT_AVAILABLE":
      return "Could not send email (sender domain not ready). Contact support.";
    case "E_RECIPIENT_SUPPRESSED":
      return "Could not send email to this address. Try another inbox or contact support.";
    default:
      return "Could not send email right now. Try again shortly, or contact support if it keeps failing.";
  }
}

export async function sendSystemEmail(
  env: Env,
  opts: { to: string; subject: string; text: string; html?: string; messageId?: string },
  // Kept for call-site compatibility; auth mail is awaited so failures surface to Better Auth.
  _execCtx?: { waitUntil?: (promise: Promise<unknown>) => void },
): Promise<{ ok: true; sent: boolean; reason?: string }> {
  if (!env.SEB) {
    console.warn("SEB missing — auth email not sent", opts.subject, opts.to.slice(0, 2) + "***");
    return { ok: true, sent: false, reason: "seb_unavailable" };
  }

  const from = systemFrom(env);
  const fromDomain = from.split("@")[1] || "useflap.online";
  const raw = buildRawMime({
    from: `Flap <${from}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    messageId: opts.messageId ?? `<${crypto.randomUUID()}@${fromDomain}>`,
  });

  try {
    // Await always — do not fire-and-forget via waitUntil. Magic-link / verify failures
    // must reach Better Auth; background send previously returned success then logged alone.
    await env.SEB.send(new EmailMessage(from, opts.to, raw));
    return { ok: true, sent: true };
  } catch (err) {
    const formatted = formatSebError(err);
    console.error(
      "system email send failed",
      JSON.stringify({
        subject: opts.subject,
        from,
        toDomain: opts.to.includes("@") ? opts.to.split("@")[1] : "?",
        seb: formatted.detail,
      }),
    );
    throw new Error(clientSebFailureMessage(formatted.code));
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
