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

export type SanitizeEmailHtmlOptions = {
  /**
   * When false (default for privacy), rewrite remote http(s) image sources and
   * strip remote url() references from inline styles so opening mail does not
   * fetch third-party trackers. data:/cid: images remain.
   */
  allowRemoteImages?: boolean;
};

const REMOTE_SRC_RE = /^(https?:|\/\/)/i;
const STYLE_REMOTE_URL_RE = /url\s*\(\s*(['"]?)(https?:|\/\/)/gi;
const STYLE_DANGEROUS_URL_RE = /url\s*\(\s*(['"]?)(javascript:|vbscript:|data:text\/html)/gi;

/** True when a URL would trigger a third-party network fetch for images/fonts/backgrounds. */
export function isRemoteContentUrl(raw: string): boolean {
  const v = (raw || "").trim();
  if (!v) return false;
  if (/^(data:|cid:|blob:)/i.test(v)) return false;
  return REMOTE_SRC_RE.test(v);
}

function scrubStyleUrls(html: string, allowRemoteImages: boolean): string {
  return html.replace(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi, (full, _q, d, s) => {
    const val = d ?? s ?? "";
    STYLE_DANGEROUS_URL_RE.lastIndex = 0;
    STYLE_REMOTE_URL_RE.lastIndex = 0;
    const hasDanger = STYLE_DANGEROUS_URL_RE.test(val);
    STYLE_DANGEROUS_URL_RE.lastIndex = 0;
    const hasRemote = !allowRemoteImages && STYLE_REMOTE_URL_RE.test(val);
    STYLE_REMOTE_URL_RE.lastIndex = 0;
    if (!hasDanger && !hasRemote) return full;
    let scrubbed = val.replace(STYLE_DANGEROUS_URL_RE, "url($1about:blank");
    STYLE_DANGEROUS_URL_RE.lastIndex = 0;
    if (!allowRemoteImages) {
      scrubbed = scrubbed.replace(STYLE_REMOTE_URL_RE, "url($1about:blank");
      STYLE_REMOTE_URL_RE.lastIndex = 0;
    }
    const quote = d != null ? '"' : "'";
    return ` style=${quote}${scrubbed}${quote}`;
  });
}

/**
 * After DOMPurify, neutralize dangerous CSS urls and optionally remote images.
 * Idempotent and safe to run on already-sanitized HTML.
 */
export function applyRemoteImagePolicy(html: string, allowRemoteImages: boolean): string {
  if (!html) return html;
  let out = scrubStyleUrls(html, allowRemoteImages);
  if (allowRemoteImages) return out;
  // <img src="https://..."> / srcset
  out = out.replace(/<img\b[^>]*>/gi, (tag) =>
    tag.replace(/\s(src|srcset)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi, (full, attr, _q, d, s, bare) => {
      const val = d ?? s ?? bare ?? "";
      if (!isRemoteContentUrl(val) && !(attr.toLowerCase() === "srcset" && /https?:/i.test(val))) {
        return full;
      }
      return ` data-flap-blocked-${attr.toLowerCase()}=${d != null ? `"${d}"` : s != null ? `'${s}'` : bare} ${attr}=""`;
    }),
  );
  // <source src="https://...">
  out = out.replace(/<(source|video|audio|track)\b[^>]*>/gi, (tag) =>
    tag.replace(/\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi, (full, _q, d, s, bare) => {
      const val = d ?? s ?? bare ?? "";
      if (!isRemoteContentUrl(val)) return full;
      return ` src=""`;
    }),
  );
  return out;
}

export function sanitizeEmailHtml(html: string, options: SanitizeEmailHtmlOptions = {}): string {
  if (!html) return "";
  const cleaned = DOMPurify.sanitize(html, EMAIL_SANITIZE_CONFIG) as string;
  return applyRemoteImagePolicy(cleaned, options.allowRemoteImages === true);
}

/** CSP img-src for the email iframe: blocked by default; expand when user loads images. */
export function emailImageCspSrc(allowRemoteImages: boolean): string {
  return allowRemoteImages ? "img-src data: cid: https: http:" : "img-src data: cid: 'self'";
}
