# Flap Visual System & Feature Parity Specification

**Document type:** Implementation specification
**Target implementer:** Grok (autonomous coding agent)
**Repository:** `/Users/sarmaasis/Work/projects/flap`
**Reference product:** [shipmail.to](https://shipmail.to) — public site and authenticated dashboard
**Date:** 2026-09-08
**Status:** Ready to implement

---

## 0. How to use this document

This is a **build specification**, not a discussion document. Every value in Sections 2–7 was measured directly from the live shipmail.to DOM via Chrome DevTools Protocol (`getComputedStyle` and stylesheet introspection), not estimated from screenshots. Where a value is inferred rather than measured, it is marked **(inferred)**.

**Rules of engagement:**

1. **Do not copy shipmail's markup, assets, copy, or logo.** This specification describes a *design system* — token values, spatial rhythm, component anatomy, interaction patterns. Reproduce the system, write your own components and copy. Colour values and layout metrics are not protectable; verbatim marketing copy and brand assets are.
2. **Token-first.** No hardcoded colour may be introduced in any component. If you need a colour that is not in Section 2, stop and add it to the token layer first.
3. **Phased delivery.** Section 10 defines phase boundaries. Each phase must leave `npm run check` passing and the app usable. Do not begin a phase before the previous one is complete.
4. **This document supersedes** the visual portions of `docs/shipmail-redesign.md` (which is a positioning/product PRD written from public pages only, before dashboard access). Where they conflict on colour, type, or layout, **this document wins**. Where `shipmail-redesign.md` covers positioning and pricing strategy, it remains authoritative.

---

## 1. Diagnosis: why the current UI reads as "basic"

Before prescribing, the root causes. These are factual observations from `src/index.css`.

### 1.1 There is no accent colour

This is the single largest problem.

```
src/index.css:3666    --cta: #353430;    /* effective light value */
src/index.css:24      --orange: #353430; /* dead Gen-1 block, but the name is a lie */
```

`#353430` is HSL(45°, 5%, 20%) — a **desaturated charcoal at five percent saturation**. Every primary button, active state, link, and focus ring in the light theme resolves to a near-black warm grey. The variable *named* `--orange` holds the same grey.

The consequence: the interface has no visual hierarchy of *action*. A "Save event" button, a table header, and body text all sit within a narrow band of warm greys. Nothing draws the eye, so everything reads as equally unimportant — which the eye interprets as "unstyled".

In dark mode the problem takes a different form: `--cta` **inverts** to `#e0ddd3` (a bone white) while `--danger`, `--warn`, and `--ok` do *not* invert. Button-versus-status contrast relationships therefore differ between the two themes.

Shipmail's accent is `#F26522`, a saturated vermilion at HSL(20°, 89%, 54%), constant across both themes. It covers roughly 5% of pixels and carries 100% of the "click here" signal.

**This one change accounts for most of the perceived quality gap.**

### 1.2 Three generations of tokens coexist; only the last one is live

`src/index.css` is 4,161 lines and contains **three complete, chronologically layered redefinitions of the same token set**. Because they use equal-specificity selectors, only the last wins — the earlier two are dead code that still reads as authoritative.

| Generation | Selector | Lines | Live? |
|---|---|---|---|
| Gen 1 "paper/ink" | `:root` | 20–66 | Only for props not redefined later |
| Gen 2 "dark app chrome" | `.app-shell` | 3521–3535 | **No** — all 11 props overridden at 3751 |
| Gen 3 "warm neutral" | `:root` @3664, `.app-shell` @3751, `html.dark…` @3752 | 3664–3771 | **Yes** |

**Read line 3664 before touching anything.** The values at the top of the file are not what ships. This trap is the reason Section 2.6's migration map is keyed to *effective* values rather than the ones you will find first.

A fourth, narrower block at lines 2884–2912 targets `html.dark .landing-root` and **force-lights the entire marketing site**, so marketing pages ignore dark mode. A user crossing from `/app` to `/pricing` in dark mode gets an unannounced theme flip. Section 6 fixes this.

Several tokens are also **dark-mode leaks** — never redefined for dark, so light values apply on a `#20211f` background: `--accent-2` (`#141211`, a near-black used as an accent), `--accent-2-rgb`, `--warn-rgb`, `--danger-rgb`, `--paper`, `--ink`, `--orange`.

### 1.3 Two styling systems compete, and one has no bridge to the tokens

Tailwind v4 is wired through `@tailwindcss/vite`, but there is **no `tailwind.config.js`**. Configuration lives entirely in the `@theme` block at the top of `index.css`, which defines only three font families and two accordion animations.

**Tailwind's default palette is therefore fully live and completely disjoint from the CSS-variable token system.** Every `text-neutral-500`, `bg-white`, or `border-neutral-200` resolves outside the token layer and is inert in dark mode. The split runs roughly *marketing = Tailwind* (`Landing.tsx` has ~307 utility tokens), *app = bespoke class names* (`.mail-*`, `.cal-*`, `.side-nav`), with `Settings.tsx` and `MessageReader.tsx` straddling both.

Three consequences to fix in Phase 1:

1. **40 `!important` declarations** in `index.css`, most added to beat Tailwind utilities or shadcn defaults.
2. **A bare element selector overrides a primitive.** `label { text-transform: uppercase; letter-spacing: .08em; font-size: 11px }` at `index.css:396` makes **every** shadcn `<Label>` uppercase regardless of props. The primitive cannot be used at normal case anywhere in the app.
3. **Radius is 60% untokenized** — 77 hardcoded `border-radius` declarations against 33 using `var(--radius)`, including a literal `10px` that duplicates the token. Four different focus-ring recipes coexist.

### 1.4 Shallow surface hierarchy

Light theme has four levels — `--bg` `#f8f7f4`, `--bg-elevated` `#fff`, `--surface` `#fff`, `--surface-2` `#eeece7` — but `--bg-elevated` and `--surface` are **the same colour**, so it is effectively three. Shipmail runs six: `surface`, `surface-raised`, `surface-overlay`, `surface-hover`, `surface-active`, `surface-input`.

The missing levels are the interaction states. Without `hover`, `active`, and `input` as distinct surfaces you cannot express "this card sits on that panel, and this input sits inside the card," so depth collapses.

### 1.5 Two hardcoded-colour bugs worth fixing in Phase 1

- **`.err { color: #f5b4b8 }`** — a pale pink chosen for a dark background, applied unconditionally. Against `--surface: #fff` that is roughly **1.6:1**, so the app's primary error affordance is effectively unreadable in light mode. This is a live accessibility failure, not a polish item.
- **`emailSrcDoc()`** in `MessageReader.tsx` injects hardcoded hex into the sandboxed `srcDoc`, so rendered email bodies never follow the theme. Route those through the token set.

Also note `DOMAIN_COLORS` in `worker/lib/product-features.ts:14` — eight hex values persisted **server-side to D1** per label. **`DOMAIN_COLORS[0]` is already `#F26522`**, the same value as the new global accent. Promoting that colour to `--accent` will make the first domain's chip indistinguishable from accent UI. In Phase 1 leave the array alone; in Phase 4/5 rotate the palette so no domain colour equals `--accent` (swap index 0 for another hue) without a D1 data migration if chips are computed at render time from domain id hash — if they are stored per-row, migrate carefully.

### 1.6 Page headers consume too much vertical space

`AppFeaturePage` renders a large title block and has **no tabs slot**, so `Settings.tsx` and `AiAssistantPage.tsx` render their tab bars inside `children`, below the header band. Those two pages therefore have a visually different header stack from the other nine.

Shipmail's equivalent is a single 56px row: H1 at 20px inline with its action buttons, subtitle at 13px beneath. On a 1080p laptop the difference is roughly 80px of content per page.

---

## 2. Colour tokens

All values measured from shipmail.to. The system is **dual-theme with a shared accent**: the accent does not change between light and dark.

### 2.1 Light theme (`:root`)

| Token | Value | Role |
|---|---|---|
| `--surface` | `#faf9f6` | Page background. Warm off-white, not pure white. |
| `--surface-raised` | `#ffffff` | Cards, panels sitting on the page. |
| `--surface-overlay` | `#ffffff` | Modals, popovers, dropdowns. |
| `--surface-hover` | `#f0ede6` | Row/button hover. |
| `--surface-active` | `#ebe9e4` | Pressed state, selected row. |
| `--surface-input` | `#f5f4f1` | Text input interior fill. |
| `--foreground` | `#141211` | Primary text. Near-black, warm-biased. |
| `--foreground-muted` | `#64615a` | Secondary text, descriptions. |
| `--foreground-faint` | `#7a756d` | Micro-labels, timestamps, placeholders. |
| `--foreground-disabled` | `#c4c0b8` | Disabled text and icons. |
| `--line` | `#e2dfd8` | Default hairline borders and dividers. |
| `--line-strong` | `#cbc7be` | Input borders, emphasised dividers. |
| `--success-text` | `#047857` | |
| `--error-text` | `#b91c1c` | |
| `--warning-text` | `#92400e` | |

### 2.2 Dark theme (`.dark`)

Applied by adding class `dark` to `<html>`. Note the near-black `#050505` base — this is a **true dark** theme, not a slate-grey theme.

| Token | Value | Role |
|---|---|---|
| `--surface` | `#050505` | Page background. |
| `--surface-raised` | `#0c0c0c` | Cards and panels. |
| `--surface-overlay` | `#161616` | Modals, popovers. |
| `--surface-hover` | `#1e1e1e` | Hover. |
| `--surface-active` | `#252525` | Pressed / selected. |
| `--surface-input` | `#1c1c1c` | Input fill. |
| `--foreground` | `#faf9f6` | Primary text (the light theme's background colour). |
| `--foreground-muted` | `#a0a0a0` | Secondary text. |
| `--foreground-faint` | `#707070` | Micro-labels. |
| `--foreground-disabled` | `#404040` | Disabled. |
| `--line` | `#2a2a2a` | Hairlines. |
| `--line-strong` | `#3a3a3a` | Input borders. |
| `--success-text` | `#34d399` | |
| `--error-text` | `#f87171` | |
| `--warning-text` | `#d97706` | |

### 2.3 Accent (theme-independent)

| Token | Value | Usage |
|---|---|---|
| `--accent` | `#f26522` | Primary buttons, active nav indicator, links, focus rings, brand marks, chart primary. |
| `--accent-hover` | `#e05a1a` | **(inferred)** Hover state for accent surfaces. |
| `--accent-text` | `#b84a0a` | Accent-coloured *text on light backgrounds* — the raw accent fails contrast for body text. Measured in use on shipmail's inline links. |
| `--accent-fg` | `#ffffff` | Text/icons placed on an accent fill. |
| `--accent-dim` | `rgba(242, 101, 34, 0.10)` | **(inferred)** Tinted background for active nav rows, selected states, callouts. |

**Critical accessibility note:** `#f26522` on `#faf9f6` yields a contrast ratio of approximately **3.1:1** — this passes WCAG AA for large text and UI components, but **fails for body text**. Use `--accent-text` (`#b84a0a`, ≈5.2:1) for any accent-coloured running text or inline link. White on `#f26522` is ≈3.4:1, acceptable for the 14px/600 button labels specified in Section 4.1 but do not go below 14px on accent fills.

### 2.4 Data-visualisation palette

Semantic, and re-tuned per theme for equal perceived brightness. Use for analytics charts.

| Token | Light | Dark |
|---|---|---|
| `--chart-new` | `#1baf7a` | `#199e70` |
| `--chart-expansion` | `#2a78d6` | `#3987e5` |
| `--chart-contraction` | `#eda100` | `#c98500` |
| `--chart-churned` | `#e34948` | `#dc2626` |
| `--chart-reactivation` | `#e87ba4` | `#d55181` |

### 2.5 Calendar event tints

Shipmail's calendar uses per-event pastel tints with a saturated left border, rather than a single accent. Flap currently renders every event in `--cta`. Define six pairs and assign by hashing the event's mailbox or calendar ID so colour is stable across renders. **(inferred values, sampled from screenshots)**

| Name | Light fill / border | Dark fill / border |
|---|---|---|
| blue | `#dbeafe` / `#3b82f6` | `#1e3a5f` / `#60a5fa` |
| green | `#d1fae5` / `#10b981` | `#14432f` / `#34d399` |
| purple | `#ede9fe` / `#8b5cf6` | `#2e2450` / `#a78bfa` |
| amber | `#fef3c7` / `#f59e0b` | `#4a3410` / `#fbbf24` |
| rose | `#ffe4e6` / `#f43f5e` | `#4c1d24` / `#fb7185` |
| teal | `#ccfbf1` / `#14b8a6` | `#0f3d38` / `#2dd4bf` |

### 2.6 Migration map from current tokens

**All "current" values below are the *effective* Gen-3 values from `index.css:3664` (light) and `:3752` (dark) — not the dead Gen-1 values at line 20.** Verify against those line numbers, not the top of the file.

| Current token | Effective light | Effective dark | Replace with | Note |
|---|---|---|---|---|
| `--bg` | `#f8f7f4` | `#20211f` | `--surface` | Light shifts to `#faf9f6`; dark drops to true black `#050505`. |
| `--surface` | `#fff` | `#292a27` | `--surface-raised` | Rename + dark becomes `#0c0c0c`. |
| `--bg-elevated` | `#fff` | `#262724` | `--surface-overlay` | Currently identical to `--surface`; must diverge. |
| `--surface-2` | `#eeece7` | `#33342f` | `--surface-hover` | Closest existing analogue. Add `--surface-active` and `--surface-input` as new. |
| `--fg` | `#292925` | `#efeee8` | `--foreground` | Light darkens to `#141211`. |
| `--muted` | `#696860` | `#b1b0a6` | `--foreground-muted` | Add `--foreground-faint` and `--foreground-disabled` as new. |
| `--line` | `#e2e0d9` | `#3b3d36` | `--line` | Already opaque — good. Retune to `#e2dfd8` / `#2a2a2a`. |
| `--line-strong` | `#ccc9c0` | `#51534a` | `--line-strong` | Retune to `#cbc7be` / `#3a3a3a`. |
| `--cta` | `#353430` | `#e0ddd3` | `--accent` (`#f26522`, **both themes**) | **The critical change.** Stop the light/dark inversion. |
| `--cta-fg` | `#fff` | `#292925` | `--accent-fg` (`#ffffff`) | Constant. |
| `--cta-rgb`, `--cta-dim` | — | — | `--accent-rgb: 242, 101, 34` + `--accent-dim` | **Keep an RGB companion.** There are ~37 `rgba(var(--cta-rgb), …)` call sites; alias `--cta-rgb` → `--accent-rgb` in Phase 1 or they silently break. |
| `--shadow` | `0 4px 24px #29292508` | `0 18px 40px rgba(0,0,0,.55)` | keep, marketing/overlay only | App cards get no shadow (§4.3). |
| `--danger` / `--warn` / `--ok` | `#b42318` / `#c47a10` / `#0a7b6f` | `#ef7a7a` / `#e0b05a` / `#2bb5a5` | `--error-text` / `--warning-text` / `--success-text` | Rename to match the semantic set. |
| `--sidebar*` (4 tokens) | `#f0eee8` / … (24 refs) | `#242520` / … | alias → surface tokens, then delete | Live light sidebar is `#f0eee8`, **not** the dead `#050505` at L47. Migrate the 24 refs; do not delete while referenced. |
| `--orange` | `#353430` | *leaks light* | *delete* | Name is a lie; nothing should reference it after migration. |
| `--accent-2`, `--accent-2-rgb` | `#141211` | *leaks light* | *delete* | Dark-mode leak; near-black used as an accent. |
| `--paper`, `--ink`, `--carbon` | — | — | *delete* | Aliases of surface/foreground. |
| `--warn-rgb`, `--danger-rgb` | — | *leak light* | *delete* | Superseded by the semantic set. |
| `--grid-line`, `--scan` | `transparent` | — | *delete* | Permanently transparent; vestigial. |
| `--mark-ink`, `--mark-flap` | `#fff` / `#c5c1b6` | — | *delete* if unreferenced | Verify with `rg` first. |

`--domain-color` is a **runtime token** set inline per message row from server data. Leave it in place; see §1.5.

---

## 3. Typography

Shipmail uses exactly two families. Flap already loads both — no new font loading required.

- **Inter** — all UI and prose. `--font-sans`.
- **JetBrains Mono** — numerics in stat cards, code, API keys, email addresses in technical contexts, micro-labels. `--font-mono`.

### 3.1 Marketing scale

Measured from the live landing page at 1024px viewport.

| Role | Size | Weight | Letter-spacing | Line-height |
|---|---|---|---|---|
| Hero H1 | 56px | 800 | −1.4px (−0.025em) | 1.05 |
| Section H2 | 64px | 800 | −1.6px (−0.025em) | 1.05 |
| Card H3 | 16px | 700 | normal | 1.5 |
| Eyebrow label | 12px | 600 | +1.2px, uppercase | 1.4 |
| Body / lede | 16–18px | 400 | normal | 1.6 |
| Stat numeral | 40–48px | 800 | −0.02em | 1.0 |

The defining characteristic is **tight negative tracking on large weights**. At 800 weight and 56px+, Inter needs −0.025em to avoid looking loose. This single property does more for the "designed" feel than any other typographic choice. Flap's headings currently use default tracking.

Section headings terminate with a period rendered in `--accent` — "All your email in one place**.**" This is a cheap, highly repeatable brand signature. Implement as a `<span className="text-accent">.</span>`, not as part of the string, so it survives i18n.

### 3.2 Application scale

The dashboard is markedly smaller than the marketing site. Do not carry marketing sizes into the app.

| Role | Size | Weight | Colour |
|---|---|---|---|
| Page H1 | 20px | 700 | `--foreground` |
| Page subtitle | 13px | 400 | `--foreground-muted` |
| Section H2 | 15px | 600 | `--foreground` |
| Card/sub H3 | 13px | 600 | `--foreground` |
| Body / table cell | 14px | 400 | `--foreground` |
| Secondary text | 13px | 400 | `--foreground-muted` |
| Micro-label | 11px | 600, +0.08em, uppercase | `--foreground-faint` |
| Nav item | 14px | 500 | `--foreground-muted` idle / `--foreground` active |
| Stat numeral | 28px | 700, mono | `--foreground` |

---

## 4. Primitives

### 4.1 Buttons

Height 36px default, 32px small, 40px large. Radius **12px** in the application, **9999px (pill)** on marketing pages. This split is deliberate: pills read as promotional, 12px reads as functional.

| Variant | Background | Text | Border |
|---|---|---|---|
| `primary` | `--accent` | `--accent-fg` | none |
| `secondary` | `--surface-raised` | `--foreground` | 1px `--line-strong` |
| `ghost` | transparent | `--foreground-muted` | none; hover → `--surface-hover` |
| `danger` | transparent | `--error-text` | 1px `--error-text` at 30% |
| `inverse` | `--foreground` | `--surface` | none |

Padding `8px 16px`; gap to icon `8px`; icon `16px`. Label 14px/500 (app) or 14px/600 (marketing).

**On `inverse`:** shipmail's dark-mode dashboard uses a *white* primary button for the highest-priority action on a page (e.g. "I have a domain" on Domains) while reserving orange for global/creation actions ("New Email", "New event", "Create key"). Follow this: **orange = create, inverse = proceed.** Do not put two orange buttons in one header.

Focus ring, all variants: `0 0 0 3px rgba(242,101,34,0.35)`, `outline: none`. Must be visible on both themes.

### 4.2 Inputs

Height 36px, radius 10px, background `--surface-input`, border 1px `--line-strong`, text 14px, placeholder `--foreground-faint`. Focus: border → `--accent`, plus the standard focus ring. Never remove the ring without a replacement affordance.

### 4.3 Cards

Background `--surface-raised`, border 1px `--line`, radius **16px**, padding 20–24px. **No drop shadow in the application.** Shadows appear only on marketing pages and floating overlays. Elevation in the app is communicated by surface level and border, which is what keeps dark mode clean.

### 4.4 Badges and chips

Height 20px, radius 6px, padding `2px 8px`, 11px/600 uppercase +0.04em. Tinted background at ~12% of the semantic colour with solid semantic text: success `#047857` on `rgba(4,120,87,0.12)`, and equivalently for warning, error, and accent.

Use for: verification status, plan gates, `active`/`shared`/`newsletter` mailbox roles, `Live mode`/`Test mode` counts.

### 4.5 Tabs

Underline style, not pill. 14px/500, `--foreground-muted` idle, `--foreground` active, with a 2px `--accent` bottom border on the active tab and a 1px `--line` rule spanning the full row. 20px gap between tabs; 16px bottom padding before content.

Used for Settings sections, Developer sections, Newsletters sections, AI assistant sections.

### 4.6 Segmented control

For mutually exclusive view switches (Week/Month/Day, 7d/30d/90d). Container `--surface-input`, radius 10px, 2px padding. Active segment `--surface-raised` with radius 8px and a subtle shadow. 13px/500. This is distinct from tabs — segmented switches a *view of the same data*, tabs switch *between different content*.

### 4.7 Settings row

The most reusable pattern in the dashboard and the one Flap most conspicuously lacks.

A bordered card contains N rows. Each row is a flex line: **label left, control right**, `16px 20px` padding, separated by 1px `--line` dividers (no divider after the last). Label 14px/500 `--foreground`; optional helper line beneath at 12px `--foreground-muted`. Control right-aligned, `max-width: 280px` for inputs.

Section headings sit **outside and above the card** — 15px/600 heading plus 13px muted description, with 24px of space before the card. Never put the section heading inside the card.

### 4.8 Stat card

For analytics KPIs. Four across on desktop, two on tablet, one on mobile.

```
┌─────────────────────────┐
│ SENT              ← 11px/600 uppercase, --foreground-faint
│ 1,284             ← 28px/700 JetBrains Mono, --foreground
│ Last 30d          ← 12px, --foreground-muted
│ +12% vs prior     ← 12px, --success-text / --error-text
└─────────────────────────┘
```

Card styling per 4.3. Always render the comparison line; when unavailable print `Comparison unavailable` in `--foreground-faint` rather than omitting it, so cards stay the same height.

### 4.9 Empty state

Flap's current empty states are a single muted sentence. Shipmail's are the strongest component in its dashboard and are worth copying structurally.

Centred within a bordered card, `min-height: 320px`:

1. **A miniature illustrative mockup** of the thing that would be there — for Domains, a small fake domain row with MX/SPF/DKIM/DMARC chips. Not a generic icon. This is what makes the pattern work: it shows the user what success looks like.
2. Heading, 15px/600.
3. Description, 13px `--foreground-muted`, max-width 380px, centred.
4. The same primary and secondary actions as the page header, repeated here.

Where a per-feature mockup is too costly, fall back to a 40px icon in a 64px circle of `--surface-hover`.

### 4.10 Callout / notice

Left-aligned icon, radius 12px, 12px 16px padding, tinted background at 8% of the semantic colour with a 1px border at 20%. Variants info (`--chart-expansion`), success, warning, error. Body 13px.

### 4.11 Toast

Bottom-right, `--surface-overlay`, radius 12px, 1px `--line`, `max-width: 380px`, shadow `0 10px 15px -3px rgba(0,0,0,0.2)`. Optional uppercase eyebrow (e.g. `SECURITY`), title 13px/600, body 12px `--foreground-muted`, optional accent-coloured action link, dismiss affordance top-right.

---

## 5. Application shell

### 5.1 Global sidebar

Fixed **207px** (live today is **228px** via `.app-shell` at `index.css:3751` — retarget, do not invent a new rail). Background `--surface` — the *same* as the page, separated by a single 1px `--line` right border, not by a contrasting fill.

**Do not believe the Gen-1 `--sidebar: #050505`.** The live light sidebar is `#f0eee8` (`index.css:3751`); dark is `#242520`. `AppShell.tsx` hardcodes no colour — it emits `className="sidebar"`. The real gap versus the reference is: (1) width 228→207, (2) nav item metrics (38px/radius 6 → 40px/radius 12), (3) accent icon + left bar on active, (4) collapsing to an icon rail. Migrate the 24 `--sidebar*` refs onto surface tokens, then delete the aliases.

Structure, top to bottom:

1. **Brand** — 56px tall, logo + wordmark, 16px horizontal padding.
2. **Section: `OVERVIEW`** — micro-label per 3.2, `12px 16px 4px` padding.
   Get started · Inbox · Calendar · AI assistant · Domains · Mailboxes · Contacts · Newsletters · Bookings · Analytics
3. **Section: `SYSTEM`**
   Settings · Developer · Billing · Docs

**Flap's nav is already exactly this** (`AppShell.tsx`), including the two-group split and the lucide icon set, plus a `Bookings` entry shipmail lacks. Keep the information architecture; change only the visual treatment.
4. **Spacer** (`flex: 1`)
5. **Support** — "Chat with us" ghost row.
6. **Account** — avatar (24px, accent-tinted circle with initials), name, expand chevron. Opens a menu with theme switch, workspace switch, sign out.

**Nav item:** 40px tall, radius 12px, `6px 10px` padding, `4px` vertical gap, 16px icon + 14px/500 label.

- Idle: transparent, `--foreground-muted`
- Hover: `--surface-hover`, `--foreground`
- Active: `--surface-active` background, `--foreground` text, **`--accent` icon**, and a 3px accent bar on the left edge inset 4px vertically

Counts (e.g. "Mailboxes 1") right-align in 12px `--foreground-faint`.

A collapse control pins to the sidebar's right edge, vertically centred, collapsing to a 56px icon-only rail. Persist the state in `localStorage`.

### 5.2 Page header

A single row, 56px min-height, `20px 24px` padding, 1px `--line` bottom border.

- **Left:** H1 20px/700; subtitle 13px `--foreground-muted` beneath. An inline help link may follow the subtitle in `--accent-text` with underline.
- **Right:** actions, 8px gap, right-aligned, vertically centred against the H1.

For view-based pages (Calendar), the H1 sits inline with navigation controls: `[Today] [‹] [›] September 2026` on the left; mailbox picker, segmented view switch, and primary action on the right.

### 5.3 Content column

`max-width: 1090px`, left-aligned (**not** centred) within the remaining space, `24px` padding, `32px` between major sections.

Left alignment matters: with a fixed sidebar, centring the content in the remaining viewport makes the gutter between sidebar and content grow on wide monitors, visually detaching the content from the nav.

### 5.4 Inbox: four-column layout

Measured widths at 1024px:

| Column | Width | Background |
|---|---|---|
| Global sidebar | 207px | `--surface` |
| Folder rail | 260px | `--surface` |
| Message list | 340px | `--surface` |
| Reader | fill | `--surface-raised` |

1px `--line` between each.

**Flap already has this structure.** `Inbox.tsx` renders `AppShell` (sidebar) → `.mail-layout` grid → `MailFolderRail` → `.mail-list` → `MessageReader`. That is four columns. The audit's observation that Flap has "two vertical rails side by side with different visual treatments" is precisely the problem: the structure is right, the *styling* of the two rails diverges. **This is a restyle, not a re-architecture** — do not rebuild the layout.

Two real structural fixes are needed:

- `Inbox.tsx` is the only authenticated page that bypasses `AppFeaturePage` and owns its own header, so its title treatment and action placement differ from all ten siblings. Reconcile the header, keep the full-bleed body.
- There is no resizable splitter and no persisted pane widths. Add both; persist to `localStorage`.

**Folder rail:** full-width accent "New Email" button at top (36px, radius 12px). Then system folders — Inbox, Starred, Sent, Scheduled, Drafts, Archive, Junk, Trash — each 32px with a 16px icon, 13px label, right-aligned count. Then collapsible groups: `NEEDS YOU`, `GROUPS`, `FOLDERS`, `MAILBOXES`, each a micro-label with a disclosure chevron and an inline "+" affordance.

**Message list:** sticky search field with filter and unread toggles. Rows ~72px: sender 13px/600, time 11px `--foreground-faint` right-aligned, subject 13px, preview 12px `--foreground-muted` truncated to one line, and a **domain chip** (11px mono, tinted with the domain's assigned colour). Unread rows carry a 3px accent left bar and 600-weight sender. Selected row `--surface-active`.

**Reader:** toolbar of icon-only ghost buttons, right-aligned. Beneath: recipient line in 12px mono `--foreground-faint`, then subject 18px/700, then a collaboration bar — `Assigned to ▾`, `Done`, `Follow up`, `Add note`. Body renders in a sandboxed iframe on `--surface-raised`. Reply/Reply all/Forward pin to the bottom edge.

**Compose:** a floating panel anchored bottom-right, 520×420px, `--surface-overlay`, radius 16px, shadow, with minimise/maximise/close. Not a modal, not a route — the user must be able to reference other mail while composing.

### 5.5 Responsive behaviour

The app is effectively desktop-only today, and this is not a small gap. Marketing uses Tailwind's full `sm`/`md`/`lg` ladder while the entire application has **one breakpoint at 900px** — two unrelated responsive strategies in one codebase. Unify on Tailwind's.

Current failures to fix:

| Surface | Today | Required |
|---|---|---|
| Sidebar | No collapse, drawer, or hamburger. At ≤900px it stacks *above* the content at full width. | Off-canvas drawer below `md`, triggered by a header hamburger; icon-rail at `md`; full at `lg`. |
| Inbox | All three panes stay mounted and stack vertically, so the reader sits below the entire message list. | Master/detail below `lg`: list fills the viewport, selecting a message replaces it with the reader plus a back control. |
| Calendar | **No breakpoint at all.** Fixed 7-column grid overflows horizontally below ~700px. | Day view as the mobile default; week view horizontally scrollable with a sticky time gutter. |
| Settings tabs | Overflow horizontally with no scroll affordance. | Horizontally scrollable tab strip with edge fade, or a select on mobile. |

The PWA is installable (`public/sw.js`, `PwaInstallPrompt`), which makes the missing mobile layout more visible than it would otherwise be — users can install an app that does not fit their phone.

---

## 6. Landing page redesign

The current landing page is a single-background scroll. The reference alternates full-bleed light and dark bands, which is what produces its rhythm.

### 6.1 Structural principle

**Alternate section backgrounds.** `--surface` (`#faf9f6`) → `#0c0c0c` → `--surface` → `#0c0c0c` … closing with a full-bleed `--accent` CTA and a `#0c0c0c` footer.

Dark sections invert their text tokens (`--foreground` becomes `#faf9f6`) but **keep the same accent**, which is what holds the identity together across the flip.

Section padding: `128px` top and bottom desktop (`py-32`), `80px` mobile. Container `max-width: 1152px`.

Apply a subtle film grain over every section (a tiled SVG `feTurbulence` at ~3% opacity). This is the detail that separates the reference from a Tailwind template — it removes the flatness of large solid fills at almost zero cost.

### 6.2 Navigation

A **floating pill**, not a full-width bar. Centred, `max-width: 1152px`, `24px` from viewport top, radius 9999px, background `rgba(250,249,246,0.72)`, `backdrop-filter: blur(12px) saturate(1.5)`, border 1px `rgba(226,223,216,0.6)`.

Contents: wordmark left; centre links 14px/500 with pill hover; right a single accent or inverse CTA at `8px 20px`.

Over dark sections the pill inverts to `rgba(12,12,12,0.72)`. Implement with an `IntersectionObserver` on section boundaries.

### 6.3 Section sequence

| # | Section | Background | Content |
|---|---|---|---|
| 1 | Hero | light + grain | H1 56px/800/−1.4px with a marker-highlight behind the first line and an accent period. Lede 18px, max-width 520px. Accent pill CTA + rating chip. **Right:** a floating stack of mailbox cards (avatar, address, role badge) and a dark code card showing a `POST /v1/messages` call. |
| 2 | Trust stats | light | Four columns divided by vertical rules: numeral 40px/800 with an accent suffix (`3,700+`, `5-in-1`, `100%`, `0`), 14px/600 label, 13px muted description. |
| 3 | Unified inbox | **dark** | H2 64px/800 + accent period, lede, then a large product screenshot in a rounded frame (radius 16px, 1px border, `0 25px 50px -12px rgba(0,0,0,0.5)`). Three feature cards beneath. |
| 4 | Testimonials | light | Eyebrow `FROM CUSTOMERS` in accent. Three-column masonry of quote cards: five accent stars, 13px quote, attribution 13px/600. |
| 5 | Calendar & booking | **dark** | Same anatomy as 3. Screenshot shows pastel event blocks and a booking widget. |
| 6 | Newsletters | light | Same anatomy. |
| 7 | AI assistant | **dark** | Same anatomy. |
| 8 | Developer / API | light | Split: copy and bullets left; tabbed code sample (TypeScript / Python / cURL) in a dark card with a copy button, right. |
| 9 | Capability grid | light | Six cards, 3×2: works with any client, CalDAV/CardDAV, storage, team access, automations, privacy. |
| 10 | FAQ | light | Accordion, hairline dividers, no card. |
| 11 | Comparison links | `#f8f5ee` | Six cards linking to `/vs/*` (10 routes) and `/for/*` (7 routes). Reuses existing SEO routes. |
| 12 | Final CTA | **`--accent`** | Full-bleed orange. H2 48px/800 white, centred. Sub-line at 80% white. Single **white** pill CTA. |
| 13 | Footer | `#0c0c0c` | Five link columns with uppercase tracked headers, right-aligned link text. Wordmark and one-line descriptor left, plus a status pill (green dot, "All systems operational" → `/status`, which exists). Giant outlined wordmark watermark behind, ~4% opacity. Bottom bar: copyright, `llms.txt`, RSS. |

**This is a re-layout, not new content.** Flap already has ~76 marketing routes: 22 DNS tool pages (`/tools/spf-checker`, `dmarc-checker`, `dkim-checker`, `mx-checker`, `blacklist-checker`, `bimi-checker`, `mta-sts-checker`, `dns-propagation`, `header-analyzer`, `ptr-checker`, and more), 10 `/vs/*`, 7 `/for/*`, 7 guides, 5 blog posts, 10 SEO landings, plus `/security`, `/status`, `/research`, `/docs/api`. The current footer already has four columns (Product / Learn / Tools / Account); this expands to five and restyles it.

**Preserve the marketing serif accent as a deliberate decision.** Georgia italic currently appears in five places (`.landing-hero-mark`, `.landing-stats strong`, `.flap-pricing > h1`, `.journal-card:first-child h2`, `.flap-article > h1`). Shipmail is Inter-only. Keeping the serif is defensible as Flap's own signature — but it is **hardcoded five times with no token**. Either tokenize it as `--font-serif` and keep it, or remove it entirely. Do not leave it as scattered literals.

Two constraints on this rebuild:

- **Do not break the SEO tests.** `npm run check` runs `scripts/seo.test.ts`. Preserve each page's semantic structure (single H1, title, meta description, canonical) while changing layout.
- **Drop the `.landing-root` force-light** (§1.2) so the redesigned page has a real dark theme rather than an unannounced flip at the `/app` boundary.

---

## 7. Feature gaps

Derived by walking every authenticated shipmail surface. **IMAP/SMTP is excluded per instruction.**

### 7.0 Read this before building anything in Section 7

Flap's backend contains roughly **40 fully-implemented feature areas, 15 partials, and 19 deliberate stubs**. The stubs are honest — they return `status: "partial"`, `"scheduled"`, `"deferred"`, or `"wizard_ready"` with an explanatory note — but they are indistinguishable from working features if you only read the route table.

**Never infer that a feature works because an endpoint exists.** Three failure modes recur:

1. **Reader without writer.** `GET /api/quarantine` reads `messages WHERE virus_status='quarantine'`, but nothing in `worker/` ever *writes* `virus_status`. The list is permanently empty. Same shape as the delivery-event gap in §7.1.
2. **Write-only tables.** Six tables receive rows that no code ever reads or acts on: `client_portals`, `embed_widgets`, `contact_forms`, `booking_requests`, `scheduled_digests`, `push_subscriptions`. A booking request is stored and the user is told "the host will confirm by email" — **no email is sent and no slot is held.**
3. **URLs to routes that do not exist.** `POST /api/client-portals` returns `/portal/{slug}`, `/api/embed-widgets` returns `/embed/{slug}.js`, `/api/contact-forms` returns `/f/{slug}`. **None of those three routes exist** in `App.tsx` or the worker; all 404.

Before building UI on top of any endpoint in this document, confirm the write path, the read path, and the route all exist. Where this document already knows the answer, it says so in the "Flap today" column.

### 7.1 Tier 1 — build first

| Feature | Flap today | Specification |
|---|---|---|
| **Shared inbox collaboration** | **Partial — assignment + notes shipped** | `POST /api/mail/:id/assign` and `GET`/`POST /api/mail/:id/notes` are real and team-gated. Reader already has an assignee `<select>` (`MessageReader.tsx:539`) and a notes accordion (`:574`). **Genuinely missing:** `Done` / `Follow up` *states* (only a Follow-up *label* exists at `:505`), a `NEEDS YOU` folder, and presenting the controls as a collaboration bar instead of a bare form. |
| **Suppression list** | **Fully shipped** | Auto-capture from SES bounce/complaint (`inbound-webhook.ts:271-330`), send-time enforcement, `mail_suppressions` table, API, and a managed UI under Settings → Delivery ("Bounce & complaint list", `Settings.tsx:1895`). **Do not rebuild.** Phase 5 may restyle the existing panel onto the new primitives; Phase 6 should skip this row. |
| **Delivery event log** | **Partial — bounce/complaint only** | `inbound-webhook.ts:255-297` handles **only** `bounce` and `complaint`. There is no per-recipient delivery event log UI, and SES `Delivery` / `Open` / `Click` are not subscribed. Wire persistence into `deliverability_events` for the events already received, add a filterable log UI, and treat open/click as a later SES configuration-set task — do not claim those are "largely a persistence task." |
| **Sending reputation panel** | Blocked on the above | Bounce rate, complaint rate, suppressed count, with thresholds. Feeds from the delivery event log + existing suppressions. |
| **Empty-state system** | **Partial — `FeatureEmpty` exists** | `FeatureEmpty` in `AppFeaturePage.tsx:73-94` already renders heading + muted body + optional CTA in a bordered 16px card and is used across Newsletters, Bookings, Mailboxes, Contacts, and Settings. The gap is the illustrative mockup and the 320px centred frame (§4.9), not inventing a component. Enhance `FeatureEmpty`; retire bare `.empty-state` one-liners. |
| **Theme switch** | **Exists — palette incomplete** | `ThemeToggle` is already mounted in `AppShell.tsx:164-165` with System/Light/Dark. **Do not rebuild it.** The work is completing the dark token set (§2.2), fixing the leaks in §1.2, stopping the dark-mode `--cta` inversion to bone white (`index.css:3752`), and removing the `.landing-root` force-light so marketing follows the theme. |

### 7.2 Tier 2 — competitive parity

| Feature | Flap today | Specification |
|---|---|---|
| **Sandbox / test mode** | None | Test API keys routed to shadow mailboxes; sends simulated, never delivered externally. Displayed as paired `Live mode` / `Test mode` cards with active-key counts. Materially reduces integration risk for API users. |
| **Webhooks UI** | **Shipped except redelivery** | Full CRUD + per-webhook delivery history with status codes already live under Settings → Developer (`Settings.tsx` + `api.webhookDeliveries`). **Only manual redelivery is missing.** Do not rebuild the list UI. |
| **Developer hub** | **Buried in `Settings.tsx`** | `/app/developer` already routes into Settings' `developers` tab. That one component is 2,941 lines serving four routes. **Split it first**, then restyle the hub with tabs: API keys · Sandbox · Connections · Webhooks · Logs. The split is a prerequisite, not optional cleanup. |
| **Newsletter audiences** | **Missing, and the sender is missing too** | There is no subscriber table at all — `newsletter_subscribers` exists only as a *number* in `shared/plans.ts`. Worse, `POST /api/newsletters` writes rows with `status:'queued'` and **nothing ever dequeues them**, so newsletters cannot currently send. Build the subscriber store, opt-in flow, CSV import, and the queue consumer together; audiences alone deliver nothing. |
| **Newsletter sending subdomain** | None | Dedicated subdomain with its own DNS records, isolating newsletter reputation from transactional. Standard practice; its absence is a real deliverability risk. |
| **Sender identity** | None | From-name + address pairing with mandatory physical-address footer (CAN-SPAM / GDPR). |
| **Dependency-aware onboarding** | Flat list | Rework `GetStartedAppPage` to the three-state model: `Recommended` (accent icon, accent left bar, tinted row, primary CTA), `Ready` (neutral, secondary CTA), `Blocked` (lock icon, dimmed, with a `needs mailbox` chip naming the unmet dependency). Group into "Set up your email", "Secure your account", "Automate your replies", "For developers". Header shows `N recommended · X of Y done`. |
| **Account security** | Clerk default | Surface in-app: secondary recovery email (explicitly *outside* Flap), TOTP 2FA, last-used timestamps. |
| **Full account export** | **Shipped — shape differs** | `/api/export?format=mbox` plus JSON backup **and restore** already live under Settings → Privacy. Remaining work is presentation only: per-mailbox ZIP of `.eml` files and a 7-day download window — not inventing export. |

### 7.3 Tier 3 — differentiators

| Feature | Specification |
|---|---|
| **Video conferencing** | Google Meet / Zoom OAuth; auto-attach a conference link to calendar invites and bookings. Settings tab exists in the reference. |
| **Team availability overlay** | Render teammates' busy blocks as a translucent layer in week view before picking a time. |
| **Localised invitations** | Send invite/update/cancel emails in the *guest's* language, not the organiser's. |
| **AI writing style** | Train tone from a sample of the user's sent messages; apply to drafts. `/app/ai` currently states the Writing-style tab is "planned". |
| **AI automations** | Natural-language rules ("file all receipts from Stripe"). Note the honest state: `POST /api/ai/summarize` is **not an LLM** — it is string templating over two regexes — and `POST /api/parse-rules` inserts rows that **nothing ever executes**. Treat this as new work with a partial scaffold, not as a front-end over a working engine. |
| **Scale plan** | **Pricing UI shipped; billing checkout thinner** | `PricingPage.tsx:210-233` already has the Scale slider and live price. What's missing is a Scale **checkout/upgrade path in `/app/billing`**, not the slider itself. |
| **Yearly billing toggle** | **Mostly shipped** | Monthly/Yearly exists on `PricingPage.tsx` and yearly equivalents show in-app. Only the `2 MO FREE` badge treatment is absent. |
| **Email import** | Name carefully | Import from Gmail, Outlook, IMAP, or `.mbox`. `POST /api/migrate/import` is a wizard stub. Do **not** wire into provider-migration APIs (`migrateDomainSes`, `migrateCfRouting`, `domains.migration_state`) — those are Mailgun→SES / CF routing, not mailbox import. |

---

## 8. Accessibility

Non-negotiable, and currently a weak area.

1. **Contrast.** Accent text on light backgrounds must use `--accent-text` (§2.3). Verify every token pair at AA before merging.
2. **Focus.** Every interactive element needs a visible `:focus-visible` ring. Never `outline: none` without a replacement.
3. **Targets.** 36px minimum interactive height; 24px icon buttons need 8px padding to reach 40px.
4. **Semantics.** Tabs need `role="tablist"`/`role="tab"`/`aria-selected`. Segmented controls need `aria-pressed`. Nav needs `aria-current="page"`.
5. **Colour is never the only signal.** Domain chips need text, not just tint. Status badges need a label, not just colour.
6. **Motion.** Honour `prefers-reduced-motion`; disable the grain animation and all transitions under it.
7. **Live regions.** Toasts and inline save confirmations need `role="status"`; errors need `role="alert"`.
8. **Skip link.** Neither shell has one. Add "Skip to main content" as the first focusable element in both.

### 8.1 Known defects to fix

Found in the current codebase. Fix these specifically rather than relying on a general sweep.

| Defect | Location |
|---|---|
| `.err` at ~1.6:1 in light mode — the primary error affordance is unreadable | `index.css`, see §1.5 |
| Attachment-remove is a bare `<span>×</span>`, no `aria-label` | `src/pages/Compose.tsx:374` |
| Toast close buttons are bare `×`, no `aria-label` | `src/pages/Inbox.tsx:1079`, `:1127` |
| Icon-only `<Button size="icon">` with no `aria-label` | `src/pages/CalendarAppPage.tsx:536`, `:554`; `PwaInstallPrompt` |
| Hand-rolled toasts have no `aria-live` region | `.mail-toast` in `Inbox.tsx` |
| Only 12 `:focus-visible` rules against 21 `box-shadow: none` — several surfaces had their ring removed with no replacement | `index.css` |

The `aria-label` pattern is inconsistent *within single files* — `Inbox.tsx:1133`, `:1213`, and `:1240` do set it correctly while `:1079` and `:1127` do not. Audit per element, not per file.

---

## 9. Motion

Restrained. 150ms `ease-out` for hover and colour transitions; 200ms for popovers and dropdowns; 250ms `cubic-bezier(0.16, 1, 0.3, 1)` for the compose panel and modals. No entrance animation on page content — it delays perceived load. No parallax.

---

## 10. Implementation plan

Each phase ends with `npm run check` passing and a usable application. Do not reorder.

### Phase 1 — Token foundation

*Touches:* `src/index.css`, `tailwind` theme config, `src/components/ThemeProvider.tsx`

1. **Delete every dead token generation**, not only the three named earlier. Live paint comes from `:root` @3664 (marketing/light), `.app-shell` @3751 (app chrome — beats `:root` for everything inside the authenticated shell), and `html.dark … .app-shell` @3752. Dead blocks: Gen-1 `:root` @20, Gen-2 `.app-shell` @3521, dark A @3241. Phase 1 must replace **all** of these with a single Section 2 set or the app will keep the old `.app-shell` override.
2. Introduce the Section 2 token set for both themes as the single source of truth. **Accent stays `#f26522` in dark** — today dark invents `--cta: #e0ddd3`; stopping that inversion is intentional behaviour change, not a rename.
3. Apply the §2.6 migration map. Keep old names as aliases pointing at new tokens **for this phase only**, including `--cta-rgb` → `--accent-rgb` (required for ~37 `rgba()` sites) and `--sidebar*` → surface tokens (24 refs).
4. Delete only zero-ref vestigials after `rg` confirms (`--orange`, `--paper`, `--grid-line`, `--scan`, `--unread`). Do not delete `--sidebar*` / `--carbon` / `--mark-flap` until refs are migrated.
5. **Extend the `@theme` block** (Tailwind v4) mapping the token set so `bg-surface-raised`, `text-foreground-muted`, `border-line` work as utilities. Until this exists, every Tailwind colour utility bypasses the theme.
6. **Remove the `.landing-root` force-light block** (`index.css:2884-2912`) so marketing follows the theme. `ThemeToggle` already exists; do not rebuild it.
7. **Scope the global `label` selector** (`index.css:396`) to a class so shadcn `<Label>` is usable at normal case.
8. Fix `.err` (§1.5) and route `emailSrcDoc()` colours through tokens.
9. Reduce the four focus-ring recipes to the one in §4.1.

**Done when:** the accent is visible throughout (including dark buttons), both themes render every page including marketing without unstyled regions, `rg -c '!important' src/index.css` has dropped substantially, and no component references a deleted token.

### Phase 2 — Primitives

*Touches:* `src/components/ui/*`

`src/components/ui/` contains 15 files. Thirteen are in use; **`card.tsx` and `switch.tsx` are unused** — card layouts are hand-built and toggles use raw `<input type="checkbox">`. Adopt both rather than deleting them.

**Retune the existing** against the new tokens and the Section 4 metrics — `button` (5 variants, radius 12px), `card` (radius 16px, no shadow), `badge` (§4.4), `input` (§4.2), `tabs` (underline, not pill).

**Add the missing:** `segmented-control` (§4.6), `settings-row` (§4.7), `stat-card` (§4.8), `empty-state` (§4.9), `callout` (§4.10), `toast` (§4.11), plus `table` and `skeleton`. Toasts are currently hand-rolled in `Inbox.tsx` (`.mail-toast`) with no `role="status"`, and tables are raw `<table>` plus bespoke CSS.

Each must render correctly in both themes and expose a visible focus ring.

**Done when:** a primitives gallery route renders every variant in both themes.

### Phase 3 — Shell

*Touches:* `AppShell.tsx`, `AppFeaturePage.tsx`

Sidebar per §5.1 (theme-following, 207px, sectioned, accent active state, collapsible). Page header per §5.2 (56px, inline actions). Content column per §5.3 (1090px, left-aligned).

**Done when:** every app route shares one header treatment and the sidebar respects the theme.

### Phase 4 — Inbox

*Touches:* `Inbox.tsx`, `MailFolderRail`, `MessageReader.tsx`

Four-column layout per §5.4. Restyle rows, reader, and toolbar. Convert compose to a floating panel. Add the collaboration bar as UI (behaviour lands in Phase 6).

### Phase 5 — Remaining app pages

Apply the system to Calendar (with §2.5 event tints), Analytics (stat cards + charts), Settings (tabs + settings rows), Domains, Mailboxes, Contacts, Newsletters, Billing, Developer, Get started (three-state checklist). Every list surface gets a §4.9 empty state.

### Phase 6 — Tier 1 features

Shared-inbox Done/Follow-up/NEEDS YOU, delivery event log (from existing bounce/complaint handlers), sending reputation. **Skip suppressions** — already fully shipped. Enhance `FeatureEmpty` mockups. Migrations only for follow-up/done states and event persistence.

### Phase 7 — Landing page

Rebuild `Landing.tsx` per Section 6. Alternating bands, floating pill nav, grain, orange CTA, watermark footer.

**Exit criterion is `npm run build`, not only `npm run check`.** `scripts/seo.test.ts` mostly asserts on registry data structures and skips HTML when `dist/client` is absent. The hard H1/canonical gate is `scripts/validate-seo.ts` inside `npm run build`.

### Phase 8 — Tier 2 features

1. Sandbox / test-mode API keys (new).
2. Webhook **manual redelivery** only (UI otherwise shipped).
3. Split `Settings.tsx` into Settings / Domains / Billing / Developer hubs.
4. Newsletter subscribers + queue consumer + audiences (not UI-only).
5. Newsletter sending subdomain + sender identity.
6. Dependency-aware Get started.
7. Account security surfacing + export `.eml` ZIP presentation.
8. Scale **billing** checkout path + `2 MO FREE` badge (pricing slider already exists).

Do **not** add DNS tool pages — all 20 already exist in `shared/client-routes.ts`. Do **not** rebuild suppressions or webhook list UI.

This document also supersedes conflicting rows in `docs/shipmail-parity-matrix.md` for any feature marked differently here.

---

## 11. Acceptance criteria

- [ ] No hardcoded colour literal in any `src/**/*.tsx`. Enforce: `rg -n "#[0-9a-fA-F]{3,8}" src --glob '!index.css'` returns nothing.
- [ ] `src/index.css` declares each token exactly once per theme; the Gen-1 and Gen-2 blocks are gone.
- [ ] A Tailwind theme config maps every token, so no colour utility bypasses the system.
- [ ] Every page renders correctly in light and dark, **including marketing** — no force-light block remains.
- [ ] Every interactive element has a visible focus ring.
- [ ] All token pairs pass WCAG AA.
- [ ] Every list surface has a designed empty state.
- [ ] Sidebar, page header, and content width are identical across all app routes.
- [ ] `npm run check` passes, including the SEO assertions.
- [ ] Responsive at 1440 / 1024 / 768 / 375.
- [ ] `prefers-reduced-motion` disables grain and transitions.
- [ ] No verbatim shipmail copy and no shipmail assets anywhere in the repository.

---

## 12. Reference measurements

Recorded from shipmail.to on 2026-09-08 for verification.

**Landing** — body `#faf9f6`, text `#141211`, Inter. H1 56px/800/−1.4px/58.8px. H2 64px/800/−1.6px/67.2px. Container 1152px. Section padding 128px. Nav pill `rgba(250,249,246,0.72)`, `blur(12px) saturate(1.5)`, border `rgba(226,223,216,0.6)`, radius 9999px. Primary CTA `#f26522`, white, `14px 28px`, radius 9999px, 14px/600. Radius frequency: 9999px (172 uses), 16px (63), 8px (25), 12px (8). Dark band `#0c0c0c`. Pre-footer `#f8f5ee`. CTA band `#f26522`. Document height 14,869px across 12 sections.

**Dashboard** — `.dark` active. Body `#050505`, text `#faf9f6`. Columns: sidebar 207px, folder rail 260px (1px right border), message list 340px (1px right border), reader fill. Nav item 40px, radius 12px, `6px 10px`; active `#1e1e1e`; idle text `#a0a0a0`. Section micro-label 12px/600/+1.2px uppercase `#707070`. "New Email" `#f26522`, white, 36px, radius 12px, `8px 16px`, gap 8px.

**Navigation inventory** — OVERVIEW: Get started, Inbox, Calendar, AI assistant, Domains, Mailboxes, Contacts, Newsletters, Analytics. SYSTEM: Settings, Developer, Billing, Docs. Sub-navigation — Settings: General · Preferences · Team · Video conferencing · Workspace. Developer: API keys · Sandbox · Connections · Webhooks · Logs. Newsletters: Newsletters · Audiences · Migrations · Settings. AI assistant: Chat · Automations · Writing style.

---

*End of specification.*
