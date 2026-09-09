# AWS SES production access — paste-ready case

**You must paste this into AWS yourself.** This repo cannot open AWS Support or the SES Account dashboard.

**Do not submit until the public site is deployed** (`npm run deploy` or equivalent) and you can open the URLs below in a logged-out browser (no JS-only stubs). Confirm `https://useflap.online/how-we-send-email` returns the sending-practices page.

---

## Console / form answers

Use these fields on **SES → Account dashboard → Request production access** (or the Support case form) for **US East (N. Virginia) / `us-east-1`**. Preferred contact language: **English**.

| Field | Answer |
| --- | --- |
| Website URL | `https://useflap.online` |
| Mail type | **TRANSACTIONAL** |
| Use case | See “Use-case description (four questions)” below (paste as one block). |
| Requested sending quota | **50,000 messages per 24 hours** |
| Max send rate | Leave the typical production default (**14 messages/second**) unless the form requires a number; do not request a high TPS. |

### Use-case description (four official questions)

Paste this into the use-case / additional-information box:

```
1) How do you plan to build or acquire your mailing list, and how do you plan to send emails to recipients?

Flap (https://useflap.online) is a hosted custom-domain mailbox product for domains the customer owns or is authorized to operate. It is founder-operated (Ashish Sharma; https://useflap.online/about). Amazon SES is used for inbound and outbound customer mail on verified domains — not as a public SMTP relay or “send as anyone” API.

Recipients are acquired only from: (a) people who email the customer’s mailbox and receive replies; (b) transactional events from the customer’s own application/users (account, billing, support, purchase, and similar), sent from an authenticated workspace as a mailbox on a verified domain; (c) newsletter subscribers who complete a public signup form with double opt-in (email confirmation required before the address is active). Purchased, rented, scraped, harvested, and unsolicited lists are prohibited (https://useflap.online/acceptable-use).

2) How do you handle bounces and complaints?

Outbound sends can attach an SES configuration set. Product code implements POST https://useflap.online/api/inbound/ses/events to process send, delivery, bounce, complaint, and reject events and attribute them to the sending workspace via the SES message id. Hard bounces and complaints create workspace-scoped suppressions (tenant isolation: Workspace A never writes suppressions for Workspace B). Soft bounces expire after 72 hours. Flap suppressions are not the SES account-level suppression list. See https://useflap.online/how-we-send-email and https://useflap.online/docs/bounces-and-complaints.

We will attach (or have attached) the configuration set + SNS/HTTPS destination to that endpoint as an operator step; we are not claiming a live AWS event destination exists unless we have verified it in the SES console.

3) How can recipients opt out of receiving email?

Mailbox correspondence does not use marketing unsubscribe headers; recipients can reply or stop writing. Newsletter/marketing sends (a constrained opt-in feature, not the primary product) include List-Unsubscribe and List-Unsubscribe-Post, a token unsubscribe URL, and the customer’s physical mailing address in the footer (required before a blast can queue). Public newsletter forms require double opt-in. Abuse reports: https://useflap.online/abuse and support@useflap.online.

4) How did you choose the additional email sending rate or sending quota that you requested?

We request production access (leave sandbox) at the standard SES production default of 50,000 messages per 24 hours, with a conservative send rate (typical default ~14/sec). We are not requesting an elevated quota. Actual initial volume will be far lower (hundreds to low thousands of messages per day as paying customers onboard) and will ramp with verified workspaces. Today the account remains in sandbox. Primary mail type is TRANSACTIONAL.
```

---

## Public URLs for reviewers

- Website: https://useflap.online
- How we send email: https://useflap.online/how-we-send-email
- Acceptable use: https://useflap.online/acceptable-use
- Abuse: https://useflap.online/abuse
- Privacy: https://useflap.online/privacy
- Terms: https://useflap.online/terms
- Security: https://useflap.online/security
- About / founder: https://useflap.online/about
- Status: https://useflap.online/status
- Docs: https://useflap.online/docs
- Domain verification: https://useflap.online/docs/domain-verification
- Deliverability: https://useflap.online/docs/deliverability
- Bounces and complaints: https://useflap.online/docs/bounces-and-complaints
- Sending limits: https://useflap.online/docs/sending-limits
- Pricing: https://useflap.online/pricing

Abuse contact published: `support@useflap.online` and `/abuse` (no unpublished `abuse@` mailbox).

---

## Checklist before you click Submit

