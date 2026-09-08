import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Menu, X } from "lucide-react";
import BrandMark from "../BrandMark";
import MarketingShell from "../MarketingShell";
import { Callout } from "../ui/callout";
import { cn } from "../../lib/utils";
import {
  DOCS_FLAT,
  DOCS_FOOTER_LINKS,
  DOCS_NAV,
  docsPrevNext,
  type DocsNavGroup,
  type DocsNavItem,
  type TocItem,
} from "../../content/docs-nav";
import { go } from "../../lib/nav";

function DocsLink({
  href,
  className,
  children,
  onNavigate,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        onNavigate?.();
        go(href);
      }}
    >
      {children}
    </a>
  );
}

function NavLinks({
  pathname,
  nav,
  footerLinks,
  onNavigate,
}: {
  pathname: string;
  nav: DocsNavGroup[];
  footerLinks: DocsNavItem[];
  onNavigate?: () => void;
}) {
  const roots = nav.flatMap((g) => g.items.map((i) => i.href)).filter((h) => h.split("/").length === 2);

  return (
    <div className="space-y-6">
      {nav.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const exact = pathname === item.href;
              const isRootIndex = roots.includes(item.href);
              const nested =
                !isRootIndex &&
                pathname.startsWith(`${item.href}/`) &&
                !group.items.some(
                  (other) =>
                    other.href !== item.href &&
                    other.href.startsWith(`${item.href}/`) &&
                    (pathname === other.href || pathname.startsWith(`${other.href}/`)),
                );
              const active = exact || nested;
              return (
                <li key={item.href}>
                  <DocsLink
                    href={item.href}
                    onNavigate={onNavigate}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-[var(--surface-active)] font-medium text-[var(--foreground)]"
                        : "text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {item.label}
                  </DocsLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {footerLinks.length ? (
        <div className="space-y-1 border-t border-[var(--line)] pt-4 text-xs text-[var(--foreground-muted)]">
          {footerLinks.map((link) => (
            <DocsLink
              key={link.href}
              href={link.href}
              className="block px-2 hover:text-[var(--foreground)]"
              onNavigate={onNavigate}
            >
              {link.label}
            </DocsLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SideNav({
  pathname,
  nav,
  brandHref,
  brandLabel,
  footerLinks,
}: {
  pathname: string;
  nav: DocsNavGroup[];
  brandHref: string;
  brandLabel: string;
  footerLinks: DocsNavItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mb-2 flex items-center justify-between lg:hidden">
        <DocsLink
          href={brandHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"
        >
          <BrandMark className="brand-mark !h-7 !w-7" />
          {brandLabel}
        </DocsLink>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-3.5 w-3.5" />
          Menu
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu overlay"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-[var(--line)] bg-[var(--surface)] p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <DocsLink
                href={brandHref}
                className="inline-flex items-center gap-2 text-sm font-semibold"
                onNavigate={() => setOpen(false)}
              >
                <BrandMark className="brand-mark !h-7 !w-7" />
                {brandLabel}
              </DocsLink>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto">
              <NavLinks pathname={pathname} nav={nav} footerLinks={footerLinks} onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}

      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
          <div className="mb-5 px-2">
            <DocsLink
              href={brandHref}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"
            >
              <BrandMark className="brand-mark !h-7 !w-7" />
              {brandLabel}
            </DocsLink>
          </div>
          <NavLinks pathname={pathname} nav={nav} footerLinks={footerLinks} />
        </div>
      </aside>
    </>
  );
}

function DocsToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id || "");

  useEffect(() => {
    if (!items.length) return;
    const els = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top > b.boundingClientRect.top ? 1 : -1));
        if (visible[0]?.target?.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-100px 0px -55% 0px", threshold: [0, 1] },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  if (!items.length) return null;

  return (
    <nav className="space-y-1 text-xs" aria-label="On this page">
      <p className="mb-2 font-medium text-[var(--foreground-muted)]">On this page</p>
      <ul className="space-y-1 border-l border-[var(--line)]">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                "block border-l-2 py-1 transition-colors",
                (item.level || 2) === 3 ? "pl-4" : "pl-3",
                active === item.id
                  ? "border-[var(--accent)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
              )}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function DocsPrevNext({ href, flatNav }: { href: string; flatNav: DocsNavItem[] }) {
  const { prev, next } = docsPrevNext(href, flatNav);
  if (!prev && !next) return null;
  return (
    <nav className="mt-12 grid gap-3 border-t border-[var(--line)] pt-6 sm:grid-cols-2" aria-label="Page navigation">
      {prev ? (
        <DocsLink
          href={prev.href}
          className="group flex flex-col gap-1 rounded-lg border border-[var(--line)] p-4 hover:bg-[var(--surface-hover)]"
        >
          <span className="text-xs text-[var(--foreground-muted)]">Previous</span>
          <span className="text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--accent-text)]">
            {prev.label}
          </span>
        </DocsLink>
      ) : (
        <div />
      )}
      {next ? (
        <DocsLink
          href={next.href}
          className="group flex flex-col items-end gap-1 rounded-lg border border-[var(--line)] p-4 text-right hover:bg-[var(--surface-hover)]"
        >
          <span className="text-xs text-[var(--foreground-muted)]">Next</span>
          <span className="text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--accent-text)]">
            {next.label}
          </span>
        </DocsLink>
      ) : null}
    </nav>
  );
}

export type DocsShellProps = {
  pathname: string;
  children: ReactNode;
  nav?: DocsNavGroup[];
  flatNav?: DocsNavItem[];
  brandHref?: string;
  brandLabel?: string;
  footerLinks?: DocsNavItem[];
};

export function DocsShell({
  pathname,
  children,
  nav = DOCS_NAV,
  brandHref = "/docs",
  brandLabel = "Docs",
  footerLinks = DOCS_FOOTER_LINKS,
}: DocsShellProps) {
  return (
    <MarketingShell>
      <div className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 lg:flex-row lg:gap-8 lg:px-6 lg:py-8">
          <SideNav
            pathname={pathname}
            nav={nav}
            brandHref={brandHref}
            brandLabel={brandLabel}
            footerLinks={footerLinks}
          />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </MarketingShell>
  );
}

export function DocsPage({
  href,
  title,
  description,
  toc = [],
  rightRail,
  flatNav = DOCS_FLAT,
  children,
}: {
  href: string;
  title: string;
  description?: string;
  toc?: TocItem[];
  rightRail?: ReactNode;
  flatNav?: DocsNavItem[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 gap-8">
      <article className="min-w-0 flex-1">
        <header className="mb-8 space-y-3">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-base text-[var(--foreground-muted)]">{description}</p>
          ) : null}
        </header>

        {toc.length > 0 ? (
          <div className="mb-8 xl:hidden">
            <DocsToc items={toc} />
          </div>
        ) : null}

        <div className="docs-prose space-y-4 text-sm leading-relaxed text-[var(--foreground-muted)] [&_a]:text-[var(--accent-text)] [&_a]:underline-offset-4 hover:[&_a]:underline [&_code]:rounded [&_code]:bg-[var(--surface-hover)] [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-[var(--foreground)] [&_h2]:mt-10 [&_h2]:scroll-mt-28 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-[var(--foreground)] [&_h3]:mt-6 [&_h3]:scroll-mt-28 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[var(--foreground)] [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p]:max-w-2xl [&_strong]:text-[var(--foreground)] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </div>

        <DocsPrevNext href={href} flatNav={flatNav} />
      </article>

      <aside className="hidden w-56 shrink-0 xl:block">
        <div className="sticky top-28 max-h-[calc(100vh-8rem)] space-y-8 overflow-y-auto">
          {toc.length > 0 ? <DocsToc items={toc} /> : null}
          {rightRail}
        </div>
      </aside>
    </div>
  );
}

export function DocsRelated({ links }: { links: Array<{ href: string; label: string }> }) {
  if (!links.length) return null;
  return (
    <div className="space-y-2 text-xs">
      <p className="font-medium text-[var(--foreground-muted)]">Related</p>
      <ul className="space-y-1">
        {links.map((l) => (
          <li key={l.href}>
            <DocsLink href={l.href} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
              {l.label}
            </DocsLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DocsCallout({
  type = "info",
  title,
  children,
}: {
  type?: "info" | "warning" | "tip";
  title?: string;
  children: ReactNode;
}) {
  const variant = type === "tip" ? "success" : type === "warning" ? "warning" : "info";
  return (
    <Callout variant={variant} className="not-prose my-4">
      <div className="space-y-1">
        {title ? <p className="font-medium text-[var(--foreground)]">{title}</p> : null}
        <div className="text-[var(--foreground-muted)] [&_a]:text-[var(--accent-text)] [&_code]:font-mono [&_code]:text-xs">
          {children}
        </div>
      </div>
    </Callout>
  );
}

export function DocsSteps({ children }: { children: ReactNode }) {
  return <ol className="not-prose my-6 space-y-6">{children}</ol>;
}

export function DocsStep({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="relative flex gap-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-raised)] text-xs font-semibold tabular-nums text-[var(--foreground)]">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2 pb-2">
        <h3 className="text-base font-semibold tracking-tight text-[var(--foreground)]">{title}</h3>
        <div className="space-y-3 text-sm text-[var(--foreground-muted)] [&_a]:text-[var(--accent-text)] [&_code]:rounded [&_code]:bg-[var(--surface-hover)] [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_code]:text-[var(--foreground)]">
          {children}
        </div>
      </div>
    </li>
  );
}

export function CodeBlock({
  code,
  language,
  className,
  title,
}: {
  code: string;
  language?: string;
  className?: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cn(
        "not-prose overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-raised)]",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-hover)_70%,transparent)] px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
          {title || language || "code"}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--foreground-muted)] hover:bg-[var(--surface-active)] hover:text-[var(--foreground)]"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3 w-3 text-[var(--success-text)]" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-[var(--foreground)]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function CodeTabs({
  tabs,
  defaultValue,
  className,
}: {
  tabs: Array<{ id: string; label: string; code: string; language?: string }>;
  defaultValue?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue || tabs[0]?.id || "");
  const active = tabs.find((t) => t.id === value) || tabs[0];
  if (!tabs.length || !active) return null;
  return (
    <div className={cn("not-prose space-y-2", className)}>
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-hover)] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setValue(t.id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              value === t.id
                ? "bg-[var(--surface-raised)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <CodeBlock code={active.code} language={active.language || active.id} />
    </div>
  );
}
