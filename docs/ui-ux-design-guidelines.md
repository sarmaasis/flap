# Flap Design Language — UI/UX Playbook

**Type:** General design system for any product or layout  
**Result target:** The same *crisp* look Flap uses in production (`useflap.online`)  
**Source of truth in this repo:** `src/index.css` tokens, `src/components/ui/*`, `src/lib/tw.ts`, `AppShell` / `AppFeaturePage` / `MarketingShell`  
**Audience:** Designers and engineers building Flap surfaces *or* a different product that should feel like Flap.

This is not a page-by-page mock of Flap’s inbox. It is the **system** that makes Flap look finished: warm paper, one vermilion accent, hairline borders instead of shadows, tight type, dense functional chrome, promotional chrome only on marketing.

---

## 0. How to use this on a different layout

1. **Copy the tokens first** (Section 2). Swap layout freely. Do not swap the colour physics.
2. **Pick a layout recipe** (Section 6) — marketing band, app shell, master/detail, settings stack, auth card, wizard. Recipes compose; do not invent a seventh surface language.
3. **Build with primitives** (Section 5). If a control is not in the kit, derive it from tokens + radius + type scale. Never invent a new grey.
4. **Apply crispness rules** (Section 1) as a checklist on every screen.
5. **Accent is ~5% of pixels** and 100% of “click here.” If a mock has three orange buttons, it is already wrong.

Flap’s layouts (inbox grid, settings rows, landing bands) are **instances**. The system below is the **grammar**.

---

## 1. What “crisp” means here

Crisp is not minimalism-as-emptiness. It is **high signal, low decoration**.

| Principle | Do | Don’t |
|---|---|---|
| **One accent** | `#f26522` for create, focus, active, brand | Grey primary buttons; rainbow CTAs; accent as body text |
| **Warm neutrals** | Paper `#faf9f6`, ink `#141211`, taupe muted | Cool slate SaaS (`#f8fafc` / `#0f172a`) unless you intentionally fork |
| **Elevation by surface, not shadow** | Cards = raised fill + 1px `--line` | Drop shadows on every card; nested boxes in boxes |
| **Density in product, air on marketing** | App: 13–14px, 36px controls | Marketing type in the dashboard; dashboard density on a landing hero |
| **Pills vs 12px radius** | Pills = promotional; 10–12px = functional | Pill buttons inside tables and settings |
| **Tight tracking on large type** | Hero/H2: weight 800, tracking −0.025em | Default Inter tracking on 56px headlines (looks loose) |
| **Identity before chrome** | Domain/address visible as text, not colour alone | Colour-only chips |
| **One job per screen** | Inbox = triage; compose = write; settings = configure | Kitchen-sink headers |
| **Motion is 150–250ms** | Colour/hover 150ms ease-out | Parallax, bounce, page-enter animations |
| **Accent period** | Section titles may end with an orange `.` | Scattered decorative punctuation |

**Orange = create / commit globally. Inverse (ink on paper, or paper on ink) = proceed on this page.** Never two orange primaries in one header.

---

## 2. Tokens

No hardcoded hex in components. If you need a colour, add a token.

### 2.1 Surfaces (light)

Six levels. Missing hover/active/input is why UIs look “flat” and “unstyled.”

| Token | Hex | Role |
|---|---|---|
| `--surface` | `#faf9f6` | Page / canvas |
| `--surface-raised` | `#ffffff` | Cards, panels on the page |
| `--surface-overlay` | `#ffffff` | Modals, popovers, dropdowns |
| `--surface-hover` | `#f0ede6` | Row / ghost hover |
| `--surface-active` | `#ebe9e4` | Pressed, selected row |
| `--surface-input` | `#f5f4f1` | Field fill |

### 2.2 Ink (light)

| Token | Hex | Role |
|---|---|---|
| `--foreground` | `#141211` | Primary text |
| `--foreground-muted` | `#64615a` | Secondary, descriptions |
| `--foreground-faint` | `#7a756d` | Timestamps, placeholders, micro-labels |
| `--foreground-disabled` | `#c4c0b8` | Disabled |

### 2.3 Lines

