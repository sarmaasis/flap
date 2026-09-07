import type { Domain, FolderCounts } from "../lib/api";
import { FOLDERS, folderBadge } from "../lib/mailFolders";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";
import type { CSSProperties } from "react";

/** Mail-context folder + domain rail for the three-pane inbox. */
export default function MailFolderRail({
  folder,
  counts,
  domains,
  domainUnread,
  domainFilter,
  onFolder,
  onDomainFilter,
}: {
  folder: string;
  counts?: FolderCounts;
  domains?: Domain[];
  domainUnread?: Record<string, number>;
  domainFilter?: string;
  onFolder: (id: string) => void;
  onDomainFilter?: (domainId: string) => void;
}) {
  const showDomains = Boolean(domains && domains.length > 0 && onDomainFilter);

  return (
    <aside className="mail-folder-pane" aria-label="Mail folders">
      <nav className="mail-folder-nav" aria-label="Folders">
        <span className="mail-folder-section">Folders</span>
        {FOLDERS.map((item) => {
          const show = folderBadge(item.id, counts);
          const active = folder === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              className={cn("mail-folder-btn", active && "active")}
              onClick={() => onFolder(item.id)}
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
    </aside>
  );
}
