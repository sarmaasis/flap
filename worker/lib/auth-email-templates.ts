import { escapeHtml } from "./system-email";

/** Flap email tokens (inline-safe; match product CTA / forest teal). */
const COLORS = {
  bg: "#f7f6f3",
  surface: "#ffffff",
  fg: "#141413",
  muted: "#5c5a55",
  cta: "#1c6e5c",
  ctaFg: "#f7f6f3",
  border: "#e5e3dc",
} as const;

export type AuthEmailContent = {
  subject: string;
  text: string;
  html: string;
};

type BuildAuthEmailOpts = {
  subject: string;
  headline: string;
  /** Short explanation under the headline. */
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  /** e.g. "This link expires in 15 minutes." */
  expiryNote: string;
  /** "If you didn’t request…" safety copy. */
  safetyLine: string;
};

/**
 * Branded Flap system email: table layout + inline CSS for client safety.
 * Always pair with the returned plaintext body.
 */
export function buildAuthEmail(opts: BuildAuthEmailOpts): AuthEmailContent {
  const url = opts.ctaUrl;
  const text = [
    opts.headline,
    "",
    opts.body,
    "",
    `${opts.ctaLabel}:`,
    url,
    "",
    opts.expiryNote,
    "",
    "Or paste this URL into your browser:",
    url,
    "",
    opts.safetyLine,
    "",
    "— Flap (useflap.online)",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(opts.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};color:${COLORS.fg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bg};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:8px;">
        <tr>
          <td style="padding:28px 28px 8px 28px;">
            <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${COLORS.cta};">Flap</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 0 28px;">
            <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;color:${COLORS.fg};">${escapeHtml(opts.headline)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 28px 0 28px;">
            <p style="margin:0;font-size:15px;line-height:1.55;color:${COLORS.muted};">${escapeHtml(opts.body)}</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:28px 28px 8px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="${COLORS.cta}" style="border-radius:6px;">
                  <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:${COLORS.ctaFg};text-decoration:none;border-radius:6px;">${escapeHtml(opts.ctaLabel)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 0 28px;">
            <p style="margin:0;font-size:13px;line-height:1.5;color:${COLORS.muted};">${escapeHtml(opts.expiryNote)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 0 28px;">
            <p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.muted};word-break:break-all;">If the button doesn’t work, paste this URL into your browser:<br/><a href="${escapeHtml(url)}" style="color:${COLORS.cta};">${escapeHtml(url)}</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 28px 28px;border-top:1px solid ${COLORS.border};">
            <p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.muted};">${escapeHtml(opts.safetyLine)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject: opts.subject, text, html };
}

export function magicLinkEmail(url: string): AuthEmailContent {
  return buildAuthEmail({
    subject: "Sign in to Flap",
    headline: "Sign in to Flap",
    body: "Use the button below to finish signing in. This one-time link works only for you.",
    ctaLabel: "Continue to Flap",
    ctaUrl: url,
    expiryNote: "This link expires in 15 minutes.",
    safetyLine: "If you didn’t request this email, you can safely ignore it — no one can sign in without this link.",
  });
}

export function verifyEmailContent(email: string, url: string): AuthEmailContent {
  return buildAuthEmail({
    subject: "Verify your Flap email",
    headline: "Verify your email",
    body: `Confirm ${email} to activate your Flap account and finish setup.`,
    ctaLabel: "Verify email",
    ctaUrl: url,
    expiryNote: "This link expires in 48 hours.",
    safetyLine: "If you didn’t create a Flap account, you can safely ignore this email.",
  });
}

export function resetPasswordEmail(url: string): AuthEmailContent {
  return buildAuthEmail({
    subject: "Reset your Flap password",
    headline: "Reset your password",
    body: "Choose a new password for your Flap account using the button below.",
    ctaLabel: "Choose a new password",
    ctaUrl: url,
    expiryNote: "This link expires soon.",
    safetyLine: "If you didn’t request a password reset, you can safely ignore this email.",
  });
}