| Token | Hex | Role |
|---|---|---|
| `--line` | `#e2dfd8` | Default hairline, card border, dividers |
| `--line-strong` | `#cbc7be` | Inputs, emphasised rules |

### 2.4 Semantic

| Token | Light | Dark |
|---|---|---|
| `--success-text` | `#047857` | `#34d399` |
| `--error-text` | `#b91c1c` | `#f87171` |
| `--warning-text` | `#92400e` | `#d97706` |

Tinted fills: mix the semantic colour at **8–12%** with transparent; border at **20–30%**. Never pale pink error text on white.

### 2.5 Accent (same in light and dark)

| Token | Value | Use |
|---|---|---|
| `--accent` | `#f26522` | Primary fill, active tab underline, focus, brand |
| `--accent-hover` | `#e05a1a` | Hover on accent fill |
| `--accent-text` | `#b84a0a` | **Links and accent *text* on light** (raw accent fails body contrast) |
| `--accent-fg` | `#ffffff` | Text/icons on accent fill |
| `--accent-rgb` | `242, 101, 34` | `rgba()` / `rgb(var(--accent-rgb) / 0.08)` |
| `--accent-dim` | `rgba(242, 101, 34, 0.10)` light / `0.16` dark | Selected nav, callouts, badges |

**Contrast:** `#f26522` on `#faf9f6` ≈ 3.1:1 — OK for large UI / buttons ≥14px/600, **not** for body links. Use `--accent-text` for running text.

Keep an RGB companion. Many tints are `color-mix` or `rgb(var(--accent-rgb) / …)`.

### 2.6 Dark theme

True black canvas, not slate.

| Token | Hex |
|---|---|
| `--surface` | `#050505` |
| `--surface-raised` | `#0c0c0c` |
| `--surface-overlay` | `#161616` |
| `--surface-hover` | `#1e1e1e` |
| `--surface-active` | `#252525` |
| `--surface-input` | `#1c1c1c` |
| `--foreground` | `#faf9f6` |
| `--foreground-muted` | `#a0a0a0` |
| `--foreground-faint` | `#707070` |
| `--foreground-disabled` | `#404040` |
| `--line` | `#2a2a2a` |
| `--line-strong` | `#3a3a3a` |
| `--shadow` | `0 18px 40px rgba(0, 0, 0, 0.55)` |

Accent **does not invert** to cream. Dark primary buttons stay orange.

**Marketing public pages** may lock to light via a `.marketing-light` wrapper so `/pricing` does not flip when the app is in dark mode. Product chrome follows `html.dark`.

### 2.7 Marketing-only bands

| Token | Value | Role |
|---|---|---|
| `--landing-dark` | `#0c0c0c` | Alternate full-bleed sections, footer |
| `--landing-dark-fg` | `#faf9f6` | Text on dark bands |
| `--landing-dark-muted` | `#a0a0a0` | |
| `--landing-dark-line` | `#2a2a2a` | |
| `--landing-dark-raised` | `#161616` | Cards on dark bands |
| `--landing-compare` | `#f8f5ee` | Slightly warmer strip (vs / comparison) |
| `--landing-nav-bg` | `rgba(250, 249, 246, 0.72)` | Floating pill |
| `--landing-nav-border` | `rgba(226, 223, 216, 0.6)` | |
| `--landing-nav-bg-dark` | `rgba(12, 12, 12, 0.72)` | Pill over dark sections |

### 2.8 Charts and calendar tints

Charts (analytics): `--chart-new`, `--chart-expansion`, `--chart-contraction`, `--chart-churned`, `--chart-reactivation` — retuned per theme.

Calendar events: pastel **fill + saturated left/border**, hashed from mailbox/calendar id — blue, green, purple, amber, rose, teal. Do not paint every event in accent.

**Domain colours** are a *runtime* token (`--domain-color`) from product data. They must not equal `--accent` for the first domain or chips collide with CTAs.

### 2.9 Geometry and effects

