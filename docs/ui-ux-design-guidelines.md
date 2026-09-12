# Flap UI / UX Guidelines

## Direction

Flap should feel like a focused operating console for people who manage email across multiple domains. The design should be calm, compact, and product-led, with enough personality to feel founder-built rather than generic.

## Palette

| Token | Value | Use |
|---|---|---|
| `--surface` | `#faf9f6` | Public page background. |
| `--surface-raised` | `#ffffff` | Cards, panels, and popovers. |
| `--foreground` | `#141211` | Primary text. |
| `--foreground-muted` | `#64615a` | Secondary text. |
| `--line` | `#e2dfd8` | Borders and separators. |
| `--accent` | `#2563eb` | Primary actions, active states, focus, and brand mark. |
| `--accent-hover` | `#1d4ed8` | Hover state for accent surfaces. |
| `--accent-text` | `#1e40af` | Links and small accent text on light surfaces. |

Accent should stay sparse. Use it to answer "what can I do next?" rather than as decoration.

## Product Principles

- Lead with the multi-domain workflow: domains enter one inbox, replies leave from the address that received the message.
- Show product surfaces as real interface fragments, not abstract marketing shapes.
- Keep page sections unframed unless they are repeated cards, product mockups, or pricing cards.
- Use plain language. Avoid inflated claims and invented social proof.
- Any preview or partial feature must say so clearly.

## Marketing Pages

Recommended homepage arc:

1. Multi-domain founder hero.
2. Inbox sprawl problem.
3. Correct reply identity.
4. Guided DNS setup.
5. Portfolio inbox.
6. Team and API expansion.
7. Trust, export, and infrastructure.
8. Pricing.
9. FAQ.

Avoid copying another company's section sequence, testimonials, feature bundle, or pricing story.

## App Surfaces

- Keep action rows compact and predictable.
- Prefer data tables, segmented controls, toggles, and explicit form labels.
- Use cards only for repeated resources, modals, settings panels, and product previews.
- Empty states should include the missing object, the next action, and one clear button.
- Do not market unshipped protocols or external-client support inside setup flows.

## Copy Rules

- Say "custom-domain email" and "multi-domain inbox" when describing the core product.
- Say "web/PWA today" when discussing current client access.
- Say "planned" or "preview" for AI, protocol, calendar sync, and newsletter collaboration until those paths are live.
- Never use fabricated ratings, fake testimonials, or borrowed customer names.