1. Deploy Worker + static assets so the URLs above are live.
2. Region **us-east-1** (N. Virginia) — same region as prior requests.
3. Contact language **English**.
4. Mail type **TRANSACTIONAL**.
5. Quota **50,000 / 24 hours**; do not invent a large TPS.
6. Optionally create the SES configuration set + SNS → `https://useflap.online/api/inbound/ses/events` and set Worker secret `SES_CONFIGURATION_SET` (see `scripts/ses-configure-events.ts`). If you have **not** done this, keep the letter’s wording that events are implemented in product code and will be attached by the operator — do not say events are already live in AWS.
7. Paste the letter below into a **new case** or a **reply** on the latest denial, whichever Support still accepts.
8. You must paste this in the AWS console. Flap tooling cannot file the case for you.

---

## Paste-ready letter (reply or new case)

Hello AWS SES Trust & Safety / Support team,

I am requesting **production access** (leave the sandbox) for Amazon SES in **US East (N. Virginia / us-east-1)** for Flap, website **https://useflap.online**.

Requested quota: **50,000 messages per 24 hours**, which is the standard SES production default — not an elevated limit. Preferred send rate: the typical production default of about **14 messages per second**. Mail type: **TRANSACTIONAL**.

This is a further request after previous production-access / sending-limit denials on this account. We respect those decisions and the need to protect sender reputation, SES deliverability, and other SES customers. We are not asking you to disclose internal security details. This letter is meant to show, with public pages and product controls, that Flap is a verified-domain mailbox product and not an open relay or anonymous blast service, and that we will operate well below the default quota while customers onboard.

**What Flap is.** Flap is a hosted custom-domain **mailbox** product: one inbox for domains the customer owns or is authorized to operate. It is founder-operated by Ashish Sharma (https://useflap.online/about). Amazon SES is used for inbound and outbound **customer** mail on those verified identities. It is not a public SMTP relay, not a “send as any From” API, and not a purchased-list ESP. System mail for useflap.online (authentication, billing) uses a separate Cloudflare Email Sending path, not customer SES identities.

**Alignment with AUP, Service Terms, and SES best practices.** Public policies are live at:

- https://useflap.online/how-we-send-email (sending practices, written for this review)
- https://useflap.online/acceptable-use
- https://useflap.online/abuse
- https://useflap.online/privacy
- https://useflap.online/terms
- https://useflap.online/security

**Recipient acquisition (no purchased lists).** Recipients come from (1) people who email the customer’s mailbox and receive replies; (2) transactional events from the customer’s own application or users; (3) newsletter subscribers via public forms that require **double opt-in**. Purchased, rented, scraped, harvested, and unsolicited lists are prohibited.

**Not an open relay.** Outbound send requires an authenticated workspace, a domain that has completed MX/SPF/Easy DKIM verification and is sending-ready (outbound is blocked until domain policy checks pass), and a From address that matches a mailbox on that workspace. Custom MAIL FROM is **not** implemented; we do not claim it.

**Bounces, complaints, and suppressions.** Product code processes SES delivery events (send, delivery, bounce, complaint, reject) at `https://useflap.online/api/inbound/ses/events`. Sends attach an SES configuration set **when the operator has configured `SES_CONFIGURATION_SET`**. Hard bounces and complaints create **workspace-scoped** suppressions; soft bounces expire after 72 hours. Empty Flap suppressions are not equivalent to SES account-level suppression. We will suspend abusive tenants (domain/workspace send status, including operator `POST /api/ops/workspace-send`) to protect SES reputation.

**Opt-out.** Mailbox correspondence is not a marketing list. Newsletter sends include List-Unsubscribe / one-click unsubscribe, a token URL, and a physical mailing address in the footer.

**Volume.** The account is in the sandbox today. We request the **standard** 50,000 / 24-hour production quota so legitimate mailbox and transactional mail is not blocked. **Actual** initial volume will be hundreds to low thousands of messages per day as paying customers onboard — not a burst to 50k. We will increase gradually with verified workspaces and plan-level monthly send caps.

**Why this should not harm other SES customers.** Sending is gated per tenant; lists are relationship-based; marketing is a constrained opt-in feature; bounce/complaint handling and suspension exist in product code; abuse is staffed at support@useflap.online and /abuse. Approving the default production quota lets us send ordinary business mail at low volume without implying we will consume that quota on day one.

We are happy to answer follow-up questions or walk through domain verification, event handling, or a specific tenant control. Thank you for reconsidering production access.

Ashish Sharma  
Founder, Flap  
https://useflap.online  
support@useflap.online

---

## Honesty notes (do not contradict in AWS)

- Do **not** claim custom MAIL FROM.
- Do **not** claim SES configuration set + SNS is live unless you verified it in the AWS console and Worker secret.
- Do **not** invent current send volume, testimonials, or customer counts.
- Do **not** invent an `abuse@` address.
- Do **not** change or quote invented plan numeric limits in the case; plans live in `shared/plans.ts`.