| Token | Value |
|---|---|
| `--radius` | `10px` (fields, native controls) |
| Button radius (app) | `12px` (`rounded-xl`) |
| Card radius | `16px` (`rounded-2xl`) |
| Badge radius | `6px` (`rounded-md`) |
| Marketing CTA | `9999px` (pill) |
| `--shadow` | `0 1px 2px rgba(20,18,17,0.04), 0 12px 32px rgba(20,18,17,0.06)` — **overlays and marketing only** |
| `--focus-ring` | `0 0 0 3px rgba(242, 101, 34, 0.35)` |

### 2.10 Type families

| Token | Family | Use |
|---|---|---|
| `--font-ui` / `--font-sans` / `--font-display` | Inter | All UI and marketing |
| `--font-mono` | JetBrains Mono | Stats, keys, emails in technical contexts, `kbd` |
| `--font-serif` | Georgia | Optional Flap signature (hero mark, journal) — tokenize, do not scatter |

Load with `font-synthesis: none`, antialiased, `line-height: 1.55` on `:root`.

---

## 3. Type scales

Two scales. Mixing them is the fastest way to look amateur.

### 3.1 Product (dashboard, settings, tools)

| Role | Size | Weight | Colour |
|---|---|---|---|
| Page H1 | 20px (18px mobile) | 700 | `--foreground` |
| Page subtitle | 13px | 400 | `--foreground-muted` |
| Section H2 | 15px | 600 | `--foreground` |
| Card / sub H3 | 13–15px | 600 | `--foreground` |
| Body / table | 14px (`text-sm`) | 400–500 | `--foreground` |
| Secondary | 13px | 400 | `--foreground-muted` |
| Micro-label / eyebrow | 10–11px | 600 | `--foreground-faint`, uppercase, tracking `0.08em`–`0.1em` |
| Nav item | 14px | 500 | muted idle, foreground active |
| Stat numeral | 28px | 700, **mono** | `--foreground` |
| Button label | 14px | 500 app / 600 marketing pill | |

### 3.2 Marketing

| Role | Size | Weight | Tracking | Line-height |
|---|---|---|---|---|
| Hero H1 | 56px (~1.75rem mobile) | 800 | −0.025em | 1.05 |
| Section H2 | 48–64px | 800 | −0.025em | 1.05 |
| Card H3 | 16px | 700 | normal | 1.5 |
| Eyebrow | 12px | 600 | +0.1em, uppercase | 1.4 |
| Lede | 16–18px | 400 | normal | 1.6 |
| Stat numeral | 40–48px | 800 | −0.02em | 1.0 |
| Nav / CTA | 14px | 500–600 | | |

Accent period on H2: last character as `<span class="text-[var(--accent)]">.</span>`.

### 3.3 Mobile type

Interactive fields **16px (`text-base`)** below `md` to avoid iOS zoom. Product H1 can drop to 18px. Marketing H1 ~28px with `leading-tight` and `break-words`.

---

## 4. Space, density, breakpoints

### 4.1 Rhythm

Use 4px base. Common steps: 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 32.

| Context | Padding / gap |
|---|---|
| Icon button | 36×36 (`h-9 w-9`), icon 16px |
| Default button | `h-9` (36px), `px-4`, gap-2 |
| Small button | `h-8` |
| Large / touch CTA | `h-10`–`h-11` |
| Card | 16–24px (`p-4` / `p-5` / `md:p-6`) |
| Settings row | `px-5 py-4` |
| App content | `px-4 py-5` → `md:px-6 md:py-7`, max-width **1090px**, **left-aligned** next to sidebar |
| Marketing container | max-width **1152px**, section `py-20`–`py-32` |
| Form stack | `gap-1.5` label→control; `gap-3` between fields |
| Inline form row | `gap-1.5`; stack full-width below `md` |

**App content is not centred in the leftover viewport.** Centring next to a fixed rail detaches nav from content on wide screens.

### 4.2 Breakpoints (unify on Tailwind)

| Token | Width | Typical behaviour |
|---|---|---|
| default | <768 | Single column; drawers; 44px min tap (`min-h-11`) |
| `md` | 768 | Sidebar icon-rail or full; two-column forms |
| `lg` | 1024 | Master/detail; inbox three panes; 2-col stats |
| marketing extra | ~900px | Nav links hide behind Menu |

