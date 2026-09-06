# Shipmail-inspired redesign — parity matrix

**Branch:** `feat/shipmail-inspired-redesign`  
**Date:** 2026-09-07  
**PRD:** `docs/shipmail-redesign.md`

| Area | Status | Notes |
|------|--------|-------|
| Paper/orange/ink tokens + Inter/JetBrains Mono | **Shipped** | `src/index.css`, `index.html`, manifest |
| Logo mark uses orange flap | **Shipped** | CSS vars `--mark-flap` |
| Pricing Solo $5 / Pro $12 / Team $29 / Scale | **Shipped** | `shared/plans.ts`; Free keeps 2 mailboxes |
| Annual = 10× monthly | **Shipped** | |
| Pricing Monthly\|Annual toggle + Scale slider | **Shipped** | `/pricing` |
| Dodo docs + legacy builder/studio map | **Shipped** | `docs/dodo-billing.md` |
| Landing / marketing positioning | **Shipped** | Shipmail-shaped, Flap-owned |
| `/security` | **Shipped** | Honest SES/CF |
| `/for` + P0 ICP pages | **Shipped** | 7 pages |
| `/vs` + P0 comps incl. Shipmail | **Shipped** | 10 pages |
| `/research` cost table | **Shipped** | |
| Shared inboxes / seats (Team/Pro) | **Partial** | Existing team + assignment APIs; gates → Pro/Team |
| From-lock + domain colors | **Partial** | Existing product features retained |
| Cmd+K / keyboard triage | **Partial** | Existing |
| Rules / scheduled send / undo send | **Shipped** | Existing SES path |
| AI draft/summarize confirm-only | **Partial** | Existing `/api/ai` + Settings opt-in |
| Webhooks signed + delivery log | **Partial** | Existing hardening |
| Export / 30-day trust copy | **Shipped** | Settings + trust API |
| IMAP/SMTP/JMAP | **Partial** | Stubs + dated decision doc; not Connected |
| CalDAV/CardDAV | **Partial** | Booking UI/API stubs |
| Booking pages | **Partial** | `/book/:slug` + tables |
| Newsletters | **Partial** | List/API + one-shot caps; not full editor ESP |
| TS/Python SDKs + CLI | **Partial** | Thin packages under `sdks/` |
| MCP | **Partial** | Existing `/api/mcp` light |
| Magic-link auth polish | **Partial** | Existing Better Auth flow retained |
| Full IMAP server | **Deferred** | Target 2026-10-15 |
| Full newsletters collaboration | **Deferred** | P1/P2 |
| OpenPGP at-rest | **Deferred** | |
| Cold outbound / warmup | **Deferred / won't** | Explicit non-goal |

Legend: **Shipped** usable now · **Partial** UI/API/docs honest path · **Deferred** follow-up.
