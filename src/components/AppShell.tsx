import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Code2,
  Contact,
  CreditCard,
  Globe2,
  Inbox,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessageCircle,
  Rocket,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import type { FolderCounts } from "../lib/api";
import { folderBadge } from "../lib/mailFolders";
import { go } from "../lib/nav";
import { tw } from "../lib/tw";
import { cn } from "../lib/utils";
import BrandMark from "./BrandMark";
import { ThemeToggle } from "./ThemeProvider";

export { FOLDERS } from "../lib/mailFolders";

export type AppNavId =
  | "get-started"
  | "inbox"
  | "calendar"
  | "ai"
  | "domains"
  | "mailboxes"
  | "contacts"
  | "newsletters"
  | "bookings"
  | "analytics"
  | "settings"
  | "developer"
  | "billing"
  | "docs";

const OVERVIEW: Array<{ id: AppNavId; label: string; href: string; icon: typeof Inbox }> = [
  { id: "get-started", label: "Get started", href: "/app/get-started", icon: Rocket },
  { id: "inbox", label: "Inbox", href: "/app", icon: Inbox },
  { id: "calendar", label: "Calendar", href: "/app/calendar", icon: CalendarDays },
  { id: "ai", label: "AI assistant", href: "/app/ai", icon: Bot },
  { id: "domains", label: "Domains", href: "/app/domains", icon: Globe2 },
  { id: "mailboxes", label: "Mailboxes", href: "/app/mailboxes", icon: Mail },
  { id: "contacts", label: "Contacts", href: "/app/contacts", icon: Contact },
  { id: "newsletters", label: "Newsletters", href: "/app/newsletters", icon: Megaphone },
  { id: "bookings", label: "Bookings", href: "/app/bookings", icon: CalendarDays },
  { id: "analytics", label: "Analytics", href: "/app/analytics", icon: BarChart3 },
];

const SYSTEM: Array<{ id: AppNavId; label: string; href: string; icon: typeof SettingsIcon }> = [
  { id: "settings", label: "Settings", href: "/app/settings", icon: SettingsIcon },
  { id: "developer", label: "Developer", href: "/app/developer", icon: Code2 },
  { id: "billing", label: "Billing", href: "/app/billing", icon: CreditCard },
  { id: "docs", label: "Docs", href: "/docs", icon: BookOpen },
];

const COLLAPSE_KEY = "flap-sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function initialsFromEmail(email: string) {
  const local = email.split("@")[0] || email;
  const parts = local.split(/[._\-+]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase() || "?";
}

