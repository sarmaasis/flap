import { useEffect, type ReactNode } from "react";
import type { FolderCounts } from "../lib/api";
import { go } from "../lib/nav";
import BrandMark from "./BrandMark";

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

export default function AppShell({
  email,
  counts,
  folder,
  current,
  onFolder,
  onCompose,
  onLogout,
  children,
}: {
  email: string;
  counts?: FolderCounts;
  folder?: string;
  current: "mail" | "settings";
  onFolder?: (id: string) => void;
  onCompose?: () => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    document.documentElement.classList.add("app-locked");
    return () => document.documentElement.classList.remove("app-locked");
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/app" onClick={(e) => { e.preventDefault(); go("/app"); }}>
          <BrandMark />
          <span>Flap</span>
        </a>
        {onCompose ? (
          <button className="btn compose-button" type="button" onClick={onCompose}>
            Compose
          </button>
        ) : (
          <button className="btn compose-button" type="button" onClick={() => go("/app/compose")}>
            Compose
          </button>
        )}
        <nav className="folder-nav" aria-label="Mail folders">
          <span className="sidebar-section">Mailbox</span>
          {FOLDERS.map((item) => {
            const badge = counts?.[item.id];
            const unread = badge?.unread ?? 0;
            const total = badge?.total ?? 0;
            const show = item.id === "inbox" || item.id === "drafts" || item.id === "scheduled" ? unread || total : unread;
            return (
              <button
                key={item.id}
                type="button"
                className={`side-btn${current === "mail" && folder === item.id ? " active" : ""}`}
                onClick={() => {
                  if (onFolder) onFolder(item.id);
                  else go("/app");
                }}
              >
                <span>{item.label}</span>
                {show ? <span className="side-count">{item.id === "inbox" || item.id === "drafts" || item.id === "scheduled" ? (unread || total) : unread}</span> : null}
              </button>
            );
          })}
        </nav>
        <div className="side-foot">
          <button type="button" className={`side-btn${current === "settings" ? " active" : ""}`} onClick={() => go("/app/settings")}>
            Settings
          </button>
          <button type="button" className="side-btn" onClick={() => void onLogout()}>
            Sign out
          </button>
          <div className="muted side-email" title={email}>{email}</div>
        </div>
      </aside>
      {children}
    </div>
  );
}