**Product scroll:** lock `html`/`body` (`app-locked`); only the main pane scrolls (`overflow-y-auto`, `-webkit-overflow-scrolling: touch`). Marketing: document scroll; `overflow-x-clip` on the shell.

### 4.3 z-index

Skip link `z-[100]` · mobile nav overlay ~45–50 · sticky app header `z-[6]` · toasts `z-[80]` · modals `z-20+`. Prefer explicit values over competing `z-50` stacks.

---

## 5. Primitives (recipes)

Implement once. Restyle only via tokens.

### 5.1 Buttons

Heights: 36 / 32 / 40. App radius **12px**. Marketing primary **pill**. Icon 16px, gap 8px. Transition 150ms ease-out. Focus: `outline: none` + `--focus-ring`. Disabled: opacity 50%, no pointer.

| Variant | Fill | Text | Border |
|---|---|---|---|
| `primary` / `default` | `--accent` | `--accent-fg` | none; hover `--accent-hover` |
| `secondary` | `--surface-raised` | `--foreground` | 1px `--line-strong` |
| `outline` | transparent | `--foreground` | 1px `--line-strong` |
| `ghost` | transparent | `--foreground-muted` | none; hover `--surface-hover` |
| `danger` | transparent | `--error-text` | 1px error at 30%; hover 8% tint |
| `inverse` | `--foreground` | `--surface` | none — **proceed**, not create |
| `link` | none | `--accent-text` | underline on hover |

**Text button (inline):** no chrome; 13px medium; hover underline/border in accent (`tw.textButton`).

**Icon-only:** always `aria-label`. Pad to ≥36px hit target.

### 5.2 Inputs, selects, textareas

- Height 36px (`h-9`); radius 10px
- Fill `--surface-input`; border `--line-strong`
- Text 14px; placeholder `--foreground-faint`
- Focus: border `--accent` + focus ring
- Native `<select>` uses the same metrics (`tw.nativeControl`)
- Label: 14px medium, **sentence case** (never global uppercase on all labels)
- Helper: 12–13px muted under the field

Row forms: inputs `flex-1 min-w-0`; buttons `shrink-0`. On small screens inputs `min-w-full`, buttons `w-full`, text 16px.

### 5.3 Cards

`--surface-raised`, 1px `--line`, **16px radius**, padding 20–24px, **no shadow** in-app. Optional `shadow-none` explicit so themes stay clean.

**Settings card:** heading **outside** the card (15px/600 + 13px muted, then 24px gap). Inside: stacked rows with hairline dividers, last row no divider.

### 5.4 Badges / chips

Height 20px, radius 6px, `px-2`, 11px/600 uppercase tracking 0.04em. Tinted 12% semantic + solid semantic text. Variants: accent, success, warn, danger, secondary, outline.

Domain swatch: 10px circle (`h-2.5 w-2.5`) plus **readable domain text**.

### 5.5 Tabs vs segmented

- **Tabs:** underline. 14px/500, muted idle, foreground active, 2px accent bottom border, 1px `--line` across the row, ~20px gap, 16px padding under the rule. Switches *different content*.
- **Segmented:** same dataset, different view (7d/30d, week/month). Track `--surface-input`, 10px radius, 2px padding; active segment `--surface-raised`, 8px radius, slight shadow, 13px/500. `aria-pressed`.

Mobile tabs: horizontal scroll + edge fade, or a select. Never overflow without affordance.

### 5.6 Stat card

Eyebrow 11px uppercase faint → 28px mono numeral → 12px period muted → comparison 12px success/error/faint. Always render the comparison line (`Comparison unavailable` if needed) so a grid stays even height. 4 / 2 / 1 columns by breakpoint.

### 5.7 Empty state

Centered in a 16px-radius bordered card, **min-height 320px**:

1. Miniature **mock of the successful UI** (fake rows, chips) — not a generic illustration if you can avoid it. Fallback: 40px icon in a 64px `--surface-hover` circle.
2. Title 15px/600
3. Body 13px muted, max-width 380px
4. Same primary + secondary actions as the page header

### 5.8 Callout / notice

