import {
  Archive,
  Clock,
  FileEdit,
  Inbox,
  Mail,
  PenSquare,
  Send,
  ShieldAlert,
  Star,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { Domain, FolderCounts } from "../lib/api";
import { FOLDERS, folderBadge } from "../lib/mailFolders";
import { cn } from "../lib/utils";
import type { CSSProperties } from "react";
import { Button } from "./ui/button";

const FOLDER_ICONS: Record<string, LucideIcon> = {
  inbox: Inbox,
  starred: Star,
  snoozed: Clock,
  drafts: FileEdit,
  scheduled: Clock,
  sent: Send,
  archive: Archive,
  spam: ShieldAlert,
  trash: Trash2,
};

/** Mail-context folder + domain rail for the three-pane inbox. */
export default function MailFolderRail({
  folder,
  counts,
  domains,
  domainUnread,
  domainFilter,
  onFolder,
  onDomainFilter,
  onCompose,
}: {
  folder: string;
  counts?: FolderCounts;
  domains?: Domain[];
  domainUnread?: Record<string, number>;
  domainFilter?: string;
  onFolder: (id: string) => void;
  onDomainFilter?: (domainId: string) => void;
  onCompose?: () => void;
}) {
  const showDomains = Boolean(domains && domains.length > 0 && onDomainFilter);

  return (
    <aside className="mail-folder-pane" aria-label="Mail folders">
      {onCompose ? (
        <Button type="button" className="mail-new-email" onClick={onCompose}>
          <PenSquare className="h-4 w-4" />
          New Email
        </Button>
      ) : null}

      <nav className="mail-folder-nav" aria-label="Folders">
        <span className="mail-folder-section">Needs you</span>
        <button
          type="button"
          aria-current={folder === "needs-you" ? "page" : undefined}
          className={cn("mail-folder-btn", folder === "needs-you" && "active")}
          onClick={() => onFolder("needs-you")}
        >
          <span className="mail-folder-btn-main">
            <Inbox className="mail-folder-icon" aria-hidden />
            <span>Needs you</span>
          </span>
        </button>
        <span className="mail-folder-section">Folders</span>
        {FOLDERS.map((item) => {
          const show = folderBadge(item.id, counts);
          const active = folder === item.id;
          const Icon = FOLDER_ICONS[item.id] ?? Mail;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              className={cn("mail-folder-btn", active && "active")}
              onClick={() => onFolder(item.id)}
            >
              <span className="mail-folder-btn-main">
                <Icon className="mail-folder-icon" aria-hidden />
                <span>{item.label}</span>
              </span>
              {show ? <span className="side-count">{show}</span> : null}
            </button>
          );
        })}
      </nav>

      {showDomains ? (
        <nav className="mail-folder-nav mail-domain-nav" aria-label="Domains">
          <span className="mail-folder-section">Domains</span>
          <button
            type="button"
            className={cn("mail-folder-btn", !domainFilter && "active")}
            onClick={() => onDomainFilter!("")}
          >
            <span>All domains</span>
          </button>
          {domains!.map((d) => {
            const unread = domainUnread?.[d.id] ?? 0;
            return (
              <button
                key={d.id}
                type="button"
                className={cn("mail-folder-btn", domainFilter === d.id && "active")}
                onClick={() => onDomainFilter!(d.id)}
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
                {unread > 0 ? <span className="side-count">{unread}</span> : null}
              </button>
            );
          })}
        </nav>
      ) : null}
    </aside>
  );
}
