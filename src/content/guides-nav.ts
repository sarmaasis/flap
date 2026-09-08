import { GUIDE_PAGES } from "./marketing";
import type { DocsNavGroup, DocsNavItem } from "./docs-nav";

export const GUIDES_NAV: DocsNavGroup[] = [
  {
    title: "DNS guides",
    items: [
      { href: "/guides", label: "All guides", description: "Registrar index" },
      ...GUIDE_PAGES.map((g) => ({
        href: g.path,
        label: g.title.replace(/ DNS for Flap( email)?$/i, "").replace(/ for Flap$/i, "").replace(" Domains DNS", ""),
        description: g.description,
      })),
    ],
  },
  {
    title: "Related",
    items: [
      { href: "/docs/getting-started", label: "Getting started" },
      { href: "/tools", label: "DNS tools" },
      { href: "/docs", label: "Developer docs" },
    ],
  },
];

export const GUIDES_FLAT: DocsNavItem[] = [
  { href: "/guides", label: "All guides" },
  ...GUIDE_PAGES.map((g) => ({
    href: g.path,
    label: g.title.replace(" | Flap", ""),
  })),
];

export const GUIDES_FOOTER_LINKS: DocsNavItem[] = [
  { href: "/tools/email-setup-checker", label: "Setup checker" },
  { href: "/docs", label: "Docs" },
  { href: "/support", label: "Support" },
];
