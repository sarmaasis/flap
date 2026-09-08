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
import { cn } from "../lib/utils";
import BrandMark from "./BrandMark";
import { ThemeToggle } from "./ThemeProvider";
import { Separator } from "./ui/separator";

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

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div
        className={cn("app-shell", collapsed && "app-shell-collapsed", mobileOpen && "app-shell-mobile-open")}
      >
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          tabIndex={mobileOpen ? 0 : -1}
          onClick={() => setMobileOpen(false)}
        />

        <aside className="sidebar" aria-label="Application">
          <div className="sidebar-brand-row">
            <a
              className="brand"
              href="/app"
              onClick={(e) => {
                e.preventDefault();
                navClick("/app");
              }}
            >
              <BrandMark />
              <span className="brand-wordmark">flap</span>
            </a>
            <button
              type="button"
              className="sidebar-collapse-btn"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={collapsed}
              onClick={() => persistCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className="sidebar-mobile-close"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="sidebar-scroll">
            <nav className="folder-nav" aria-label="Overview">
              <span className="sidebar-section">Overview</span>
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
                    className={cn("side-btn", active && "active")}
                    onClick={() => navClick(item.href)}
                  >
                    <span className="side-btn-main">
                      <Icon className="side-btn-icon" aria-hidden />
                      <span className="side-btn-label truncate">{item.label}</span>
                    </span>
                    {inboxUnread ? (
                      <span className="side-count">{inboxUnread}</span>
                    ) : null}
                  </button>
                );
              })}
            </nav>

            <nav className="folder-nav" aria-label="System">
              <span className="sidebar-section">System</span>
              {SYSTEM.map((item) => {
                const Icon = item.icon;
                const active = navCurrent === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn("side-btn", active && "active")}
                    onClick={() => navClick(item.href)}
                  >
                    <span className="side-btn-main">
                      <Icon className="side-btn-icon" aria-hidden />
                      <span className="side-btn-label">{item.label}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="side-foot">
            <a
              className="side-btn side-support"
              href="/support"
              onClick={(e) => {
                e.preventDefault();
                navClick("/support");
              }}
            >
              <span className="side-btn-main">
                <MessageCircle className="side-btn-icon" aria-hidden />
                <span className="side-btn-label">Chat with us</span>
              </span>
            </a>
            <Separator className="side-foot-sep" />
            <div className="side-theme">
              <ThemeToggle />
            </div>
            <button type="button" className="side-btn" onClick={() => void onLogout()}>
              <span className="side-btn-main">
                <LogOut className="side-btn-icon" aria-hidden />
                <span className="side-btn-label">Sign out</span>
              </span>
            </button>
            <div className="side-account" title={email}>
              <span className="side-avatar" aria-hidden>
                {initialsFromEmail(email || "?")}
              </span>
              <span className="side-account-meta">
                <span className="side-account-name">{displayName || "…"}</span>
                <span className="side-email">{email}</span>
              </span>
            </div>
          </div>
        </aside>

        <div className="app-shell-content" id="main-content">
          <header className="app-mobile-bar">
            <button
              type="button"
              className="app-mobile-menu"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <a
              className="brand brand-mobile"
              href="/app"
              onClick={(e) => {
                e.preventDefault();
                go("/app");
              }}
            >
              <BrandMark />
              <span>flap</span>
            </a>
          </header>
          {children}
        </div>
      </div>
    </>
  );
}
