export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const HEADER_VALUE_RE = /^[^\r\n]*$/;

export function extractEmail(value: string): string {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return (match?.[0] ?? value).trim().toLowerCase();
}

export function extractName(value: string): string {
  const trimmed = value.trim();
  const angled = trimmed.match(/^(.*)<[^>]+>$/);
  if (angled) return angled[1].replace(/["']/g, "").trim();
  return "";
}

export function parseRecipients(value: string): string[] {
  const recipients = value.split(/[,;]/).map((recipient) => recipient.trim()).filter(Boolean);
  const emails = recipients.map(extractEmail);
  if (emails.some((recipient) => !EMAIL_RE.test(recipient))) return [];
  return [...new Set(emails)];
}

export function makeSnippet(text: string, html: string): string {
  const source = (text || stripTags(html) || "").replace(/\s+/g, " ").trim();
  return source.slice(0, 160);
}

export function stripTags(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function isNoReply(address: string): boolean {
  const email = extractEmail(address);
  return /noreply|no-reply|mailer-daemon|notifications?@|bounce@/i.test(email);
}

export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
