export function fmtDate(ms: number) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
    hour: sameYear ? "numeric" : undefined,
    minute: sameYear ? "2-digit" : undefined,
  });
}

export function senderName(address: string) {
  const angled = address.match(/^(.*)<[^>]+>$/);
  if (angled?.[1]?.trim()) return angled[1].replace(/["']/g, "").trim();
  const local = address.split("@")[0]?.replace(/[._-]/g, " ") || "Unknown";
  return local;
}

export function initials(address: string) {
  const name = senderName(address).trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export function extractEmail(value: string) {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return (match?.[0] ?? value).trim();
}

export function quoteHtml(from: string, dateMs: number, html: string, text: string) {
  const when = new Date(dateMs).toLocaleString();
  const inner = html || `<pre>${escapeHtml(text)}</pre>`;
  return `<p></p><blockquote class="inlet-quote"><p>On ${escapeHtml(when)}, ${escapeHtml(from)} wrote:</p>${inner}</blockquote>`;
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

export function htmlToText(html: string) {
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]+>/g, " ").trim();
  return new DOMParser().parseFromString(html, "text/html").body.textContent?.replace(/\s+/g, " ").trim() ?? "";
}
