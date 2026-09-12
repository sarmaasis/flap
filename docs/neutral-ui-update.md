# Flap neutral UI update

This note records a neutral UI update for Flap's public and app surfaces on 7 September 2026.

## Design

Warm stone (#f8f7f4), white surfaces, and graphite actions (#353430); neutral dark mode respects the existing theme preference. Editorial serif headings distinguish the public site. A custom inbox illustration replaces the previous identity stack. Shared dashboard surfaces use a single scrollable navigation area, collapsible mail folders, larger message rows, and consistent forms and empty states. Mobile navigation exposes the public links previously hidden at small widths.

## Interactions

- Blog keyword search, tag filtering, result announcements, and reset state.
- Existing monthly/yearly pricing and capacity controls retained; corrected effective monthly amount for annual billing.
- Calendar day, week, and month layouts, date navigation, today control, and event-file download. Event files use the device time zone and import into external calendars. They do not persist to Flap or send invitations.
- Newsletter drafts use the existing rich text editor and API, with loading, error, and saved states.
- Onboarding DNS completion now requires recorded verification, not merely an added domain.
- Analytics shows real plan usage and an allowance meter, with a visible fetch error.
- Conversational AI is explicitly marked as a preview rather than presenting canned replies as live AI.

## Remaining service work

This is a UI/UX update, not a full backend expansion. Synced calendar events, free/busy, IMAP/SMTP, conversational AI, full newsletter audiences/scheduling/collaboration, and video conferencing remain incomplete in the existing service. Existing authentication, billing, email delivery, and data remain on the project's established infrastructure. Production deployment was not performed.
