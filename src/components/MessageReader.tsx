import { type CSSProperties, type ReactNode, useState } from "react";
import {
  Archive,
  Ban,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Flag,
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
import { api } from "../lib/api";
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
import { Textarea } from "./ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

type TeamMember = { user_id: string; email: string };

/** Soften HTML email canvas to match Flap elevated surface. */
function emailSrcDoc(html: string): string {
  const softHead =
    '<meta name="color-scheme" content="light dark" />' +
    `<style>
      html,body{
        margin:0!important;
        background:var(--surface-raised, #ffffff)!important;
        color:var(--foreground, #141211)!important;
        font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif!important;
        font-size:15px!important;
        line-height:1.55!important;
      }
      img{max-width:100%;height:auto;}
      a{color:var(--accent-text, #b84a0a);}
    </style>`;
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${softHead}`);
  }
  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${softHead}</head>`);
  }
  return `<!DOCTYPE html><html><head>${softHead}</head><body>${html}</body></html>`;
}

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
  onWorkflow?: (status: "" | "done" | "follow_up") => void;
  onAddNote: () => void;
  onOpenBilling: () => void;
};

function ToolBtn({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(
            "message-tool-btn h-9 w-9 rounded-xl text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
            active && "text-[var(--warning-text)] hover:text-[var(--warning-text)]",
          )}
          onClick={onClick}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
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
  onWorkflow,
  onAddNote,
  onOpenBilling,
}: MessageReaderProps) {
  const [newLabel, setNewLabel] = useState("");
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [rsvpNotice, setRsvpNotice] = useState("");
  const [rsvpError, setRsvpError] = useState("");
  const viaLabel = domainName || undefined;
  const fromDisplay = senderName(message.from_addr);
  const fromEmail = extractEmail(message.from_addr) || message.from_addr;
  const accent = domainColor || "var(--accent)";
  const assigneeLabel = message.assignee_user_id
    ? teamMembers.find((m) => m.user_id === message.assignee_user_id)?.email || "Assigned"
    : "Assigned to";
  const calendarInvite = attachments.find(
    (a) => /calendar/i.test(a.content_type || "") || /\.ics$/i.test(a.filename || ""),
  );

  async function sendRsvp(response: "accept" | "decline" | "maybe") {
    setRsvpBusy(true);
    setRsvpError("");
    setRsvpNotice("");
    try {
      const res = await api.calendarRsvp(message.id, response);
      const label = response === "accept" ? "Accepted" : response === "decline" ? "Declined" : "Marked tentative";
      setRsvpNotice(
        res.event_id ? `${label}. Event saved to your Flap calendar.` : `${label}. Reply sent to the organizer.`,
      );
    } catch (ex) {
      setRsvpError(ex instanceof Error ? ex.message : "Could not send RSVP.");
    } finally {
      setRsvpBusy(false);
    }
  }

  return (
    <TooltipProvider delayDuration={250}>
      <article
        className="message-reader"
        style={
          {
            ["--domain-color"]: accent,
          } as CSSProperties
        }
      >
        <div className="message-accent" aria-hidden />

        <div className="message-toolbar">
          <div className="message-toolbar-primary">
            <Button type="button" size="sm" className="h-9 gap-1.5 px-3.5" onClick={() => onReply(false)}>
              <Reply className="h-4 w-4" />
              Reply
            </Button>
            <ToolBtn label="Reply all" onClick={() => onReply(true)}>
              <ReplyAll className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn label="Forward" onClick={onForward}>
              <Forward className="h-4 w-4" />
            </ToolBtn>
            <span className="message-toolbar-sep" aria-hidden />
            <ToolBtn label="Archive" onClick={onArchive}>
              <Archive className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn label={message.starred ? "Unstar" : "Star"} onClick={onToggleStar} active={Boolean(message.starred)}>
              <Star className={cn("h-4 w-4", message.starred && "fill-current")} />
            </ToolBtn>
            <ToolBtn label="Mark unread" onClick={onMarkUnread}>
              <Mail className="h-4 w-4" />
            </ToolBtn>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
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

        <header className="message-head">
          <div className="message-subject-row">
            <h2>{message.subject || "(no subject)"}</h2>
            <time dateTime={new Date(message.date_ms).toISOString()}>{fmtDate(message.date_ms)}</time>
          </div>

          <div className="message-sender">
            <Avatar
              className="message-avatar"
              style={{ background: `color-mix(in srgb, ${accent} 18%, var(--surface-hover))` }}
            >
              <AvatarFallback
                className="text-[13px] font-semibold"
                style={{ color: domainColor || "var(--foreground)", background: "transparent" }}
              >
                {initials(message.from_addr)}
              </AvatarFallback>
            </Avatar>

            <div className="message-sender-meta">
              <div className="message-sender-line">
                <strong>{fromDisplay}</strong>
                {message.starred ? (
                  <Badge variant="warn" className="gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    Starred
                  </Badge>
                ) : null}
                {message.label ? <Badge variant="default">{message.label}</Badge> : null}
              </div>

              <p className="message-addrs">
                <span className="message-from-email">{fromEmail}</span>
                <span className="message-addr-arrow" aria-hidden>
                  →
                </span>
                <span>{message.to_addr || "(unknown)"}</span>
              </p>

              {message.cc_addr ? <p className="message-cc">Cc {message.cc_addr}</p> : null}

              {viaLabel ? (
                <div className="message-via">
                  <span className="message-via-dot" style={{ background: accent }} aria-hidden />
                  via {viaLabel}
                </div>
              ) : null}
            </div>
          </div>

          <div className="message-collab-bar" role="toolbar" aria-label="Collaboration">
            {teamsUnlocked ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="message-collab-btn">
                    {assigneeLabel}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => onAssign(null)}>Unassigned</DropdownMenuItem>
                  {teamMembers.map((m) => (
                    <DropdownMenuItem key={m.user_id} onSelect={() => onAssign(m.user_id)}>
                      {m.email}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="message-collab-btn"
                onClick={onOpenBilling}
              >
                Assigned to
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="message-collab-btn"
              onClick={() => {
                /* Done state lands in Phase 6 — archive as a useful stub. */
                onArchive();
              }}
            >
              <Check className="h-3.5 w-3.5" />
              Done
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="message-collab-btn"
              onClick={() => onApplyLabel("Follow-up")}
            >
              <Flag className="h-3.5 w-3.5" />
              Follow up
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="message-collab-btn"
              onClick={() => {
                document.getElementById("message-note-draft")?.focus();
              }}
            >
              <StickyNote className="h-3.5 w-3.5" />
              Add note
            </Button>
          </div>
        </header>

        {thread.length > 1 ? (
          <div className="message-thread">
            <div className="message-thread-label">
              <Users className="h-3.5 w-3.5" />
              Thread · {thread.length}
            </div>
            <div className="message-thread-list">
              {thread.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectThread(item.id)}
                  className={cn("message-thread-item", item.id === message.id && "active")}
                >
                  <span className="min-w-0 truncate">
                    <strong>{item.subject || "(no subject)"}</strong>
                    <span>{senderName(item.from_addr)}</span>
                  </span>
                  <time>{fmtDate(item.date_ms)}</time>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="message-body">
          {message.html_body ? (
            <iframe
              title="Message body"
              sandbox=""
              srcDoc={emailSrcDoc(message.html_body)}
              className="message-frame"
            />
          ) : (
            <div className="body-text">{message.text_body || ""}</div>
          )}
        </div>

        {attachments.length > 0 ? (
          <div className="message-attachments">
            <div className="message-attachments-label">
              <Paperclip className="h-3.5 w-3.5" />
              {attachments.length} attachment{attachments.length === 1 ? "" : "s"}
            </div>
            <div className="message-attachment-list">
              {attachments.map((a) => (
                <a
                  key={a.id}
                  href={`/api/mail/${message.id}/attachments/${a.id}`}
                  className="message-attachment"
                >
                  <Paperclip className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="truncate">{a.filename}</span>
                  <span className="message-attachment-size">{Math.ceil(a.size / 1024)} KB</span>
                </a>
              ))}
            </div>
          </div>
        ) : message.has_attachments ? (
          <p className="message-attachments-missing">
            This message had attachments, but R2 is not bound so files were not stored.
          </p>
        ) : null}

        {calendarInvite ? (
          <div className="message-invite-rsvp" role="group" aria-label="Calendar invitation">
            <p className="message-invite-lede">
              Calendar invite · {calendarInvite.filename}
            </p>
            <div className="message-quick-reply">
              <Button type="button" className="message-quick-reply-btn" disabled={rsvpBusy} onClick={() => void sendRsvp("accept")}>
                Accept
              </Button>
              <Button type="button" variant="outline" className="message-quick-reply-btn" disabled={rsvpBusy} onClick={() => void sendRsvp("maybe")}>
                Maybe
              </Button>
              <Button type="button" variant="outline" className="message-quick-reply-btn" disabled={rsvpBusy} onClick={() => void sendRsvp("decline")}>
                Decline
              </Button>
            </div>
            {rsvpNotice ? (
              <p className="notice" role="status">
                {rsvpNotice}
              </p>
            ) : null}
            {rsvpError ? (
              <p className="error" role="alert">
                {rsvpError}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="message-collab-bar" role="group" aria-label="Collaboration">
          {teamsUnlocked ? (
            <label className="message-collab-assign">
              <span className="sr-only">Assigned to</span>
              <select
                aria-label="Assigned to"
                value={message.assignee_user_id || ""}
                onChange={(e) => onAssign(e.target.value || null)}
              >
                <option value="">Assigned to…</option>
                {teamMembers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.email}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={onOpenBilling}>
              Assigned to…
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={message.workflow_status === "done" ? "primary" : "secondary"}
            aria-pressed={message.workflow_status === "done"}
            onClick={() => onWorkflow?.(message.workflow_status === "done" ? "" : "done")}
          >
            Done
          </Button>
          <Button
            type="button"
            size="sm"
            variant={message.workflow_status === "follow_up" ? "primary" : "secondary"}
            aria-pressed={message.workflow_status === "follow_up"}
            onClick={() => onWorkflow?.(message.workflow_status === "follow_up" ? "" : "follow_up")}
          >
            Follow up
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              const el = document.getElementById("message-note-draft");
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
              el?.focus();
            }}
          >
            Add note
          </Button>
        </div>

        <div className="message-quick-reply">
          <Button type="button" variant="outline" className="message-quick-reply-btn" onClick={() => onReply(false)}>
            <Reply className="h-4 w-4" />
            Reply
          </Button>
          <Button type="button" variant="outline" className="message-quick-reply-btn" onClick={() => onReply(true)}>
            <ReplyAll className="h-4 w-4" />
            Reply all
          </Button>
          <Button type="button" variant="outline" className="message-quick-reply-btn" onClick={onForward}>
            <Forward className="h-4 w-4" />
            Forward
          </Button>
        </div>

        <div className="message-meta-panels">
          <Accordion
            type="multiple"
            className="w-full"
            defaultValue={[
              ...(message.label ? ["organize"] : []),
              ...(notes.length ? ["notes"] : []),
            ]}
          >
            <AccordionItem value="organize" className="border-[var(--line)]">
              <AccordionTrigger className="message-panel-trigger">
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

            <AccordionItem value="notes" className="border-b-0 border-[var(--line)]">
              <AccordionTrigger className="message-panel-trigger">
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
                      <li key={n.id} className="message-note">
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
                    id="message-note-draft"
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
