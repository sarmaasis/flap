/** Build a simple RFC822 message for the send_email binding. */
export function buildRawMime(opts: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  messageId?: string;
}): string {
  const date = new Date().toUTCString();
  const messageId = opts.messageId ?? `<${crypto.randomUUID()}@inlet.local>`;
  const subject = encodeHeader(opts.subject);
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${subject}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
  ];

  if (opts.html) {
    const boundary = `inlet_${crypto.randomUUID().replace(/-/g, "")}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    return (
      headers.join("\r\n") +
      "\r\n\r\n" +
      `--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${opts.text}\r\n` +
      `--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${opts.html}\r\n` +
      `--${boundary}--\r\n`
    );
  }

  headers.push("Content-Type: text/plain; charset=utf-8");
  headers.push("Content-Transfer-Encoding: 8bit");
  return headers.join("\r\n") + "\r\n\r\n" + opts.text + "\r\n";
}

function encodeHeader(value: string): string {
  value = value.replace(/[\r\n]+/g, " ");
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const bytes = new TextEncoder().encode(value);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(bin)}?=`;
}

/** Fallback parser when postal-mime cannot run. */
export function splitHeadersBody(raw: string): {
  headers: Record<string, string>;
  text: string;
  html: string;
} {
  const norm = raw.replace(/\r\n/g, "\n");
  const idx = norm.indexOf("\n\n");
  const head = idx === -1 ? norm : norm.slice(0, idx);
  const body = idx === -1 ? "" : norm.slice(idx + 2);
  const headers: Record<string, string> = {};
  let last = "";
  for (const line of head.split("\n")) {
    if (/^[ \t]/.test(line) && last) {
      headers[last] += " " + line.trim();
      continue;
    }
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    last = line.slice(0, colon).trim().toLowerCase();
    headers[last] = line.slice(colon + 1).trim();
  }
  const ctype = (headers["content-type"] ?? "").toLowerCase();
  const html = ctype.includes("text/html") ? body : "";
  const text = html ? stripTags(html) : body;
  return { headers, text, html };
}

function stripTags(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
