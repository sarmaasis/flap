/** Public developer docs - API send + outbound webhooks. */

import { PLANS } from "../../shared/plans";

export const API_DOCS = {
  path: "/docs/api",
  title: "API overview | Flap Docs",
  description:
    "Send transactional email with Flap API keys (POST /api/v1/send). Auth, body fields, errors, and plan limits.",
  updated: "2026-09-08",
  h1: "API overview",
  lede: "Solo and above include API keys. Create keys in Settings → Developers, then call the HTTPS API at useflap.online. Webhook delivery is covered in the Webhooks guide.",
} as const;

export const API_SEND = {
  method: "POST",
  path: "/api/v1/send",
  auth: "Authorization: Bearer flap_…",
  body: {
    to: "required - recipient(s), comma-separated",
    subject: "required",
    text: "optional plain text body",
    html: "optional HTML body",
    from: "optional - must be one of your Flap mailboxes; defaults to oldest mailbox",
    cc: "optional",
    bcc: "optional",
  },
  success: '{ "ok": true, "id": "msg_…" }',
  notes: [
    "API keys are created in Settings → Developers. The full token is shown once.",
    `Keys are available on Solo (${PLANS.solo.limits.api_keys}), Pro (${PLANS.pro.limits.api_keys}), and Team (${PLANS.team.limits.api_keys}).`,
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
    `Webhook slots follow plan limits (Solo ${PLANS.solo.limits.webhooks}, Pro ${PLANS.pro.limits.webhooks}, Team ${PLANS.team.limits.webhooks}).`,
  ],
} as const;
