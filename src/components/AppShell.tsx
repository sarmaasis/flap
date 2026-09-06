import { useEffect, type CSSProperties, type ReactNode } from "react";
import { LogOut, PenSquare, Settings as SettingsIcon } from "lucide-react";
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
  current: "mail" | "settings";
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

  const showDomainRail = current === "mail" && domains && domains.length > 0 && onDomainFilter;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/app" onClick={(e) => { e.preventDefault(); go("/app"); }}>
          <BrandMark />
          <span>Flap</span>
        </a>
        <Button
          className="compose-button w-full"
          type="button"
          onClick={() => (onCompose ? onCompose() : go("/app/compose"))}
        >
          <PenSquare className="h-4 w-4" />
          Compose
        </Button>
        <nav className="folder-nav" aria-label="Mail folders">
          <span className="sidebar-section">Mailbox</span>
          {FOLDERS.map((item) => {
            const show = folderBadge(item.id, counts);
            const active = current === "mail" && folder === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={cn("side-btn", active && "active")}
                onClick={() => {
                  if (onFolder) onFolder(item.id);
                  else go("/app");
                }}
              >
                <span>{item.label}</span>
                {show ? <Badge variant="secondary" className="side-count border-0 px-1.5 py-0 text-[11px]">{show}</Badge> : null}
              </button>
            );
          })}
        </nav>
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
                    <span className="domain-swatch domain-rail-swatch" aria-hidden style={d.color ? { background: d.color } : undefined} />
                    {d.name}
                  </span>
                  {unread > 0 ? <Badge variant="secondary" className="side-count border-0 px-1.5 py-0 text-[11px]">{unread}</Badge> : null}
                </button>
              );
            })}
          </nav>
        ) : null}
        <div className="side-foot">
          <Separator className="mb-2 hidden bg-white/10 md:block" />
          <div className="side-theme hidden px-2 py-1 md:block">
            <ThemeToggle />
          </div>
          <button
            type="button"
            className={cn("side-btn", current === "settings" && "active")}
            onClick={() => go("/app/settings")}
          >
            <span className="inline-flex items-center gap-2">
              <SettingsIcon className="h-3.5 w-3.5 opacity-70" />
              Settings
            </span>
          </button>
          <button type="button" className="side-btn" onClick={() => void onLogout()}>
            <span className="inline-flex items-center gap-2">
              <LogOut className="h-3.5 w-3.5 opacity-70" />
              Sign out
            </span>
          </button>
          <div className="muted side-email" title={email}>{email}</div>
        </div>
      </aside>
      {children}
    </div>
  );
}