Radius 12px, `px-4 py-3`, 13px body, optional icon. Background 8% semantic, border 20%. `role="status"` or `role="alert"` for errors.

Accent notice: border/background from `--accent-rgb` at ~22% / 8%.

### 5.9 Toast

Bottom-right, overlay surface, 12px radius, 1px line, max-width ~360–380px, real shadow. Title 13px/600, body 12px muted, optional action. `role="status"`. Close control has `aria-label`. z-index above chrome.

### 5.10 Dialog / modal

Overlay `rgba(2,6,12,0.72)` + light blur. Panel overlay surface, 16px radius, 22px padding, `--shadow`. Desktop can anchor bottom-end; mobile full-bleed bottom sheet (`p-0` / full width). Enter 250ms `cubic-bezier(0.16, 1, 0.3, 1)`.

### 5.11 Checkbox / switch

16px control, 5px radius on checkbox, accent when checked. Label 14px medium, `gap-3`, wrapping with `min-w-0`. Don’t rely on native OS chrome that ignores tokens.

### 5.12 Avatar

24–32px circle, accent-dim fill, accent-text initials, 10px bold. List rows 22px.

### 5.13 `kbd`

1px `--line-strong`, 4px radius, hover surface, 12px mono, **accent** colour for the glyph.

### 5.14 Skip link

First focusable in the shell. Off-canvas until focus; raised surface + shadow + focus ring.

### 5.15 Skeleton

Pulse gradient `surface → surface-hover → surface` at 200% background-size. Row height ~72px for mail-like lists, 10px radius.

---

## 6. Layout recipes (pick one, keep the tokens)

### 6.1 Marketing site

**Structure:** Alternate `--surface` and `--landing-dark` bands. Close with full-bleed `--accent` CTA, then `#0c0c0c` footer. Accent stays orange on every band.

- Container 1152px
- Section padding ~80px mobile / 128px desktop
- Optional film grain (~3% SVG turbulence) on large fills
- **Nav:** floating centred pill, 24px from top, `backdrop-blur-[12px] saturate-150`, invert over dark via IntersectionObserver (`data-nav-theme`)
- Footer: uppercase tracked column headers, status pill (green dot + “All systems operational”), optional giant watermark wordmark at ~4% opacity
- Primary CTA in nav: pill; hide on the smallest widths in favour of Menu + dropdown

**Hero:** tight H1, 18px lede max ~52ch, one orange pill + optional secondary ghost. Proof visual on the right (product frame 16px radius, dark-band screenshots get heavy shadow).

### 6.2 Authenticated app shell

- Canvas `--surface`; sidebar **same fill**, separated by 1px `--line` (not a contrasting slab)
- Sidebar width **207px**; collapsed **56px** icon rail; `<md` off-canvas drawer `min(280px, 86vw)` + dim overlay
- Brand row 56px; micro-labels OVERVIEW / SYSTEM; nav items 40px, radius 12px, 16px icon + 14px/500 label
- **Active nav:** `--surface-active`, foreground text, **accent icon**, 3px accent bar on the left inset 4px
- Idle: muted; hover: `--surface-hover`
- Counts 12px faint, right-aligned
- Collapse persisted (`localStorage`)
- Header: sticky, min-height ~52–56px, 1px bottom line, blur optional (`color-mix(surface 92%, transparent)` + `backdrop-blur`)
- Main: `flex-1 min-h-0 overflow-y-auto overscroll-contain`

### 6.3 Master / detail (inbox, tickets, threads)

Desktop (`lg+`): rail | list | reader. Hairlines between columns. Typical widths: rail 260, list 280–340, reader `1fr`.

Below `lg`: **one pane at a time**. List full width; open item replaces list with reader + back. Do not stack reader under a long list.

List rows ~72px: primary 13px/600, meta 11px faint, preview 12px muted one line, identity chip with **text**. Unread: accent 3px left bar + heavier sender. Selected: `--surface-active`.

Reader: icon toolbar ghost buttons; identity line 12px mono faint; title 18px/700; body on raised canvas.

Compose: floating overlay (not a route) so context stays visible; 16px radius + shadow.

### 6.4 Feature / settings pages

