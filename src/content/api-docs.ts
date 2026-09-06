/** Public developer docs — API send + outbound webhooks. */

export const API_DOCS = {
  path: "/docs/api",
  title: "API & webhooks | Flap",
  description:
    "Send transactional email with Flap API keys (POST /api/v1/send) and receive mail.received webhooks with signature verification.",
  updated: "2026-09-06",
  h1: "API & webhooks",
  lede: "Solo and above include API keys and inbound webhooks. Create keys and hooks in Settings → Developers, then call the HTTPS API at useflap.online.",
} as const;

export const API_SEND = {
  method: "POST",
  path: "/api/v1/send",
  auth: "Authorization: Bearer flap_…",
  body: {
    to: "required — recipient(s), comma-separated",
    subject: "required",
    text: "optional plain text body",
    html: "optional HTML body",
    from: "optional — must be one of your Flap mailboxes; defaults to oldest mailbox",
    cc: "optional",
    bcc: "optional",
  },
  success: '{ "ok": true, "id": "msg_…" }',
  notes: [
    "API keys are created in Settings → Developers. The full token is shown once.",
    "Keys are available on Solo (5), Builder (25), and Studio (100).",
    "Sends count toward your plan’s monthly outbound quota and storage limits.",
    "From addresses must belong to a mailbox on your workspace.",
  ],
} as const;

export const WEBHOOK_DOCS = {
  events: [
    {
      name: "mail.received",
      description: "Fired after inbound mail is stored for your workspace.",
    },
  ],
  headers: [
    { name: "Content-Type", value: "application/json" },
    { name: "x-flap-event", value: "Event name, e.g. mail.received" },
    { name: "x-flap-signature", value: "Hex SHA-256 of secret + '.' + raw body" },
  ],
  payloadExample: `{
  "event": "mail.received",
  "at": "2026-09-06T12:00:00.000Z",
  "id": "msg_…",
  "from": "alice@example.com",
  "to": "hello@yourdomain.com",
  "subject": "Hello",
  "folder": "inbox",
  "label": ""
}`,
  verifyNote:
    "Compute SHA-256 hex of `${secret}.${rawBody}` and compare to x-flap-signature. Use the secret shown once when you create the webhook.",
  notes: [
    "Webhook URL must be https://",
    "Subscribe to mail.received or * (all events).",
    "Delivery attempts are logged in Settings → Developers → Deliveries (last 20).",
    "Webhook slots follow plan limits (Solo 3, Builder 15, Studio 50).",
  ],
} as const;
