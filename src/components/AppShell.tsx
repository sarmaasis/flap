import { useEffect, type CSSProperties, type ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  Code2,
  Contact,
  CreditCard,
  Globe2,
  Inbox,
  LogOut,
  Mail,
  Megaphone,
  PenSquare,
  Rocket,
  Settings as SettingsIcon,
} from "lucide-react";
import type { Domain, FolderCounts } from "../lib/api";
import { go } from "../lib/nav";
import { cn } from "../lib/utils";
import BrandMark from "./BrandMark";
import { ThemeToggle } from "./ThemeProvider";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

export const FOLDERS = [
  { id: "inbox", label: "Inbox" },
  { id: "starred", label: "Starred" },
  { id: "snoozed", label: "Snoozed" },
  { id: "drafts", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "sent", label: "Sent" },
  { id: "archive", label: "Archive" },
  { id: "spam", label: "Spam" },
  { id: "trash", label: "Trash" },
] as const;

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
  { id: "contacts", label: "Contacts", href: "/app/settings?tab=contacts", icon: Contact },
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

function folderBadge(id: string, counts?: FolderCounts) {
  const badge = counts?.[id];
  const unread = badge?.unread ?? 0;
  const total = badge?.total ?? 0;
  if (id === "inbox" || id === "drafts" || id === "scheduled") return unread || total;
  return unread;
}

export default function AppShell({
  email,
  counts,
  folder,
  current,
  domains,
  domainUnread,
  domainFilter,
  onDomainFilter,
  onFolder,
  onCompose,
  onLogout,
  children,
}: {
  email: string;
  counts?: FolderCounts;
  folder?: string;
  current: AppNavId | "mail" | "settings";
  domains?: Domain[];
  domainUnread?: Record<string, number>;
  domainFilter?: string;
  onDomainFilter?: (domainId: string) => void;
  onFolder?: (id: string) => void;
  onCompose?: () => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    document.documentElement.classList.add("app-locked");
    return () => document.documentElement.classList.remove("app-locked");
  }, []);

  const navCurrent: AppNavId =
    current === "mail" ? "inbox" : current === "settings" ? "settings" : current;
  const showMailFolders = navCurrent === "inbox";
  const showDomainRail = showMailFolders && domains && domains.length > 0 && onDomainFilter;

  function navClick(href: string) {
    if (href.startsWith("http") || href === "/docs") {
      go(href);
      return;
    }
    go(href);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/app" onClick={(e) => { e.preventDefault(); go("/app"); }}>
          <BrandMark />
          <span>flap</span>
        </a>
        <Button
          className="compose-button w-full"
          type="button"
          onClick={() => (onCompose ? onCompose() : go("/app/compose"))}
        >
          <PenSquare className="h-4 w-4" />
          Compose
        </Button>

        <div className="sidebar-scroll">
        <nav className="folder-nav" aria-label="Overview">
          <span className="sidebar-section">Workspace</span>
          {OVERVIEW.map((item) => {
            const Icon = item.icon;
            const active = navCurrent === item.id;
            const inboxUnread = item.id === "inbox" ? folderBadge("inbox", counts) : 0;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                className={cn("side-btn", active && "active")}
                onClick={() => navClick(item.href)}
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{item.label}</span>
                </span>
                {inboxUnread ? (
                  <Badge variant="secondary" className="side-count border-0 px-1.5 py-0 text-[11px]">
                    {inboxUnread}
                  </Badge>
                ) : null}
              </button>
            );
          })}
        </nav>

        {showMailFolders ? (
          <details className="mail-folder-group" open>
          <summary>Mail folders</summary>
          <nav className="folder-nav" aria-label="Mail folders">
            {FOLDERS.map((item) => {
              const show = folderBadge(item.id, counts);
              const active = folder === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                className={cn("side-btn", active && "active")}
                  onClick={() => {
                    if (onFolder) onFolder(item.id);
                    else go("/app");
                  }}
                >
                  <span>{item.label}</span>
                  {show ? (
                    <Badge variant="secondary" className="side-count border-0 px-1.5 py-0 text-[11px]">
                      {show}
                    </Badge>
                  ) : null}
                </button>
              );
            })}
          </nav>
          </details>
        ) : null}

        {showDomainRail ? (
          <nav className="domain-rail" aria-label="Domains">
            <span className="sidebar-section">Domains</span>
            <button
              type="button"
              className={cn("side-btn domain-rail-btn", !domainFilter && "active")}
              onClick={() => onDomainFilter("")}
            >
              <span>All domains</span>
            </button>
            {domains.map((d) => {
              const unread = domainUnread?.[d.id] ?? 0;
              return (
                <button
                  key={d.id}
                  type="button"
                  className={cn("side-btn domain-rail-btn", domainFilter === d.id && "active")}
                  onClick={() => onDomainFilter(d.id)}
                  style={d.color ? ({ ["--domain-color"]: d.color } as CSSProperties) : undefined}
                >
                  <span className="domain-rail-label">
                    <span
                      className="domain-swatch domain-rail-swatch"
                      aria-hidden
                      style={d.color ? { background: d.color } : undefined}
                    />
                    {d.name}
                  </span>
                  {unread > 0 ? (
                    <Badge variant="secondary" className="side-count border-0 px-1.5 py-0 text-[11px]">
                      {unread}
                    </Badge>
                  ) : null}
                </button>
              );
            })}
          </nav>
        ) : null}

        <nav className="folder-nav" aria-label="System">
          <span className="sidebar-section">System</span>
          {SYSTEM.map((item) => {
            const Icon = item.icon;
            const active = navCurrent === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                className={cn("side-btn", active && "active")}
                onClick={() => navClick(item.href)}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 opacity-70" />
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        </div>
        <div className="side-foot">
          <Separator className="mb-2 hidden bg-white/10 md:block" />
          <div className="side-theme hidden px-2 py-1 md:block">
            <ThemeToggle />
          </div>
          <button type="button" className="side-btn" onClick={() => void onLogout()}>
            <span className="inline-flex items-center gap-2">
              <LogOut className="h-3.5 w-3.5 opacity-70" />
              Sign out
            </span>
          </button>
          <div className="muted side-email" title={email}>
            {email}
          </div>
        </div>
      </aside>
      {children}
    </div>
  );
}