Shared header + left-aligned 1090px column. Section title outside cards. Forms: stack; `rowForm` for input+button. Lists: bordered 12px-radius rows, stack on mobile, horizontal on `sm+`.

### 6.5 Auth

Full-viewport centre. Optional radial accent wash at 4–8% in corners. Card max-width 420px, 10–12px radius, strong line, padding ~28px, light shadow. One primary CTA. Quiet legal links.

### 6.6 Wizard / onboarding

Numbered steps, one primary action, blocked steps dimmed with a chip naming the dependency (`needs mailbox`). Recommended step: accent left bar + tinted row.

### 6.7 Data / analytics

Stat card grid. Charts use the chart token set. No fake “score” gauges. Empty chart uses the empty-state recipe.

### 6.8 Documentation / long-form

Prose 16px, measure ~65ch, H2/H3 with display tracking only if marketing-weight. Code: mono 13px, raised or overlay, 10px radius, copy button ghost.

---

## 7. Product UX patterns (behaviour, any layout)

These are why Flap feels like an **operator tool**, not a brochure.

1. **Identity before content.** Show receiving domain/address in the list, not only in the thread.
2. **Safe defaults.** Reply From is the receiving mailbox; override is explicit and does not leak to other threads.
3. **Keyboard-first.** Frequent actions have keys; `Cmd/Ctrl+K` if you have a palette; `Cmd+Enter` to send. Document in `kbd` chips.
4. **Setup feels finished.** Wizards end in inbound/outbound ready states, not a wall of raw DNS.
5. **Trust is visible.** Export, status, security, “what if I leave” — linked, not buried.
6. **One primary per region.** Header: one create (accent) and optionally one proceed (inverse).
7. **Destructive is quiet until hover.** Ghost/danger outline, not screaming red fills.
8. **Undo over confirm** where reversible (undo send). Confirm when irreversible (delete domain).
9. **Empty states teach the happy path.**
10. **Errors are readable and specific.** 13px `--error-text` on a 10% tint panel, `role="alert"`.
11. **Loading is skeleton or pulse, not a centred spinner on every pane.**
12. **Remote content is opt-in** (e.g. load images) when privacy matters.

Copy voice: short, concrete, no fake testimonials or invented metrics. Infrastructure terms (“Amazon SES”) belong in docs and honesty FAQs, not as the first headline.

---

## 8. Iconography and imagery

- **Lucide** (or equivalent 24px/1.5 stroke) at 16px in chrome, 14px in dense rows.
- No skeuomorphic illustration in the app. Marketing may use product frames and simple mailbox stacks.
- Brand mark: small square/mark in accent; wordmark 15px semibold tracking-tight, lowercase is a Flap choice — another product may title-case, but keep weight and tracking.
- Screenshots: 16px radius, 1px line; on dark bands add `0 25px 50px -12px rgba(0,0,0,0.5)`.

---

## 9. Motion

| Event | Duration | Easing |
|---|---|---|
| Hover, colour, border | 150ms | ease-out |
| Popover, dropdown | 200ms | ease-out |
| Modal, compose, drawer | 250ms | `cubic-bezier(0.16, 1, 0.3, 1)` |

No page-content entrance animation. Honour `prefers-reduced-motion`: cut grain animation and non-essential transitions.

---

## 10. Accessibility (non-negotiable)

1. Token pairs meet WCAG AA. Accent **text** uses `--accent-text` on light.
2. Every control has a visible `:focus-visible` ring. Never `outline: none` without `--focus-ring`.
3. Minimum 36px interactive height; 44px on primary mobile CTAs.
4. Tabs: `tablist` / `tab` / `aria-selected`. Nav: `aria-current="page"`. Icon buttons: `aria-label`.
5. Colour is never the only signal (status badge **words**, domain **name**).
6. Toasts `role="status"`; errors `role="alert"`.
7. Skip link present.
8. Hit targets on mobile: full-width primary actions; don’t put 8px ghost links as the only way to submit.

---

## 11. Implementation rules (this repo and ports)

