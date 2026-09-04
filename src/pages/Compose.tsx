import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type Contact, type Mailbox, type Signature, type Template } from "../lib/api";
import { htmlToText } from "../lib/format";
import type { EditorHandle } from "../components/RichTextEditor";

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
  onSent?: (kind: "sent" | "draft" | "scheduled") => void | Promise<void>;
}) {
  const editorRef = useRef<EditorHandle>(null);
  const [from, setFrom] = useState(draft?.from || mailboxes[0]?.address || "");
  const [to, setTo] = useState(draft?.to ?? "");
  const [cc, setCc] = useState(draft?.cc ?? "");
  const [bcc, setBcc] = useState(draft?.bcc ?? "");
  const [showCc, setShowCc] = useState(Boolean(draft?.cc || draft?.bcc));
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [draftId, setDraftId] = useState(draft?.id);
  const [attachments, setAttachments] = useState<{ filename: string; content_type: string; data: string }[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [suggest, setSuggest] = useState<"to" | "cc" | "bcc" | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const defaultSig = signatures.find((item) => item.is_default) ?? signatures[0];
  const initialHtml = useMemo(() => {
    if (draft?.html) return draft.html;
    if (defaultSig?.html_body) return `<p></p>${defaultSig.html_body}`;
    return "";
  }, [draft?.html, defaultSig?.html_body]);

  useEffect(() => {
    if (!from && mailboxes[0]) setFrom(mailboxes[0].address);
  }, [from, mailboxes]);

  const suggestions = useMemo(() => {
    const field = suggest === "to" ? to : suggest === "cc" ? cc : suggest === "bcc" ? bcc : "";
    const last = field.split(/[,;]/).pop()?.trim().toLowerCase() ?? "";
    if (!last || last.length < 1) return [];
    return contacts.filter((contact) => contact.email.includes(last) || contact.name.toLowerCase().includes(last)).slice(0, 6);
  }, [suggest, to, cc, bcc, contacts]);

  const payload = useCallback((draftFlag: boolean, scheduled_at?: number | null) => {
    const html = editorRef.current?.getHtml() ?? "";
    const text = htmlToText(html);
    return {
      id: draftId,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
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
    setBusy(true);
    try {
      const scheduled_at = kind === "schedule" && scheduleAt ? new Date(scheduleAt).getTime() : null;
      if (kind === "schedule" && (!scheduled_at || scheduled_at <= Date.now())) {
        setErr("Choose a future send time.");
        return;
      }
      const result = await api.send(payload(kind === "draft", scheduled_at));
      setDraftId(result.id);
      dirtyRef.current = false;
      await onSent?.(kind === "schedule" ? "scheduled" : kind === "draft" ? "draft" : "sent");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!dirtyRef.current || savingRef.current || busy) return;
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
    const parts = current.split(/[,;]/).map((part) => part.trim()).filter(Boolean);
    parts[parts.length - 1] = contact.email;
    setter(parts.join(", ") + ", ");
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

  const form = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit("send");
      }}
    >
      <div className="compose-title">
        <div>
          <span className="eyebrow">{status || (draftId ? "Autosaving drafts" : "New message")}</span>
          <h2>{title}</h2>
        </div>
        {onClose ? <button type="button" className="icon-btn" onClick={onClose} aria-label="Close composer">×</button> : null}
      </div>
      {err ? <div className="err">{err}</div> : null}
      {mailboxes.length === 0 ? (
        <p className="muted">Add a mailbox in Settings before you send.</p>
      ) : (
        <div className="compose-from-row">
          <div className="field" style={{ marginBottom: 0, flex: 1 }}>
            <label htmlFor="from">From</label>
            <select id="from" value={from} onChange={(e) => { setFrom(e.target.value); markDirty(); }}>
              {mailboxes.map((m) => (
                <option key={m.id} value={m.address}>{m.display_name ? `${m.display_name} · ${m.address}` : m.address}</option>
              ))}
            </select>
          </div>
          <button type="button" className="text-button" onClick={() => setShowCc((v) => !v)}>{showCc ? "Hide Cc/Bcc" : "Cc/Bcc"}</button>
        </div>
      )}
      <div className="compose-fields">
        <RecipientField id="to" label="To" value={to} onChange={(value) => { setTo(value); markDirty(); setSuggest("to"); }} onFocus={() => setSuggest("to")} />
        {showCc ? (
          <>
            <RecipientField id="cc" label="Cc" value={cc} onChange={(value) => { setCc(value); markDirty(); setSuggest("cc"); }} onFocus={() => setSuggest("cc")} />
            <RecipientField id="bcc" label="Bcc" value={bcc} onChange={(value) => { setBcc(value); markDirty(); setSuggest("bcc"); }} onFocus={() => setSuggest("bcc")} />
          </>
        ) : null}
        <div className="compose-field">
          <label htmlFor="subject">Subject</label>
          <input id="subject" placeholder="What’s this about?" value={subject} onChange={(e) => { setSubject(e.target.value); markDirty(); }} />
        </div>
      </div>
      {suggest && suggestions.length ? (
        <ul className="suggest-list" role="listbox">
          {suggestions.map((contact) => (
            <li key={contact.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyContact(contact)}>
                <strong>{contact.name || contact.email}</strong>
                <span>{contact.email}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="compose-meta-row">
        {templates.length ? (
          <label className="compose-select">
            <span>Template</span>
            <select defaultValue="" onChange={(e) => { if (e.target.value) applyTemplate(e.target.value); e.target.value = ""; }}>
              <option value="">Insert a template</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
        ) : null}
        {signatures.length ? (
          <label className="compose-select">
            <span>Signature</span>
            <select defaultValue={defaultSig?.id ?? ""} onChange={(e) => {
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
      <div className="compose-editor field">
        <label htmlFor="body">Message</label>
        <Suspense fallback={<div className="rich-editor-loading" aria-hidden />}>
          <RichTextEditor key={`${draft?.id ?? "new"}-${editorKey}`} ref={editorRef} initialHtml={editorNonce} onDirty={markDirty} />
        </Suspense>
      </div>
      {showSchedule ? (
        <div className="field">
          <label htmlFor="schedule">Send at</label>
          <input id="schedule" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
        </div>
      ) : null}
      <div className="compose-actions">
        <div className="compose-attachments">
          <label className="attach-button" htmlFor="attachments">Attach files</label>
          <input id="attachments" className="sr-only" type="file" multiple onChange={(event) => { void addAttachments(event.target.files); event.currentTarget.value = ""; }} />
          {attachments.length ? <div className="attachment-chips">{attachments.map((file, index) => <button type="button" className="attachment-chip" key={`${file.filename}-${index}`} onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>{file.filename} <span aria-hidden>×</span></button>)}</div> : <span className="compose-hint">⌘/Ctrl+Enter to send · drafts save as you type</span>}
        </div>
        <div className="compose-action-buttons">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void submit("draft")}>Save draft</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => showSchedule ? void submit("schedule") : setShowSchedule(true)}>
            {showSchedule ? "Schedule" : "Later"}
          </button>
          <button type="submit" className="btn" disabled={busy || mailboxes.length === 0}>
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </form>
  );

  if (variant === "pane") {
    return (
      <div className="compose-pane" role="region" aria-label={title}>
        {form}
      </div>
    );
  }

  return (
    <div className="modal-back" role="dialog" aria-modal="true">
      <div className="modal">{form}</div>
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
    <div className="compose-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" inputMode="email" autoComplete="off" placeholder="name@example.com" value={value} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} />
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
