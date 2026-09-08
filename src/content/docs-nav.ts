export type DocsNavItem = {
  href: string;
  label: string;
  description?: string;
};

export type DocsNavGroup = {
  title: string;
  items: DocsNavItem[];
};

export type TocItem = { id: string; label: string; level?: 2 | 3 };

export const DOCS_NAV: DocsNavGroup[] = [
  {
    title: "Start here",
    items: [
      { href: "/docs", label: "Overview", description: "Orientation and quick links" },
      { href: "/docs/getting-started", label: "Getting started", description: "Domain to first send" },
      { href: "/docs/concepts", label: "Core concepts", description: "Domains, mailboxes, keys" },
    ],
  },
  {
    title: "Guides",
    items: [
      { href: "/docs/webhooks", label: "Webhooks", description: "Events, signing, verify" },
      { href: "/guides", label: "DNS guides", description: "Registrar setup walkthroughs" },
    ],
  },
  {
    title: "API",
    items: [
      { href: "/docs/api", label: "API overview", description: "Auth, send, errors, limits" },
    ],
  },
];

export const DOCS_FLAT: DocsNavItem[] = DOCS_NAV.flatMap((g) => g.items).filter((item) =>
  item.href.startsWith("/docs"),
);

export function docsPrevNext(
  href: string,
  flat: DocsNavItem[] = DOCS_FLAT,
): { prev?: DocsNavItem; next?: DocsNavItem } {
  const idx = flat.findIndex((i) => i.href === href);
  if (idx < 0) return {};
  return {
    prev: idx > 0 ? flat[idx - 1] : undefined,
    next: idx < flat.length - 1 ? flat[idx + 1] : undefined,
  };
}

export const DOCS_PATHS = [
  "/docs",
  "/docs/getting-started",
  "/docs/concepts",
  "/docs/webhooks",
  "/docs/api",
] as const;

export const DOCS_FOOTER_LINKS: DocsNavItem[] = [
  { href: "/llms.txt", label: "llms.txt" },
  { href: "/app/developer", label: "Developers settings" },
  { href: "/support", label: "Support" },
];