1. **Tokens in CSS variables; layout in Tailwind on JSX.** Do not grow a component CSS file. `index.css` holds `@theme`, `:root` / `html.dark`, html/body lock, marketing-light, `kbd`, editor HTML you cannot class.
2. **Map tokens into `@theme`** so utilities like `bg-surface-raised` exist; otherwise Tailwind palette greys leak and ignore dark mode.
3. **Reuse `src/lib/tw.ts` patterns** (or an equivalent `tokens.ts`) for repeated recipes: notices, row forms, empty mocks, lists.
4. **z-index:** use `z-[80]` not invalid `z-80` if the toolchain requires it.
5. **No `!important` wars** between utilities and element selectors. Scope `label` styles to a class.
6. **Enforce:** no `#hex` in `src/**/*.tsx` except documented exceptions (third-party email `srcDoc` should still prefer tokens).

Flap component map (for ports):

| Primitive | File |
|---|---|
| Button | `src/components/ui/button.tsx` |
| Input / textarea | `input.tsx`, `textarea.tsx` |
| Badge | `badge.tsx` |
| Card | `card.tsx` |
| Tabs | `tabs.tsx` |
| Segmented | `segmented-control.tsx` |
| Settings | `settings-row.tsx` |
| Stat | `stat-card.tsx` |
| Empty | `empty-state.tsx` + `FeatureEmpty` |
| Callout | `callout.tsx` |
| Shared recipes | `src/lib/tw.ts` |
| App chrome | `AppShell.tsx`, `AppFeaturePage.tsx` |
| Marketing chrome | `MarketingShell.tsx` |

---

## 12. Screen checklist (use on every mock)

- [ ] One accent primary in the region; inverse for “continue”
- [ ] Surfaces: canvas vs raised vs input are distinguishable
- [ ] Hairline borders; no card shadow in-app
- [ ] Type from the **correct** scale (product vs marketing)
- [ ] H1 + subtitle + actions share one header row on app pages
- [ ] Labels sentence case; eyebrows are the only all-caps
- [ ] Focus ring on every control in the mock
- [ ] Empty / error / loading designed, not afterthoughts
- [ ] Mobile: full-width CTAs, 16px inputs, no horizontal overflow
- [ ] Identity/status encoded in **text**, not only colour
- [ ] Copy is specific; no lorem; no fake metrics

---

## 13. Anti-patterns

- Charcoal or bone-white “primary” buttons
- Cool gray Tailwind defaults (`neutral-500`, `bg-white`) beside token surfaces
- Pill buttons in data tables
- Marketing 56px type in settings
- Centred 640px column beside a 207px sidebar
- Three orange buttons in one toolbar
- Drop shadows on every dashboard card
- Global `label { text-transform: uppercase }`
- Unreadable error pink on white
- Colour-only unread or domain state
- Auto-playing motion / grain when `prefers-reduced-motion`

---

## 14. Quick token paste (for a new project)

```css
:root {
  --surface: #faf9f6;
  --surface-raised: #ffffff;
  --surface-overlay: #ffffff;
  --surface-hover: #f0ede6;
  --surface-active: #ebe9e4;
  --surface-input: #f5f4f1;
  --foreground: #141211;
  --foreground-muted: #64615a;
  --foreground-faint: #7a756d;
  --foreground-disabled: #c4c0b8;
  --line: #e2dfd8;
  --line-strong: #cbc7be;
  --success-text: #047857;
  --error-text: #b91c1c;
  --warning-text: #92400e;
  --accent: #f26522;
  --accent-hover: #e05a1a;
  --accent-text: #b84a0a;
  --accent-fg: #ffffff;
  --accent-rgb: 242, 101, 34;
  --accent-dim: rgba(242, 101, 34, 0.10);
  --radius: 10px;
  --shadow: 0 1px 2px rgba(20, 18, 17, 0.04), 0 12px 32px rgba(20, 18, 17, 0.06);
  --focus-ring: 0 0 0 3px rgba(242, 101, 34, 0.35);
  --font-ui: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

Change **layout**. Do not change this physics if you want it to still look like Flap.

---

*Measured and reconciled against Flap production tokens in `src/index.css` and primitives in `src/components/ui/` (2026).*
