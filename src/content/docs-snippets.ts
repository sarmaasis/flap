/** Shared developer snippets for public docs and in-app developer settings. */

export const SITE_API_BASE = "https://useflap.online";

export const SEND_SNIPPETS = {
  curl: `curl -X POST ${SITE_API_BASE}/api/v1/send \\
  -H "Authorization: Bearer flap_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "customer@example.com",
    "subject": "Thanks for signing up",
    "text": "Welcome to the product.",
    "html": "<p>Welcome to the product.</p>",
    "from": "hello@yourdomain.com"
  }'`,
  node: `const res = await fetch("${SITE_API_BASE}/api/v1/send", {
  method: "POST",
  headers: {
    Authorization: "Bearer flap_YOUR_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    to: "customer@example.com",
    subject: "Thanks for signing up",
    text: "Welcome to the product.",
    html: "<p>Welcome to the product.</p>",
    from: "hello@yourdomain.com",
  }),
});
const data = await res.json();
console.log(data); // { ok: true, id: "msg_…" }`,
  python: `import requests

res = requests.post(
    "${SITE_API_BASE}/api/v1/send",
    headers={"Authorization": "Bearer flap_YOUR_KEY"},
    json={
        "to": "customer@example.com",
        "subject": "Thanks for signing up",
        "text": "Welcome to the product.",
        "html": "<p>Welcome to the product.</p>",
        "from": "hello@yourdomain.com",
    },
)
print(res.json())  # {"ok": true, "id": "msg_…"}`,
} as const;

export const VERIFY_WEBHOOK_SNIPPETS = {
  node: `import { createHash } from "node:crypto";

export function verifyFlapSignature(secret, rawBody, headerSig) {
  const expected = createHash("sha256")
    .update(\`\${secret}.\${rawBody}\`, "utf8")
    .digest("hex");
  return expected === headerSig;
}

// In your handler: read the raw body string before JSON.parse
// const ok = verifyFlapSignature(process.env.FLAP_WHSEC, rawBody, req.headers["x-flap-signature"]);`,
  python: `import hashlib

def verify_flap_signature(secret: str, raw_body: str, header_sig: str) -> bool:
    expected = hashlib.sha256(f"{secret}.{raw_body}".encode("utf-8")).hexdigest()
    return expected == header_sig`,
} as const;

export const ID_PREFIXES = [
  { prefix: "msg_", meaning: "Message id" },
  { prefix: "flap_", meaning: "API key (shown once)" },
  { prefix: "dom_", meaning: "Domain id" },
  { prefix: "mbx_", meaning: "Mailbox id" },
] as const;
