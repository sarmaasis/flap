import { FOR_PAGES, VS_PAGES } from "./hubs";
import type { DocsNavGroup, DocsNavItem } from "./docs-nav";

export const FOR_NAV: DocsNavGroup[] = [
  {
    title: "Use cases",
    items: [
      { href: "/for", label: "All roles", description: "Pick your ICP" },
      ...FOR_PAGES.map((p) => ({
        href: p.path,
        label: p.h1.replace(/^Email for /i, ""),
        description: p.description,
      })),
    ],
  },
  {
    title: "Related",
    items: [
      { href: "/vs", label: "Compare Flap" },
      { href: "/pricing", label: "Pricing" },
      { href: "/docs", label: "Docs" },
    ],
  },
];

export const FOR_FLAT: DocsNavItem[] = [
  { href: "/for", label: "All roles" },
  ...FOR_PAGES.map((p) => ({ href: p.path, label: p.h1 })),
];

export const VS_NAV: DocsNavGroup[] = [
  {
    title: "Compare",
    items: [
      { href: "/vs", label: "All comparisons", description: "Pick a competitor" },
      ...VS_PAGES.map((p) => ({
        href: p.path,
        label: p.h1.replace(/^Flap vs /i, "vs "),
        description: p.description,
      })),
    ],
  },
  {
    title: "Related",
    items: [
      { href: "/for", label: "Who it's for" },
      { href: "/pricing", label: "Pricing" },
      { href: "/tools/google-workspace-cost-calculator", label: "Cost calculator" },
    ],
  },
];

export const VS_FLAT: DocsNavItem[] = [
  { href: "/vs", label: "All comparisons" },
  ...VS_PAGES.map((p) => ({ href: p.path, label: p.h1 })),
];

export const HUB_FOOTER_LINKS: DocsNavItem[] = [
  { href: "/signup", label: "Start free" },
  { href: "/pricing", label: "Pricing" },
  { href: "/support", label: "Support" },
];
