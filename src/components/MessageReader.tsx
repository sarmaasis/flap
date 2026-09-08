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
import { tw } from "../lib/tw";

type TeamMember = { user_id: string; email: string };

/** Soften HTML email canvas to match Flap elevated surface (light + dark). */
function emailSrcDoc(html: string): string {
  const softHead =
    '<meta name="color-scheme" content="light dark" />' +
    `<style>
      :root{
        color-scheme: light dark;
        --email-bg: #f6f3ee;
        --email-fg: #1c1917;
        --email-link: #b84a0a;
      }
      @media (prefers-color-scheme: dark){
        :root{
          --email-bg: #221f1c;
          --email-fg: #e8e2d9;
          --email-link: #f0a070;
        }
      }
      html.flap-dark, html.flap-dark body{
        --email-bg: #221f1c;
        --email-fg: #e8e2d9;
        --email-link: #f0a070;
      }
      html,body{
        margin:0!important;
        background:var(--email-bg)!important;
        color:var(--email-fg)!important;
        font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif!important;
        font-size:15px!important;
        line-height:1.55!important;
      }
      img{max-width:100%;height:auto;}
      a{color:var(--email-link);}
    </style>`;
  const darkClass =
    typeof document !== "undefined" &&
    (document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark")
      ? ' class="flap-dark"'
      : "";
  if (/<head[\s>]/i.test(html)) {
    const withHead = html.replace(/<head([^>]*)>/i, `<head$1>${softHead}`);
    return withHead.replace(/<html([^>]*)>/i, `<html$1${darkClass}>`);
  }
  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1${darkClass}><head>${softHead}</head>`);
  }
  return `<!DOCTYPE html><html${darkClass}><head>${softHead}</head><body>${html}</body></html>`;
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
            "h-9 w-9 rounded-xl text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
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
        className="relative flex min-h-full w-full flex-col bg-[var(--surface-overlay)] text-[var(--foreground)]"
        style={
          {
            ["--domain-color"]: accent,
          } as CSSProperties
        }
      >
        <div
          className="h-[3px] w-full shrink-0 bg-[linear-gradient(90deg,var(--domain-color,var(--accent))_0%,color-mix(in_srgb,var(--domain-color,var(--accent))_35%,transparent)_55%,transparent_100%)]"
          aria-hidden
        />

        <div className="sticky top-0 z-[5] flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5 backdrop-blur-[10px] max-[480px]:flex-wrap max-[480px]:gap-1.5 max-[480px]:px-2.5 max-[480px]:py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1 max-[480px]:gap-0.5">
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
            <span className="mx-1 h-5 w-px bg-[var(--line-strong)] max-[480px]:hidden" aria-hidden />
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

        <header className="border-b border-[var(--line)] bg-[var(--surface-overlay)] px-6 pb-[18px] pt-[22px]">
          <div className="mb-[18px] flex items-start justify-between gap-4">
            <h2 className="m-0 font-[family-name:var(--font-display)] text-[clamp(1.25rem,2.2vw,1.65rem)] font-[550] leading-[1.25] tracking-tight text-[var(--foreground)]">
              {message.subject || "(no subject)"}
            </h2>
            <time
              className="shrink-0 pt-1.5 font-mono text-[11.5px] text-[var(--foreground-muted)]"
              dateTime={new Date(message.date_ms).toISOString()}
            >
              {fmtDate(message.date_ms)}
            </time>
          </div>

          <div className="flex items-start gap-3">
            <Avatar
              className="h-[42px] w-[42px] shrink-0 border border-[var(--line)]"
              style={{ background: `color-mix(in srgb, ${accent} 18%, var(--surface-hover))` }}
            >
              <AvatarFallback
                className="text-[13px] font-semibold"
                style={{ color: domainColor || "var(--foreground)", background: "transparent" }}
              >
                {initials(message.from_addr)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <strong className="text-[15px] font-semibold text-[var(--foreground)]">{fromDisplay}</strong>
                {message.starred ? (
                  <Badge variant="warn" className="gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    Starred
                  </Badge>
                ) : null}
                {message.label ? <Badge variant="default">{message.label}</Badge> : null}
              </div>

              <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs leading-[1.45] text-[var(--foreground-muted)]">
                <span className="text-[color-mix(in_srgb,var(--foreground)_78%,var(--foreground-muted))]">{fromEmail}</span>
                <span className="mx-1.5 opacity-40" aria-hidden>
                  →
                </span>
                <span>{message.to_addr || "(unknown)"}</span>
              </p>

              {message.cc_addr ? (
                <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs leading-[1.45] text-[var(--foreground-muted)]">
                  Cc {message.cc_addr}
                </p>
              ) : null}

              {viaLabel ? (
                <div className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--foreground-muted)]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} aria-hidden />
                  via {viaLabel}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-1 border-t border-[var(--line)] pt-3" role="toolbar" aria-label="Collaboration">
            {teamsUnlocked ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 rounded-[10px] text-[13px] font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
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
                className="h-8 gap-1.5 rounded-[10px] text-[13px] font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
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
              className={cn(
                "h-8 gap-1.5 rounded-[10px] text-[13px] font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
                message.workflow_status === "done" &&
                  "bg-[color-mix(in_srgb,var(--accent)_16%,var(--surface-hover))] text-[var(--foreground)]",
              )}
              aria-pressed={message.workflow_status === "done"}
              onClick={() => onWorkflow?.(message.workflow_status === "done" ? "" : "done")}
            >
              <Check className="h-3.5 w-3.5" />
              Done
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 gap-1.5 rounded-[10px] text-[13px] font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
                message.workflow_status === "follow_up" &&
                  "bg-[color-mix(in_srgb,var(--accent)_16%,var(--surface-hover))] text-[var(--foreground)]",
              )}
              aria-pressed={message.workflow_status === "follow_up"}
              onClick={() => onWorkflow?.(message.workflow_status === "follow_up" ? "" : "follow_up")}
            >
              <Flag className="h-3.5 w-3.5" />
              Follow up
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-[10px] text-[13px] font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              onClick={() => {
                const el = document.getElementById("message-note-draft");
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
                el?.focus();
              }}
            >
              <StickyNote className="h-3.5 w-3.5" />
              Add note
            </Button>
          </div>
        </header>

        {thread.length > 1 ? (
          <div className="border-b border-[var(--line)] bg-[var(--surface-hover)] px-4 py-3">
            <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
              <Users className="h-3.5 w-3.5" />
              Thread · {thread.length}
            </div>
            <div className="flex flex-col gap-0.5">
              {thread.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectThread(item.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border-0 bg-transparent px-2.5 py-2 text-left text-[13px] text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
                    item.id === message.id &&
                      "bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))] text-[var(--foreground)] shadow-[inset_2px_0_var(--accent)]",
                  )}
                >
                  <span className="min-w-0 truncate">
                    <strong className="mr-2 inline font-semibold text-[var(--foreground)]">{item.subject || "(no subject)"}</strong>
                    <span>{senderName(item.from_addr)}</span>
                  </span>
                  <time className="shrink-0 font-mono text-[11px]">{fmtDate(item.date_ms)}</time>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="min-h-[280px] flex-1 border-b border-[var(--line)] bg-[var(--email-canvas,#f6f3ee)]">
          {message.html_body ? (
            <iframe
              title="Message body"
              sandbox=""
              srcDoc={emailSrcDoc(message.html_body)}
              className="block min-h-[360px] w-full border-0 bg-[var(--email-canvas,#f6f3ee)]"
            />
          ) : (
            <div className="max-w-[68ch] whitespace-pre-wrap px-6 py-5 text-[15px] leading-[1.6] text-[var(--foreground)]">
              {message.text_body || ""}
            </div>
          )}
        </div>

        {attachments.length > 0 ? (
          <div className="border-b border-[var(--line)] bg-[var(--surface-overlay)] px-5 py-3.5">
            <div className="mb-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
              <Paperclip className="h-3.5 w-3.5" />
              {attachments.length} attachment{attachments.length === 1 ? "" : "s"}
            </div>
            <div className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <a
                  key={a.id}
                  href={`/api/mail/${message.id}/attachments/${a.id}`}
                  className="inline-flex max-w-[280px] items-center gap-2 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-hover)] px-3 py-2 text-[12.5px] font-medium text-[var(--foreground)] no-underline hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line-strong))]"
                >
                  <Paperclip className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="truncate">{a.filename}</span>
                  <span className="font-mono text-[11px] text-[var(--foreground-muted)]">{Math.ceil(a.size / 1024)} KB</span>
                </a>
              ))}
            </div>
          </div>
        ) : message.has_attachments ? (
          <p className="m-0 border-b border-[var(--line)] bg-[var(--surface-overlay)] px-5 py-3.5 text-[12.5px] text-[var(--foreground-muted)]">
            This message had attachments, but R2 is not bound so files were not stored.
          </p>
        ) : null}

        {calendarInvite ? (
          <div className="mb-3.5 rounded-lg border border-[var(--line)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] p-4" role="group" aria-label="Calendar invitation">
            <p className="mb-2.5 text-[13px] text-[var(--foreground-muted)]">
              Calendar invite · {calendarInvite.filename}
            </p>
            <div className="flex flex-wrap gap-2 border-b border-[var(--line)] px-5 py-4">
              <Button type="button" className="min-h-[38px] gap-2 rounded-full bg-[var(--surface)]" disabled={rsvpBusy} onClick={() => void sendRsvp("accept")}>
                Accept
              </Button>
              <Button type="button" variant="outline" className="min-h-[38px] gap-2 rounded-full bg-[var(--surface)]" disabled={rsvpBusy} onClick={() => void sendRsvp("maybe")}>
                Maybe
              </Button>
              <Button type="button" variant="outline" className="min-h-[38px] gap-2 rounded-full bg-[var(--surface)]" disabled={rsvpBusy} onClick={() => void sendRsvp("decline")}>
                Decline
              </Button>
            </div>
            {rsvpNotice ? (
              <p className={tw.notice} role="status">
                {rsvpNotice}
              </p>
            ) : null}
            {rsvpError ? (
              <p className={tw.error} role="alert">
                {rsvpError}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-b border-[var(--line)] px-5 py-4">
          <Button type="button" variant="outline" className="min-h-[38px] gap-2 rounded-full bg-[var(--surface)]" onClick={() => onReply(false)}>
            <Reply className="h-4 w-4" />
            Reply
          </Button>
          <Button type="button" variant="outline" className="min-h-[38px] gap-2 rounded-full bg-[var(--surface)]" onClick={() => onReply(true)}>
            <ReplyAll className="h-4 w-4" />
            Reply all
          </Button>
          <Button type="button" variant="outline" className="min-h-[38px] gap-2 rounded-full bg-[var(--surface)]" onClick={onForward}>
            <Forward className="h-4 w-4" />
            Forward
          </Button>
        </div>

        <div className="bg-[var(--surface-overlay)] px-5 pb-7 pt-1">
          <Accordion
            type="multiple"
            className="w-full"
            defaultValue={[
              ...(message.label ? ["organize"] : []),
              ...(notes.length ? ["notes"] : []),
            ]}
          >
            <AccordionItem value="organize" className="border-[var(--line)]">
              <AccordionTrigger className="py-3.5 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
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
              <AccordionTrigger className="py-3.5 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
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
                      <li key={n.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface-hover)] px-3 py-2.5">
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