/** Product shell: workspace + system nav. Mail folders live in the inbox three-pane. */
export default function AppShell({
  email,
  counts,
  current,
  onCompose: _onCompose,
  onLogout,
  children,
}: {
  email: string;
  counts?: FolderCounts;
  current: AppNavId | "mail" | "settings";
  onCompose?: () => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("app-locked");
    return () => document.documentElement.classList.remove("app-locked");
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const navCurrent: AppNavId =
    current === "mail" ? "inbox" : current === "settings" ? "settings" : current;

  function persistCollapsed(next: boolean) {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function navClick(href: string) {
    setMobileOpen(false);
    go(href);
  }

  const displayName = email.includes("@") ? email.split("@")[0] : email;

  const sideBtn = (active: boolean) =>
    cn(
      "relative flex w-full min-h-10 items-center justify-between rounded-xl border-0 bg-transparent px-2.5 py-1.5 text-left text-sm font-medium text-[var(--foreground-muted)] no-underline hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
      active && "bg-[var(--surface-active)] text-[var(--foreground)]",
      collapsed && "justify-center px-1.5",
    );

  return (
    <>
      <a className={tw.skipLink} href="#main-content">
        Skip to content
      </a>
      <div
        className={cn(
          "flex h-full max-h-dvh flex-col overflow-hidden bg-[var(--surface)] max-md:relative md:grid",
          collapsed ? "md:grid-cols-[56px_minmax(0,1fr)]" : "md:grid-cols-[207px_minmax(0,1fr)]",
        )}
      >
        <button
          type="button"
          className={cn(
            "fixed inset-0 z-45 border-0 bg-black/45 transition-opacity md:hidden",
            mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-label="Close navigation"
          tabIndex={mobileOpen ? 0 : -1}
          onClick={() => setMobileOpen(false)}
        />

        <aside
          className={cn(
            "relative z-40 flex h-full min-h-0 min-w-0 flex-col gap-1 overflow-hidden overscroll-none border-r border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)]",
            collapsed ? "px-1.5 pb-3" : "px-2 pb-3",
            "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:h-full max-md:w-[min(280px,86vw)] max-md:border-r max-md:transition-transform",
            mobileOpen ? "max-md:translate-x-0 max-md:shadow-[0_10px_40px_rgba(0,0,0,0.25)]" : "max-md:-translate-x-[105%]",
          )}
          aria-label="Application"
        >
          <div
            className={cn(
              "flex min-h-14 items-center gap-1 px-1",
              collapsed && "flex-col gap-2 pt-2",
            )}
          >
            <a
              className={cn(
                tw.brand,
                "min-w-0 flex-1 px-2 text-[15px] text-[var(--foreground)]",
                collapsed && "justify-center px-0",
              )}
              href="/app"
              onClick={(e) => {
                e.preventDefault();
                navClick("/app");
              }}
            >
              <BrandMark className="inline-flex h-[26px] w-[26px] items-center justify-center" />
              <span className={cn(collapsed && "hidden")}>flap</span>
            </a>
            <button
              type="button"
              className="hidden h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] md:inline-flex"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={collapsed}
              onClick={() => persistCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] md:hidden"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto overscroll-contain pb-2">
            <nav className="flex min-h-0 shrink-0 flex-col gap-1" aria-label="Overview">
              <span
                className={cn(
                  "mx-2.5 mb-1 block px-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground-faint)]",
                  collapsed && "hidden",
                )}
              >
                Overview
              </span>
              {OVERVIEW.map((item) => {
                const Icon = item.icon;
                const active = navCurrent === item.id;
                const inboxUnread = item.id === "inbox" ? folderBadge("inbox", counts) : 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    aria-current={active ? "page" : undefined}
                    className={sideBtn(active)}
                    onClick={() => navClick(item.href)}
                  >
                    {active ? (
                      <span className={cn("absolute top-1 bottom-1 w-[3px] rounded-sm bg-[var(--accent)]", collapsed ? "left-0.5" : "left-1")} />
                    ) : null}
                    <span className={cn("inline-flex min-w-0 items-center gap-2", collapsed && "justify-center")}>
                      <Icon className={cn("h-4 w-4 shrink-0 opacity-90", active && "text-[var(--accent)] opacity-100")} aria-hidden />
                      <span className={cn("truncate", collapsed && "hidden")}>{item.label}</span>
                    </span>
                    {inboxUnread ? (
                      <span className={cn("text-xs tabular-nums text-[var(--foreground-faint)]", collapsed && "hidden")}>
                        {inboxUnread}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>

            <nav className="flex min-h-0 shrink-0 flex-col gap-1" aria-label="System">
              <span
                className={cn(
                  "mx-2.5 mb-1 block px-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground-faint)]",
                  collapsed && "hidden",
                )}
              >
                System
              </span>
              {SYSTEM.map((item) => {
                const Icon = item.icon;
                const active = navCurrent === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    aria-current={active ? "page" : undefined}
                    className={sideBtn(active)}
                    onClick={() => navClick(item.href)}
                  >
                    {active ? (
                      <span className={cn("absolute top-1 bottom-1 w-[3px] rounded-sm bg-[var(--accent)]", collapsed ? "left-0.5" : "left-1")} />
                    ) : null}
                    <span className={cn("inline-flex min-w-0 items-center gap-2", collapsed && "justify-center")}>
                      <Icon className={cn("h-4 w-4 shrink-0 opacity-90", active && "text-[var(--accent)] opacity-100")} aria-hidden />
                      <span className={cn(collapsed && "hidden")}>{item.label}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto flex shrink-0 flex-col gap-1 border-t border-[var(--line)] pt-2">
            <a
              className={sideBtn(false)}
              href="/support"
              onClick={(e) => {
                e.preventDefault();
                navClick("/support");
              }}
            >
              <span className={cn("inline-flex min-w-0 items-center gap-2", collapsed && "justify-center")}>
                <MessageCircle className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <span className={cn(collapsed && "hidden")}>Chat with us</span>
              </span>
            </a>
            <div className={cn("px-1.5 py-1", collapsed && "hidden")}>
              <ThemeToggle />
            </div>
            <button type="button" className={sideBtn(false)} onClick={() => void onLogout()}>
              <span className={cn("inline-flex min-w-0 items-center gap-2", collapsed && "justify-center")}>
                <LogOut className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <span className={cn(collapsed && "hidden")}>Sign out</span>
              </span>
            </button>
            <div
              className={cn("flex min-w-0 items-center gap-2 px-2.5 py-2", collapsed && "justify-center px-0")}
              title={email}
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-dim)] text-[10px] font-bold text-[var(--accent-text)]" aria-hidden>
                {initialsFromEmail(email || "?")}
              </span>
              <span className={cn("flex min-w-0 flex-col", collapsed && "hidden")}>
                <span className="truncate text-[13px] font-medium text-[var(--foreground)]">{displayName || "…"}</span>
                <span className="truncate font-mono text-[11px] text-[var(--foreground-faint)]">{email}</span>
              </span>
            </div>
          </div>
        </aside>

        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden" id="main-content">
          <header className="flex min-h-[52px] shrink-0 items-center gap-2.5 border-b border-[var(--line)] bg-[var(--surface)] px-3 md:hidden">
            <button
              type="button"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <a
              className={cn(tw.brand, "gap-2 text-[15px] text-[var(--foreground)]")}
              href="/app"
              onClick={(e) => {
                e.preventDefault();
                go("/app");
              }}
            >
              <BrandMark className="inline-flex h-[26px] w-[26px] items-center justify-center" />
              <span>flap</span>
            </a>
          </header>
          {children}
        </div>
      </div>
    </>
  );
}
