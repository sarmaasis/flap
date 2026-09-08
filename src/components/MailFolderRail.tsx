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

const folderBtn = (active: boolean) =>
  cn(
    "flex cursor-pointer items-center justify-between gap-2 rounded-[10px] border-0 bg-transparent px-2.5 py-1.5 text-left text-[13px] font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
    "max-lg:h-[34px] max-lg:w-auto max-lg:shrink-0 max-lg:whitespace-nowrap max-lg:border max-lg:border-[var(--line)] max-lg:bg-[var(--surface)] max-lg:px-2.5",
    "lg:h-8 lg:w-full lg:min-w-0",
    active && "bg-[var(--surface-active)] font-semibold text-[var(--foreground)] shadow-[inset_2px_0_var(--accent)]",
    active && "max-lg:border-[var(--accent)] max-lg:bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))] max-lg:shadow-none",
  );

const folderSection =
  "mx-2 mt-2 mb-1 hidden text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground-faint)] lg:block";

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
  className,
}: {
  folder: string;
  counts?: FolderCounts;
  domains?: Domain[];
  domainUnread?: Record<string, number>;
  domainFilter?: string;
  onFolder: (id: string) => void;
  onDomainFilter?: (domainId: string) => void;
  onCompose?: () => void;
  className?: string;
}) {
  const showDomains = Boolean(domains && domains.length > 0 && onDomainFilter);

  return (
    <aside
      className={cn(
        "flex min-h-0 min-w-0 flex-col gap-2 overflow-x-hidden overscroll-contain border-[var(--line)] bg-[var(--surface)] px-2.5 py-2",
        "max-lg:h-auto max-lg:shrink-0 max-lg:overflow-x-auto max-lg:overflow-y-hidden max-lg:border-b max-lg:border-r-0",
        "lg:h-full lg:gap-3 lg:overflow-y-auto lg:border-r lg:py-3 lg:pb-4",
        className,
      )}
      aria-label="Mail folders"
    >
      {onCompose ? (
        <Button type="button" className="min-h-9 w-full gap-2 rounded-xl max-lg:min-h-8" onClick={onCompose}>
          <PenSquare className="h-4 w-4" />
          New Email
        </Button>
      ) : null}

      <nav
        className="flex min-h-0 flex-col gap-0.5 max-lg:flex-row max-lg:flex-nowrap max-lg:items-center max-lg:gap-1 max-lg:overflow-x-auto max-lg:[-ms-overflow-style:none] max-lg:[scrollbar-width:none] [&::-webkit-scrollbar]:max-lg:hidden"
        aria-label="Folders"
      >
        <button
          type="button"
          aria-current={folder === "needs-you" ? "page" : undefined}
          className={folderBtn(folder === "needs-you")}
          onClick={() => onFolder("needs-you")}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <Inbox className={cn("h-4 w-4 shrink-0 opacity-85", folder === "needs-you" && "text-[var(--accent)] opacity-100")} aria-hidden />
            <span className="truncate">Needs you</span>
          </span>
        </button>
        <span className={folderSection}>Folders</span>
        {FOLDERS.map((item) => {
          const show = folderBadge(item.id, counts);
          const active = folder === item.id;
          const Icon = FOLDER_ICONS[item.id] ?? Mail;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              className={folderBtn(active)}
              onClick={() => onFolder(item.id)}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <Icon className={cn("h-4 w-4 shrink-0 opacity-85", active && "text-[var(--accent)] opacity-100")} aria-hidden />
                <span className="truncate">{item.label}</span>
              </span>
              {show ? <span className="shrink-0 text-xs tabular-nums text-[var(--foreground-faint)]">{show}</span> : null}
            </button>
          );
        })}
      </nav>

      {showDomains ? (
        <nav className="flex flex-col gap-0.5 border-[var(--line)] max-lg:hidden lg:border-t lg:pt-2" aria-label="Domains">
          <span className={folderSection}>Domains</span>
          <button
            type="button"
            className={folderBtn(!domainFilter)}
            onClick={() => onDomainFilter!("")}
          >
            <span>All domains</span>
          </button>
          {domains!.map((d) => {
            const unread = domainUnread?.[d.id] ?? 0;
            const active = domainFilter === d.id;
            return (
              <button
                key={d.id}
                type="button"
                className={folderBtn(active)}
                onClick={() => onDomainFilter!(d.id)}
                style={d.color ? ({ ["--domain-color"]: d.color } as CSSProperties) : undefined}
              >
                <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    aria-hidden
                    style={d.color ? { background: d.color } : undefined}
                  />
                  {d.name}
                </span>
                {unread > 0 ? <span className="shrink-0 text-xs tabular-nums text-[var(--foreground-faint)]">{unread}</span> : null}
              </button>
            );
          })}
        </nav>
      ) : null}
    </aside>
  );
}
