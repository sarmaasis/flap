/** Build a simple RFC822 message for the send_email binding. */
export function buildRawMime(opts: {
  from: string;
  to: string;
  cc?: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{ filename: string; contentType: string; content: Uint8Array }>;
  messageId?: string;
  inReplyTo?: string;
}): string {
  const date = new Date().toUTCString();
  const messageId = opts.messageId ?? `<${crypto.randomUUID()}@flap.local>`;
  const subject = encodeHeader(opts.subject);
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
    `Subject: ${subject}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    ...(opts.inReplyTo ? [`In-Reply-To: ${opts.inReplyTo}`, `References: ${opts.inReplyTo}`] : []),
    "MIME-Version: 1.0",
  ];

  if (opts.attachments?.length) {
    const mixedBoundary = `flap_mixed_${crypto.randomUUID().replace(/-/g, "")}`;
    const alternative = buildAlternative(opts, `flap_alt_${crypto.randomUUID().replace(/-/g, "")}`);
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    const attachments = opts.attachments.map((attachment) => {
      const filename = safeMimeFilename(attachment.filename);
      return `--${mixedBoundary}\r\nContent-Type: ${safeContentType(attachment.contentType)}; name="${filename}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${filename}"\r\n\r\n${toBase64Lines(attachment.content)}\r\n`;
    }).join("");
    return `${headers.join("\r\n")}\r\n\r\n--${mixedBoundary}\r\n${alternative}\r\n${attachments}--${mixedBoundary}--\r\n`;
  }

  if (opts.html) {
    const boundary = `flap_${crypto.randomUUID().replace(/-/g, "")}`;
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

function buildAlternative(opts: { text: string; html?: string }, boundary: string): string {
  if (!opts.html) return "Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n" + opts.text;
  return `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n` +
    `--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${opts.text}\r\n` +
    `--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${opts.html}\r\n` +
    `--${boundary}--`;
}

function safeMimeFilename(value: string): string {
  return value.replace(/[\r\n"\\]/g, "_").slice(0, 160) || "attachment";
}

function safeContentType(value: string): string {
  return /^[\w.+-]+\/[\w.+-]+$/.test(value) ? value : "application/octet-stream";
}

function toBase64Lines(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/.{1,76}/g, "$&\r\n").trimEnd();
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
