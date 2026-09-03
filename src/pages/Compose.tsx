import { useState } from "react";
import { api, type Mailbox } from "../lib/api";
import RichTextEditor from "../components/RichTextEditor";

export default function Compose({
  mailboxes,
  onClose,
  onSent,
_standalone,
}: {
  mailboxes: Mailbox[];
  onClose?: () => void;
  onSent?: (draft: boolean) => void | Promise<void>;
_standalone?: boolean;
}) {
  const [from, setFrom] = useState(mailboxes[0]?.address ?? "");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [attachments, setAttachments] = useState<{ filename: string; content_type: string; data: string }[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(draft: boolean) {
    setErr("");
    setBusy(true);
    try {
      const text = new DOMParser().parseFromString(html, "text/html").body.textContent?.trim() ?? "";
      await api.send({ to, subject, text, html: text ? html : undefined, from: from || undefined, draft, attachments });
      await onSent?.(draft);
      if (!onSent) onClose?.();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addAttachments(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (attachments.length + selected.length > 10) { setErr("Attach at most 10 files."); return; }
    try {
      const encoded = await Promise.all(selected.map(async (file) => ({ filename: file.name, content_type: file.type || "application/octet-stream", data: await fileToDataUrl(file) })));
      const total = [...attachments, ...encoded].reduce((size, file) => size + Math.ceil(file.data.length * 0.75), 0);
      if (total > 25 * 1024 * 1024) { setErr("Attachments exceed Inlet’s 25 MB limit."); return; }
      setAttachments((current) => [...current, ...encoded]);
    } catch { setErr("Could not read one of the selected files."); }
  }

  const form = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      <div className="compose-title">
        <div>
          <span className="eyebrow">New message</span>
          <h2>Write without losing your place</h2>
        </div>
        {onClose ? <button type="button" className="icon-btn" onClick={onClose} aria-label="Close composer">×</button> : null}
      </div>
      {err ? <div className="err">{err}</div> : null}
      {mailboxes.length === 0 ? (
        <p className="muted">Add a mailbox in Settings before you send.</p>
      ) : (
        <div className="field">
          <label htmlFor="from">From</label>
          <select id="from" value={from} onChange={(e) => setFrom(e.target.value)}>
            {mailboxes.map((m) => (
              <option key={m.id} value={m.address}>{m.address}</option>
            ))}
          </select>
        </div>
      )}
      <div className="compose-fields">
        <div className="compose-field">
          <label htmlFor="to">To</label>
          <input id="to" type="text" inputMode="email" placeholder="name@example.com" value={to} onChange={(e) => setTo(e.target.value)} required />
        </div>
        <div className="compose-field">
          <label htmlFor="subject">Subject</label>
          <input id="subject" placeholder="What’s this about?" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </div>
      </div>
      <div className="compose-editor field">
        <label htmlFor="body">Message</label>
        <RichTextEditor onChange={setHtml} />
      </div>
      <div className="compose-actions">
        <div className="compose-attachments">
          <label className="attach-button" htmlFor="attachments">Attach files</label>
          <input id="attachments" className="sr-only" type="file" multiple onChange={(event) => { void addAttachments(event.target.files); event.currentTarget.value = ""; }} />
          {attachments.length ? <div className="attachment-chips">{attachments.map((file, index) => <button type="button" className="attachment-chip" key={`${file.filename}-${index}`} onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>{file.filename} <span aria-hidden>×</span></button>)}</div> : <span className="compose-hint">Rich text is sent as HTML with a plain-text fallback.</span>}
        </div>
        <div className="compose-action-buttons">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void submit(true)}>
          Save draft
        </button>
        <button type="submit" className="btn" disabled={busy || mailboxes.length === 0}>
          {busy ? "Sending…" : "Send"}
        </button>
        </div>
      </div>
    </form>
  );

  if (_standalone) return <div className="settings">{form}</div>;
  return (
    <div className="modal-back" role="dialog" aria-modal="true">
      <div className="modal">{form}</div>
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
