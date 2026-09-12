# IMAP / SMTP / JMAP decision

**Status:** Partial (UI + docs stubs) / protocol stack deferred  
**Publish / target date:** **2026-10-15**  
**Updated:** 2026-09-07

## Decision

Do not market IMAP, SMTP, JMAP, CalDAV, or CardDAV as **Connected** until credentials issue and protocol servers exist.

Until then:

- Supported clients: Flap web inbox + installable PWA
- Settings → Privacy / Clients shows connection hostnames as **scheduled**, with target date
- `GET /api/mailboxes/:id/client-credentials` returns honest stubs (no fake passwords)
- Homepage and pricing do not claim Apple Mail / Thunderbird live support
- CalDAV/CardDAV: booking page + API stubs only; live free/busy later
- JMAP: evaluate after IMAP MVP (may slip to later)

## When shipping (Pro+)

1. App passwords per mailbox identity (hashed at rest)
2. Docs for Apple Mail / Outlook / Thunderbird
3. Rate limits + lockout on auth spray
4. Flip marketing copy only after a real round-trip test

## Why Partial in this redesign

A full IMAP/JMAP stack on Workers is heavy. Flap keeps SES-backed webmail primary and stays honest about the dated path until protocol credentials and servers pass real client tests.
