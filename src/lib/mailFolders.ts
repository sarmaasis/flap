import type { FolderCounts } from "./api";

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

export function folderBadge(id: string, counts?: FolderCounts) {
  const badge = counts?.[id];
  const unread = badge?.unread ?? 0;
  const total = badge?.total ?? 0;
  if (id === "inbox" || id === "drafts" || id === "scheduled") return unread || total;
  return unread;
}
