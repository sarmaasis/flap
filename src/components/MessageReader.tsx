import { type CSSProperties, type ReactNode, useState } from "react";
import {
  Archive,
  Ban,
  Clock,
  Copy,
  Forward,
  Inbox,
  Mail,
  MoreHorizontal,
  Paperclip,
  Printer,
  Reply,
  ReplyAll,
  Sparkles,
  Star,
  StickyNote,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import type { Attachment, Label, MailFull, MailSummary, MessageNote } from "../lib/api";
import { extractEmail, fmtDate, initials, senderName } from "../lib/format";
import { cn } from "../lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Textarea } from "./ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

type TeamMember = { user_id: string; email: string };

export type MessageReaderProps = {
  message: MailFull;
  folder: string;
  attachments: Attachment[];
  thread: MailSummary[];
  labels: Label[];
  notes: MessageNote[];
  noteDraft: string;
  onNoteDraftChange: (value: string) => void;
  domainName?: string;
  domainColor?: string;
  teamsUnlocked: boolean;
  teamMembers: TeamMember[];
  onSelectThread: (id: string) => void;
  onReply: (all: boolean) => void;
  onForward: () => void;
  onArchive: () => void;
  onToggleStar: () => void;
  onMarkUnread: () => void;
  onSnooze: (untilMs: number) => void;
  onSpam: () => void;
  onDelete: () => void;
  onMoveInbox: () => void;
  onBlockSender: () => void;
  onCopySender: () => void;
  onPrint: () => void;
  onApplyLabel: (name: string) => void;
  onClearLabel: () => void;
  onAssign: (userId: string | null) => void;
  onAddNote: () => void;
  onOpenBilling: () => void;
};

function IconAction({
  label,
  onClick,
  children,
  primary,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size={primary ? "default" : "icon"}
          variant={primary ? "default" : "outline"}
          className={cn(!primary && "h-9 w-9", primary && "h-9 px-3.5")}
          onClick={onClick}
          aria-label={label}
        >
          {children}
          {primary ? <span>{label}</span> : null}
        </Button>
      </TooltipTrigger>
      {!primary ? <TooltipContent>{label}</TooltipContent> : null}
    </Tooltip>
  );
}

export default function MessageReader({
  message,
  folder,
  attachments,
  thread,
  labels,
  notes,
  noteDraft,
  onNoteDraftChange,
  domainName,
  domainColor,
  teamsUnlocked,
  teamMembers,
  onSelectThread,
  onReply,
  onForward,
  onArchive,
  onToggleStar,
  onMarkUnread,
  onSnooze,
  onSpam,
  onDelete,
  onMoveInbox,
  onBlockSender,
  onCopySender,
  onPrint,
  onApplyLabel,
  onClearLabel,
  onAssign,
  onAddNote,
  onOpenBilling,
}: MessageReaderProps) {
  const [newLabel, setNewLabel] = useState("");
  const viaLabel = domainName || undefined;
  const fromDisplay = senderName(message.from_addr);
  const fromEmail = extractEmail(message.from_addr) || message.from_addr;

  return (
    <TooltipProvider delayDuration={250}>
      <article
        className="message-reader mx-auto w-full max-w-[820px] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]"
        style={
          {
            borderLeftWidth: 3,
            borderLeftColor: domainColor || "var(--line-strong)",
            ["--domain-color"]: domainColor || "var(--line-strong)",
          } as CSSProperties
        }
      >
        <header className="space-y-4 px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.25rem,2.4vw,1.7rem)] font-semibold leading-snug tracking-[-0.02em] text-[var(--fg)]">
              {message.subject || "(no subject)"}
            </h2>
            <time className="shrink-0 pt-1 font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
              {fmtDate(message.date_ms)}
            </time>
          </div>

          <div className="flex items-start gap-3">
            <Avatar
              className="h-11 w-11 ring-2 ring-[var(--surface)]"
              style={domainColor ? { background: `color-mix(in srgb, ${domainColor} 22%, transparent)` } : undefined}
            >
              <AvatarFallback
                className="text-[13px]"
                style={domainColor ? { color: domainColor, background: "transparent" } : undefined}
              >
                {initials(message.from_addr)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <strong className="text-[15px] font-semibold text-[var(--fg)]">{fromDisplay}</strong>
                {message.starred ? (
                  <Badge variant="warn" className="gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    Starred
                  </Badge>
                ) : null}
                {message.label ? <Badge variant="default">{message.label}</Badge> : null}
              </div>

              <p className="truncate font-[family-name:var(--font-mono)] text-[12.5px] text-[var(--muted)]">
                <span className="text-[var(--fg)]/80">{fromEmail}</span>
                <span className="mx-1.5 opacity-40">→</span>
                <span>{message.to_addr || "(unknown)"}</span>
              </p>

              {message.cc_addr ? (
                <p className="font-[family-name:var(--font-mono)] text-[12px] text-[var(--muted)]">
                  Cc {message.cc_addr}
                </p>
              ) : null}

              {viaLabel ? (
                <div className="inline-flex items-center gap-1.5 pt-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: domainColor || "var(--muted)" }}
                    aria-hidden
                  />
                  via {viaLabel}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <IconAction label="Reply" primary onClick={() => onReply(false)}>
              <Reply className="h-4 w-4" />
            </IconAction>
            <IconAction label="Archive" onClick={onArchive}>
              <Archive className="h-4 w-4" />
            </IconAction>
            <IconAction label={message.starred ? "Unstar" : "Star"} onClick={onToggleStar}>
              <Star className={cn("h-4 w-4", message.starred && "fill-current text-[var(--warn)]")} />
            </IconAction>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => onReply(true)}>
                  <ReplyAll /> Reply all
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onForward}>
                  <Forward /> Forward
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onMarkUnread}>
                  <Mail /> Mark unread
                </DropdownMenuItem>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Clock /> Snooze
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onSelect={() => onSnooze(Date.now() + 3 * 60 * 60 * 1000)}>
                      In 3 hours
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onSnooze(Date.now() + 24 * 60 * 60 * 1000)}>
                      Tomorrow
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onSnooze(Date.now() + 7 * 24 * 60 * 60 * 1000)}>
                      Next week
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                {folder !== "spam" ? (
                  <DropdownMenuItem onSelect={onSpam}>
                    <Ban /> Spam
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onSelect={onDelete}
                  className="text-[var(--danger)] focus:text-[var(--danger)]"
                >
                  <Trash2 /> {folder === "trash" ? "Delete forever" : "Delete"}
                </DropdownMenuItem>
                {folder !== "inbox" && folder !== "starred" && folder !== "snoozed" ? (
                  <DropdownMenuItem onSelect={onMoveInbox}>
                    <Inbox /> Move to Inbox
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={onBlockSender}>
                  <Ban /> Block sender
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onSelect={onCopySender}>
                  <Copy /> Copy sender
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onPrint}>
                  <Printer /> Print
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {thread.length > 1 ? (
          <div className="border-y border-[var(--line)] bg-[var(--surface-2)]/50 px-5 py-3 sm:px-7">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              <Users className="h-3.5 w-3.5" />
              Thread · {thread.length}
            </div>
            <div className="flex flex-col gap-1">
              {thread.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectThread(item.id)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                    item.id === message.id
                      ? "bg-[var(--cta-dim)] text-[var(--fg)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]",
                  )}
                >
                  <span className="min-w-0 truncate">
                    <strong className="mr-2 font-medium text-[var(--fg)]">{item.subject || "(no subject)"}</strong>
                    <span className="text-xs">{senderName(item.from_addr)}</span>
                  </span>
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px]">
                    {fmtDate(item.date_ms)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="px-1 sm:px-2">
          {message.html_body ? (
            <iframe
              title="Message body"
              sandbox=""
              srcDoc={message.html_body}
              className="message-frame min-h-[360px] w-full rounded-none border-0 bg-white"
            />
          ) : (
            <div className="body-text whitespace-pre-wrap px-5 py-4 text-[15px] leading-[1.55] text-[var(--fg)] sm:px-6">
              {message.text_body || ""}
            </div>
          )}
        </div>

        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-t border-[var(--line)] px-5 py-4 sm:px-7">
            {attachments.map((a) => (
              <a
                key={a.id}
                href={`/api/mail/${message.id}/attachments/${a.id}`}
                className="inline-flex items-center gap-2 rounded-md border border-[var(--line-strong)] bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-[var(--fg)] transition-colors hover:border-[var(--cta)] hover:text-[var(--cta)]"
              >
                <Paperclip className="h-3.5 w-3.5 text-[var(--muted)]" />
                <span className="max-w-[200px] truncate">{a.filename}</span>
                <span className="text-[var(--muted)]">{Math.ceil(a.size / 1024)} KB</span>
              </a>
            ))}
          </div>
        ) : message.has_attachments ? (
          <p className="border-t border-[var(--line)] px-5 py-3 text-xs text-[var(--muted)] sm:px-7">
            This message had attachments, but R2 is not bound so files were not stored.
          </p>
        ) : null}

        <Separator />

        <div className="px-5 sm:px-7">
          <Accordion type="multiple" className="w-full" defaultValue={[
            ...(message.label ? ["organize"] : []),
            ...(notes.length ? ["notes"] : []),
          ]}>
            <AccordionItem value="organize" className="border-b-0">
              <AccordionTrigger className="py-3.5 text-[12px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)] hover:no-underline hover:text-[var(--fg)]">
                <span className="inline-flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5" />
                  Organize
                  {message.label ? (
                    <Badge variant="secondary" className="normal-case tracking-normal">
                      {message.label}
                    </Badge>
                  ) : null}
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-[var(--fg)]">
                {message.label ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default" className="gap-1.5 px-2.5 py-1">
                      <Sparkles className="h-3 w-3" />
                      {message.label}
                    </Badge>
                    <Button type="button" variant="ghost" size="sm" onClick={onClearLabel}>
                      Clear
                    </Button>
                  </div>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <select
                    aria-label="Add existing label"
                    className="h-10 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cta)]/40"
                    value=""
                    onChange={(e) => {
                      const name = e.target.value;
                      e.target.value = "";
                      if (name) onApplyLabel(name);
                    }}
                  >
                    <option value="">Add existing…</option>
                    {labels.map((l) => (
                      <option key={l.id} value={l.name}>
                        {l.name}
                      </option>
                    ))}
                    {!labels.some((l) => l.name === "Follow-up") ? <option value="Follow-up">Follow-up</option> : null}
                    {!labels.some((l) => l.name === "Customer") ? <option value="Customer">Customer</option> : null}
                  </select>
                  <Input
                    placeholder="New label"
                    maxLength={48}
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const name = newLabel.trim();
                        if (!name) return;
                        onApplyLabel(name);
                        setNewLabel("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const name = newLabel.trim();
                      if (!name) return;
                      onApplyLabel(name);
                      setNewLabel("");
                    }}
                  >
                    Apply
                  </Button>
                </div>

                {teamsUnlocked ? (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]" htmlFor="message-assignee">
                      Assignee
                    </label>
                    <select
                      id="message-assignee"
                      aria-label="Assign"
                      className="h-10 w-full max-w-sm rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm"
                      value={message.assignee_user_id || ""}
                      onChange={(e) => onAssign(e.target.value || null)}
                    >
                      <option value="">Unassigned</option>
                      {teamMembers.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.email}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">
                    Need teammates on a thread?{" "}
                    <button type="button" className="font-medium text-[var(--cta)] underline-offset-2 hover:underline" onClick={onOpenBilling}>
                      Assignment is on Studio
                    </button>
                  </p>
                )}

                {message.plus_tag ? (
                  <p className="font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
                    Plus-tag: +{message.plus_tag}
                  </p>
                ) : null}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="notes" className="border-b-0">
              <AccordionTrigger className="py-3.5 text-[12px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)] hover:no-underline hover:text-[var(--fg)]">
                <span className="inline-flex items-center gap-2">
                  <StickyNote className="h-3.5 w-3.5" />
                  Notes
                  {notes.length > 0 ? (
                    <Badge variant="secondary" className="normal-case tracking-normal">
                      {notes.length}
                    </Badge>
                  ) : null}
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-[var(--fg)]">
                <p className="text-xs text-[var(--muted)]">Private to your workspace — never emailed.</p>

                {notes.length > 0 ? (
                  <ul className="space-y-2">
                    {notes.map((n) => (
                      <li
                        key={n.id}
                        className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/60 px-3 py-2.5"
                      >
                        <div className="text-sm leading-relaxed">{n.body}</div>
                        <div className="mt-1 text-[11px] text-[var(--muted)]">
                          {n.author_email || "you"} · {new Date(n.created_at).toLocaleString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[var(--muted)]">No notes yet.</p>
                )}

                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onAddNote();
                  }}
                >
                  <Textarea
                    placeholder="Add a private note"
                    value={noteDraft}
                    onChange={(e) => onNoteDraftChange(e.target.value)}
                    className="min-h-[64px] flex-1"
                    rows={2}
                  />
                  <Button type="submit" className="sm:self-end" disabled={!noteDraft.trim()}>
                    Add
                  </Button>
                </form>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </article>
    </TooltipProvider>
  );
}
