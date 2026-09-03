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
  onSent?: () => void | Promise<void>;
_standalone?: boolean;
}) {
  const [from, setFrom] = useState(mailboxes[0]?.address ?? "");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(draft: boolean) {
    setErr("");
    setBusy(true);
    try {
      const text = new DOMParser().parseFromString(html, "text/html").body.textContent?.trim() ?? "";
      await api.send({ to, subject, text, html: text ? html : undefined, from: from || undefined, draft });
      await onSent?.();
      if (!onSent) onClose?.();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Send failed.");
    } finally {
      setBusy(false);
    }
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
        <RichTextEditor value={html} onChange={setHtml} />
      </div>
      <div className="compose-actions">
        <span className="compose-hint">Rich text is sent as HTML with a plain-text fallback.</span>
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
