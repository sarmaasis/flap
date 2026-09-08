/** Shared recipient-field helpers for compose UI (mirrors worker/lib/mailutil). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_FIND_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function normalizeRecipientField(value: string): string {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[,;\s]+$/g, "")
    .trim();
}

export function parseRecipientEmails(value: string): string[] {
  const normalized = normalizeRecipientField(value);
  if (!normalized) return [];
  const found = normalized.match(EMAIL_FIND_RE) || [];
  return [...new Set(found.map((email) => email.toLowerCase()).filter((email) => EMAIL_RE.test(email)))];
}
