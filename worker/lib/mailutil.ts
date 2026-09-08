export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_FIND_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
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

/** Strip trailing commas / semicolons left by autocomplete (e.g. "a@b.com, "). */
export function normalizeRecipientField(value: string): string {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[,;\s]+$/g, "")
    .trim();
}

export function parseRecipients(value: string): string[] {
  const normalized = normalizeRecipientField(value);
  if (!normalized) return [];
  // Extract emails with a finder so trailing commas, display names, and light junk don't wipe the list.
  const found = normalized.match(EMAIL_FIND_RE) || [];
  return [...new Set(found.map((email) => email.toLowerCase()).filter((email) => EMAIL_RE.test(email)))];
}

/** Empty fields are fine; non-empty fields must yield at least one valid address and no leftover address-like junk. */
export function recipientsFieldValid(value: string): boolean {
  const normalized = normalizeRecipientField(value);
  if (!normalized) return true;
  const parsed = parseRecipients(normalized);
  if (!parsed.length) return false;
  // Reject tokens that look like attempts at an email but failed to parse (e.g. "foo@", "bar.com").
  const tokens = normalized.split(/[,;，；]+/).map((token) => token.trim()).filter(Boolean);
  return tokens.every((token) => {
    if (!/[.@]/.test(token)) return true; // display-name fragment without @/. is ok beside angled addresses
    return EMAIL_RE.test(extractEmail(token));
  });
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
