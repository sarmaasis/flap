import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { api, type Contact, type Domain, type Mailbox, type Signature, type Template } from "../lib/api";
import { htmlToText } from "../lib/format";
import { normalizeRecipientField, parseRecipientEmails } from "../lib/recipients";
import type { EditorHandle } from "../components/RichTextEditor";
import { Button } from "../components/ui/button";
import { tw } from "../lib/tw";
import { cn } from "../lib/utils";

const RichTextEditor = lazy(() => import("../components/RichTextEditor"));

export type ComposeDraft = {
  id?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  html?: string;
  from?: string;
  inReplyTo?: string;
  mode?: "new" | "reply" | "forward" | "draft";
};

export default function Compose({
  mailboxes,
  contacts = [],
  templates = [],
  signatures = [],
  draft,
  variant = "modal",
  onClose,
  onDiscard,
  onSent,
}: {
  mailboxes: Mailbox[];
  contacts?: Contact[];
  templates?: Template[];
  signatures?: Signature[];
  draft?: ComposeDraft | null;
  /** modal = floating overlay; pane = fills the mail reader (drafts/scheduled). */
  variant?: "modal" | "pane";
  onClose?: () => void;
  onDiscard?: () => void | Promise<void>;
  onSent?: (
    kind: "sent" | "draft" | "scheduled",
    meta?: { id?: string; undo?: boolean; undo_seconds?: number },
  ) => void | Promise<void>;
}) {
  const editorRef = useRef<EditorHandle>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const sendableMailboxes = useMemo(() => {
    if (!domains.length) return mailboxes;
    return mailboxes.filter((m) => {
      const d = domains.find((x) => x.id === m.domain_id);
      if (!d) return true;
      // Legacy providers: allow if no readiness timestamps (pre-SES schema).
      if ((d.mail_provider || "").toLowerCase() === "mailgun" || (d.mail_provider || "").toLowerCase() === "cloudflare") {
        return Boolean(d.sending_ready_at || d.mx_verified_at || !d.mail_provider);
      }
      return Boolean(d.sending_ready_at);
    });
  }, [domains, mailboxes]);
  const [from, setFrom] = useState(draft?.from || sendableMailboxes[0]?.address || mailboxes[0]?.address || "");
  const [to, setTo] = useState(draft?.to ?? "");
  const [cc, setCc] = useState(draft?.cc ?? "");
  const [bcc, setBcc] = useState(draft?.bcc ?? "");
  const [showCc, setShowCc] = useState(Boolean(draft?.cc || draft?.bcc));
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [draftId, setDraftId] = useState(draft?.id);
  const [attachments, setAttachments] = useState<{ filename: string; content_type: string; data: string }[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const sendingRef = useRef(false);
  const [status, setStatus] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [suggest, setSuggest] = useState<"to" | "cc" | "bcc" | null>(null);
  const [unlockFrom, setUnlockFrom] = useState(false);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const defaultSig = signatures.find((item) => item.is_default) ?? signatures[0];
  const initialHtml = useMemo(() => {
    if (draft?.html) return draft.html;
    if (defaultSig?.html_body) return `<p></p>${defaultSig.html_body}`;
    return "";
  }, [draft?.html, defaultSig?.html_body]);

  useEffect(() => {
    void api.domains().then((r) => setDomains(r.domains)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (from && (sendableMailboxes.some((m) => m.address === from) || mailboxes.some((m) => m.address === from))) return;
    if (sendableMailboxes[0]) setFrom(sendableMailboxes[0].address);
    else if (!from && mailboxes[0]) setFrom(mailboxes[0].address);
  }, [from, mailboxes, sendableMailboxes]);

  const identityLocked = (draft?.mode === "reply" || draft?.mode === "forward") && Boolean(draft?.from) && !unlockFrom;
  const fromMailbox = mailboxes.find((m) => m.address === from) ?? sendableMailboxes.find((m) => m.address === from);
  const fromDomain = domains.find((d) => d.id === fromMailbox?.domain_id);
  const domainStyle = fromDomain?.color
    ? ({ ["--domain-color"]: fromDomain.color } as CSSProperties)
    : undefined;
  const fromOptions = useMemo(() => {
    if (!from || sendableMailboxes.some((m) => m.address === from)) return sendableMailboxes;
    const extra = mailboxes.find((m) => m.address === from);
    return extra ? [extra, ...sendableMailboxes] : sendableMailboxes;
  }, [from, mailboxes, sendableMailboxes]);

  const suggestions = useMemo(() => {
    const field = suggest === "to" ? to : suggest === "cc" ? cc : suggest === "bcc" ? bcc : "";
    const last = field.split(/[,;]/).pop()?.trim().toLowerCase() ?? "";
    if (!last || last.length < 1) return [];
    return contacts.filter((contact) => contact.email.includes(last) || contact.name.toLowerCase().includes(last)).slice(0, 6);
  }, [suggest, to, cc, bcc, contacts]);

  const payload = useCallback((draftFlag: boolean, scheduled_at?: number | null) => {
    const html = editorRef.current?.getHtml() ?? "";
    const text = htmlToText(html);
    const toNorm = normalizeRecipientField(to);
    const ccNorm = normalizeRecipientField(cc);
    const bccNorm = normalizeRecipientField(bcc);
    return {
      id: draftId,
      to: toNorm,
      cc: ccNorm || undefined,
      bcc: bccNorm || undefined,
      subject,
      text,
      html: text ? html : undefined,
      from: from || undefined,
      draft: draftFlag,
      scheduled_at,
      in_reply_to: draft?.inReplyTo,
      attachments: attachments.length ? attachments : undefined,
    };
  }, [attachments, bcc, cc, draft?.inReplyTo, draftId, from, subject, to]);

  async function submit(kind: "send" | "draft" | "schedule") {
    setErr("");
    if (sendingRef.current) return;
    if (kind === "send" && sendableMailboxes.length === 0) {
      setErr("Finish sending setup for your domain before sending.");
      return;
    }
    // Autocomplete leaves a trailing ", " — normalize before validating / sending.
    const toNorm = normalizeRecipientField(to);
    const ccNorm = normalizeRecipientField(cc);
    const bccNorm = normalizeRecipientField(bcc);
    if (toNorm !== to) setTo(toNorm);
    if (ccNorm !== cc) setCc(ccNorm);
    if (bccNorm !== bcc) setBcc(bccNorm);

    const toList = parseRecipientEmails(toNorm);
    if (kind !== "draft") {
      if (!toList.length) {
        setErr("Add at least one recipient.");
        return;
      }
      if (toList.length > 20) {
        setErr("Enter between 1 and 20 valid recipient addresses, separated by commas.");
        return;
      }
      if (!subject.trim() && kind === "send") {
        setErr("Subject is required.");
        return;
      }
    }
    sendingRef.current = true;
    setBusy(true);
    try {
      const scheduled_at = kind === "schedule" && scheduleAt ? new Date(scheduleAt).getTime() : null;
      if (kind === "schedule" && (!scheduled_at || scheduled_at <= Date.now())) {
        setErr("Choose a future send time.");
        return;
      }
      const result = await api.send({
        ...payload(kind === "draft", scheduled_at),
        to: toNorm,
        cc: ccNorm || undefined,
        bcc: bccNorm || undefined,
      });
      setDraftId(result.id);
      dirtyRef.current = false;
      const sentKind = kind === "schedule" ? "scheduled" : kind === "draft" ? "draft" : "sent";
      await onSent?.(sentKind, {
        id: result.id,
        undo: Boolean(result.undo),
        undo_seconds: result.undo_seconds,
      });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Send failed.");
    } finally {
      sendingRef.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!dirtyRef.current || savingRef.current || busy || sendingRef.current) return;
      if (!to.trim() && !subject.trim() && htmlToText(editorRef.current?.getHtml() ?? "").length < 2) return;
      savingRef.current = true;
      void api.send(payload(true))
        .then((result) => {
          setDraftId(result.id);
          dirtyRef.current = false;
          setStatus("Draft saved");
          setErr("");
        })
        .catch((ex) => {
          const message = ex instanceof Error ? ex.message : "Could not save draft.";
          if (/storage|quota|plan|upgrade/i.test(message)) setErr(message);
        })
        .finally(() => { savingRef.current = false; });
    }, 1800);
    return () => window.clearInterval(timer);
  }, [busy, payload, subject, to]);

  function markDirty() {
    dirtyRef.current = true;
    setStatus("");
  }

  async function addAttachments(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (attachments.length + selected.length > 10) { setErr("Attach at most 10 files."); return; }
    try {
      const encoded = await Promise.all(selected.map(async (file) => ({ filename: file.name, content_type: file.type || "application/octet-stream", data: await fileToDataUrl(file) })));
      const total = [...attachments, ...encoded].reduce((size, file) => size + Math.ceil(file.data.length * 0.75), 0);
      if (total > 25 * 1024 * 1024) { setErr("Attachments exceed Flap’s 25 MB limit."); return; }
      setAttachments((current) => [...current, ...encoded]);
      markDirty();
    } catch { setErr("Could not read one of the selected files."); }
  }

  function applyContact(contact: Contact) {
    const setter = suggest === "cc" ? setCc : suggest === "bcc" ? setBcc : setTo;
    const current = suggest === "cc" ? cc : suggest === "bcc" ? bcc : to;
    const parts = current.split(/[,;，；]/).map((part) => part.trim()).filter(Boolean);
    parts[parts.length - 1] = contact.email;
    // Keep a trailing separator only so the next address is easy to type — strip on send.
    setter(`${parts.join(", ")}, `);
    setSuggest(null);
    markDirty();
  }

  function applyTemplate(id: string) {
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    if (template.subject && !subject) setSubject(template.subject);
    const next = `<p></p>${template.html_body || `<p>${template.text_body}</p>`}${defaultSig?.html_body ? defaultSig.html_body : ""}`;
    setEditorNonce(next);
    setEditorKey((key) => key + 1);
    markDirty();
  }

  const [editorNonce, setEditorNonce] = useState(initialHtml);
  const [editorKey, setEditorKey] = useState(0);

  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void submitRef.current("send");
      }
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = draft?.mode === "reply" ? "Reply" : draft?.mode === "forward" ? "Forward" : draft?.id ? "Continue draft" : "New message";
  const fieldLabel = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--foreground-muted)]";
  const rowLabel = "m-0 text-[13px] text-[var(--foreground-muted)]";
  const rowInput =
    "min-w-0 w-full border-0 bg-transparent py-3 text-sm text-[var(--foreground)] shadow-none outline-none placeholder:text-[var(--foreground-faint)]";
  const bareSelect =
    "min-w-0 flex-1 cursor-pointer border-0 bg-transparent py-2 text-sm text-[var(--foreground)] shadow-none outline-none";

  const form = (
    <form
      className={cn("flex h-full min-h-0 flex-col", variant === "modal" && "px-[18px] pt-4")}
      onSubmit={(e) => {
        e.preventDefault();
        void submit("send");
      }}
    >
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-2">
        <div className="mb-4 flex items-start justify-between gap-4 md:mb-5">
          <div>
            <span className={tw.eyebrow}>{status || (draftId ? "Autosaving drafts" : "New message")}</span>
            <h2 className="m-0 text-lg font-semibold tracking-tight text-[var(--foreground)]">{title}</h2>
          </div>
          {onClose ? (
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close composer">
              ×
            </Button>
          ) : null}
        </div>
        {err ? <div className={tw.err}>{err}</div> : null}
        {mailboxes.length === 0 ? (
          <p className={tw.muted}>Add a mailbox in Settings before you send.</p>
        ) : sendableMailboxes.length === 0 ? (
          <div className={tw.notice} role="status">
            <p>No sender is sending-ready yet. Finish SES sending verification for your domain in Settings, then compose again.</p>
            <p className={tw.muted} style={{ marginTop: 8 }}>Mailboxes exist, but this domain’s sending DNS is not verified yet. Finish Setup → DNS records, then try again.</p>
          </div>
        ) : (
          <div
            className={cn(
              "mb-3.5 flex flex-wrap items-end gap-3",
              identityLocked && "rounded-[10px] border border-[color-mix(in_srgb,var(--domain-color,var(--accent))_35%,var(--line))] bg-[color-mix(in_srgb,var(--domain-color,var(--accent))_8%,var(--surface))] p-3 shadow-[inset_3px_0_var(--domain-color,var(--accent))]",
              !identityLocked && fromDomain?.color && "rounded-[10px] border border-[color-mix(in_srgb,var(--domain-color,var(--line))_28%,var(--line))] bg-[color-mix(in_srgb,var(--domain-color,transparent)_5%,var(--surface))] p-3 shadow-[inset_3px_0_var(--domain-color,transparent)]",
            )}
            style={domainStyle}
          >
            <div className="min-w-0 flex-1">
              <label htmlFor="from" className={fieldLabel}>From</label>
              {identityLocked ? (
                <div className="flex min-h-10 items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                  <span
                    className={tw.domainSwatch}
                    aria-hidden
                    style={{ background: fromDomain?.color || "var(--muted)" }}
                  />
                  <span id="from">{from}</span>
                  <Button type="button" variant="link" className="h-auto p-0" onClick={() => setUnlockFrom(true)}>
                    Change
                  </Button>
                </div>
              ) : (
                <div className="flex min-h-10 items-center gap-2 rounded-[10px] border border-[var(--line-strong)] bg-[var(--surface)] px-2.5">
                  <span
                    className={tw.domainSwatch}
                    aria-hidden
                    style={{ background: fromDomain?.color || "var(--muted)" }}
                  />
                  <select id="from" className={bareSelect} value={from} onChange={(e) => { setFrom(e.target.value); markDirty(); }} aria-label="From address">
                    {fromOptions.map((m) => {
                      const d = domains.find((x) => x.id === m.domain_id);
                      const label = m.display_name ? `${m.display_name} · ${m.address}` : m.address;
                      return (
                        <option key={m.id} value={m.address}>
                          {d?.name ? `${label} (${d.name})` : label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
            <button type="button" className={tw.textButton} onClick={() => setShowCc((v) => !v)}>{showCc ? "Hide Cc/Bcc" : "Cc/Bcc"}</button>
          </div>
        )}
        <div className="mb-3.5 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface-overlay)]">
          <RecipientField id="to" label="To" value={to} onChange={(value) => { setTo(value); markDirty(); setSuggest("to"); }} onFocus={() => setSuggest("to")} />
          {showCc ? (
            <>
              <RecipientField id="cc" label="Cc" value={cc} onChange={(value) => { setCc(value); markDirty(); setSuggest("cc"); }} onFocus={() => setSuggest("cc")} />
              <RecipientField id="bcc" label="Bcc" value={bcc} onChange={(value) => { setBcc(value); markDirty(); setSuggest("bcc"); }} onFocus={() => setSuggest("bcc")} />
            </>
          ) : null}
          <div className="grid grid-cols-[56px_minmax(0,1fr)] items-center border-b border-[var(--line)] px-3 last:border-b-0 md:grid-cols-[72px_minmax(0,1fr)]">
            <label htmlFor="subject" className={rowLabel}>Subject</label>
            <input id="subject" className={rowInput} placeholder="What’s this about?" value={subject} onChange={(e) => { setSubject(e.target.value); markDirty(); }} />
          </div>
        </div>
        {suggest && suggestions.length ? (
          <ul className="-mt-2 mb-3 list-none rounded-[10px] border border-[var(--line)] p-0" role="listbox">
            {suggestions.map((contact) => (
              <li key={contact.id}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-3 py-2 text-left text-sm hover:bg-[var(--surface-hover)]"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyContact(contact)}
                >
                  <strong>{contact.name || contact.email}</strong>
                  <span className="text-xs text-[var(--foreground-muted)]">{contact.email}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mb-2.5 flex flex-wrap gap-3">
          {templates.length ? (
            <label className="grid min-w-[180px] gap-1 text-xs text-[var(--foreground-muted)] max-md:min-w-0 max-md:flex-1">
              <span>Template</span>
              <select className={cn(tw.nativeControl, "w-full")} defaultValue="" onChange={(e) => { if (e.target.value) applyTemplate(e.target.value); e.target.value = ""; }}>
                <option value="">Insert a template</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
            </label>
          ) : null}
          {signatures.length ? (
            <label className="grid min-w-[180px] gap-1 text-xs text-[var(--foreground-muted)] max-md:min-w-0 max-md:flex-1">
              <span>Signature</span>
              <select className={cn(tw.nativeControl, "w-full")} defaultValue={defaultSig?.id ?? ""} onChange={(e) => {
                const signature = signatures.find((item) => item.id === e.target.value);
                if (signature) {
                  setEditorNonce(`${editorRef.current?.getHtml() ?? ""}<p></p>${signature.html_body}`);
                  setEditorKey((key) => key + 1);
                }
              }}>
                {signatures.map((signature) => <option key={signature.id} value={signature.id}>{signature.name}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        <div className="mb-3.5 flex min-h-0 flex-col">
          <label htmlFor="body" className={fieldLabel}>Message</label>
          <Suspense fallback={<div className="min-h-[268px] animate-pulse rounded-[10px] border border-[var(--line)] bg-[linear-gradient(110deg,var(--surface)_25%,var(--surface-hover)_40%,var(--surface)_55%)] bg-[length:200%_100%]" aria-hidden />}>
            <RichTextEditor key={`${draft?.id ?? "new"}-${editorKey}`} ref={editorRef} initialHtml={editorNonce} onDirty={markDirty} />
          </Suspense>
        </div>
        {showSchedule ? (
          <div className="mb-3.5">
            <label htmlFor="schedule" className={fieldLabel}>Send at</label>
            <input id="schedule" className={tw.nativeControl} type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          "mt-auto flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-t border-[var(--line)] bg-[var(--surface-overlay)] py-3",
          variant === "modal" && "-mx-[18px] px-[18px] pb-3.5",
          variant === "pane" && "-mx-6 px-6 pb-[18px]",
        )}
      >
        <div className="flex min-w-0 flex-1 basis-40 flex-wrap items-center gap-2">
          <label className="inline-flex min-h-[29px] cursor-pointer items-center rounded border border-[var(--line)] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--foreground-muted)] hover:bg-[rgb(var(--accent-rgb)/0.08)] hover:text-[var(--accent)]" htmlFor="attachments">Attach files</label>
          <input id="attachments" className="sr-only" type="file" multiple onChange={(event) => { void addAttachments(event.target.files); event.currentTarget.value = ""; }} />
          {attachments.length ? (
            <div className="flex max-w-[350px] flex-wrap gap-1">
              {attachments.map((file, index) => (
                <button
                  type="button"
                  className="max-w-[180px] cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded border border-[var(--line-strong)] bg-[var(--surface-hover)] px-2 py-1 text-[11px] text-[var(--foreground)]"
                  key={`${file.filename}-${index}`}
                  aria-label={`Remove attachment ${file.filename}`}
                  onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  {file.filename} <span aria-hidden>×</span>
                </button>
              ))}
            </div>
          ) : (
            <span className="hidden text-[11px] text-[var(--foreground-muted)] sm:inline">⌘/Ctrl+Enter to send · drafts save as you type</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onDiscard && draftId ? (
            <Button type="button" variant="danger" disabled={busy} onClick={() => void onDiscard()}>
              Delete
            </Button>
          ) : null}
          <Button type="button" variant="outline" disabled={busy} onClick={() => void submit("draft")}>
            Save draft
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => (showSchedule ? void submit("schedule") : setShowSchedule(true))}
          >
            {showSchedule ? "Schedule" : "Later"}
          </Button>
          <Button type="submit" disabled={busy || mailboxes.length === 0}>
            {busy ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </form>
  );

  if (variant === "pane") {
    return (
      <div
        className="mx-auto flex h-full min-h-[min(100%,560px)] w-full max-w-[820px] flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-overlay)] px-6 pt-[22px] shadow-[var(--shadow)] box-border"
        role="region"
        aria-label={title}
        style={domainStyle}
      >
        {form}
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-0 md:items-end md:justify-end md:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="pointer-events-auto flex h-[min(92dvh,calc(100dvh-env(safe-area-inset-bottom)))] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--line)] bg-[var(--surface-overlay)] shadow-[0_18px_40px_rgba(0,0,0,0.18)] md:h-[min(640px,calc(100dvh-48px))] md:w-[min(680px,calc(100vw-40px))] md:rounded-2xl"
        style={domainStyle}
      >
        {form}
      </div>
    </div>
  );
}

function RecipientField({
  id,
  label,
  value,
  onChange,
  onFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
}) {
  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)] items-center border-b border-[var(--line)] px-3 last:border-b-0 md:grid-cols-[72px_minmax(0,1fr)]">
      <label htmlFor={id} className="m-0 text-[13px] text-[var(--foreground-muted)]">{label}</label>
      <input
        id={id}
        type="text"
        inputMode="email"
        autoComplete="off"
        placeholder="name@example.com"
        className="min-w-0 w-full border-0 bg-transparent py-3 text-sm text-[var(--foreground)] shadow-none outline-none placeholder:text-[var(--foreground-faint)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={() => onChange(normalizeRecipientField(value))}
      />
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("File was not readable."));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
