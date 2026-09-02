import { useState } from "react";
import { api, type Mailbox } from "../lib/api";

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
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(draft: boolean) {
    setErr("");
    setBusy(true);
    try {
      await api.send({ to, subject, text, from: from || undefined, draft });
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
      <h2>New message</h2>
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
      <div className="field">
        <label htmlFor="to">To</label>
        <input id="to" type="email" value={to} onChange={(e) => setTo(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="subject">Subject</label>
        <input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="body">Message</label>
        <textarea id="body" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {onClose ? <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button> : null}
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void submit(true)}>
          Save draft
        </button>
        <button type="submit" className="btn" disabled={busy || mailboxes.length === 0}>
          {busy ? "Sending…" : "Send"}
        </button>
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
