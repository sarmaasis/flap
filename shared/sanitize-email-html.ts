/**
 * Defense-in-depth HTML sanitizer for email bodies rendered in MessageReader.
 * Keep the iframe sandbox + CSP; this strips active content even if sandbox is loosened later.
 *
 * Uses isomorphic-dompurify (DOMPurify + jsdom in Node; browser DOMPurify in the SPA)
 * so the same export works for MessageReader and shared/tsx unit tests.
 */
import DOMPurify from "isomorphic-dompurify";

/** Tags that should never appear in rendered email HTML. */
const FORBID_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "applet",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "svg",
  "math",
  "link",
  "meta",
  "base",
  "template",
  "frame",
  "frameset",
];

const FORBID_ATTR = ["srcdoc"];

const EMAIL_SANITIZE_CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  // Standard HTML profile keeps tables, images, links, inline style, etc.
  USE_PROFILES: { html: true },
  FORBID_TAGS,
  FORBID_ATTR,
  // DOMPurify already drops on* handlers and javascript:/vbscript: URIs by default.
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

export function sanitizeEmailHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, EMAIL_SANITIZE_CONFIG);
}
