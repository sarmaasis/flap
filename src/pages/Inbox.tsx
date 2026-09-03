import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Attachment, type MailFull, type MailSummary, type Mailbox } from "../lib/api";
import { go } from "../lib/nav";
import Compose from "./Compose";

const FOLDERS = [
  { id: "inbox", label: "Inbox" },
  { id: "sent", label: "Sent" },
  { id: "drafts", label: "Drafts" },
  { id: "spam", label: "Spam" },
  { id: "trash", label: "Trash" },
] as const;

function fmtDate(ms: number) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Inbox({ composeOpen }: { composeOpen?: boolean }) {
  const [folder, setFolder] = useState("inbox");
  const [list, setList] = useState<MailSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<MailFull | null>(null);
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [mailbox, setMailbox] = useState("");
  const [showCompose, setShowCompose] = useState(Boolean(composeOpen));
  const [email, setEmail] = useState("");

  useEffect(() => {
    api.me()
      .then((m) => {
        setEmail(m.user.email);
        setMailboxes(m.mailboxes);
      })
      .catch(() => go("/login"));
  }, []);

  const loadList = useCallback(async () => {
    setErr("");
    try {
      const data = q.trim().length >= 2 ? await api.search(q.trim()) : await api.mail(folder, mailbox || undefined);
      setList(data.messages);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not load mail.");
    }
  }, [folder, mailbox, q]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selected) {
      setMessage(null);
      setAtts([]);
      return;
    }
    api.message(selected)
      .then((d) => {
        setMessage(d.message);
        setAtts(d.attachments);
        setList((prev) => prev.map((m) => (m.id === selected ? { ...m, unread: 0 } : m)));
      })
      .catch((ex: unknown) => setErr(ex instanceof Error ? ex.message : "Could not open message."));
  }, [selected]);

  useEffect(() => {
    setShowCompose(Boolean(composeOpen));
  }, [composeOpen]);

  const title = useMemo(() => FOLDERS.find((f) => f.id === folder)?.label ?? "Inbox", [folder]);

  async function move(id: string, dest: string) {
    await api.move(id, dest);
    if (selected === id) setSelected(null);
    await loadList();
  }

  async function logout() {
    await api.logout();
    go("/");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/app" onClick={(e) => { e.preventDefault(); go("/app"); }}>
          Inlet
        </a>
        <button className="btn compose-button" onClick={() => { setShowCompose(true); if (window.location.pathname !== "/app/compose") window.history.replaceState({}, "", "/app/compose"); }}>
          Compose
        </button>
        <nav className="folder-nav" aria-label="Mail folders">
          {FOLDERS.map((f) => (
            <button
              key={f.id}
              className={`side-btn${folder === f.id ? " active" : ""}`}
              onClick={() => {
                setFolder(f.id);
                setSelected(null);
                setQ("");
                go("/app");
              }}
            >
              {f.label}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button className="side-btn" onClick={() => go("/app/settings")}>Settings</button>
          <button className="side-btn" onClick={() => void logout()}>Sign out</button>
          <div className="muted" style={{ padding: "6px 10px", color: "#a1a1aa" }}>{email}</div>
        </div>
      </aside>

      <div className="workspace">
        <section className={`list-pane${message ? " has-selection" : ""}`}>
          <div className="list-head">
            <h2>{title}</h2>
            <input
              placeholder="Search mail"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search mail"
            />
            {mailboxes.length > 1 ? (
              <select style={{ marginTop: 8 }} value={mailbox} onChange={(e) => setMailbox(e.target.value)} aria-label="Mailbox">
                <option value="">All mailboxes</option>
                {mailboxes.map((m) => (
                  <option key={m.id} value={m.id}>{m.address}</option>
                ))}
              </select>
            ) : null}
          </div>
          {err ? <div className="err" style={{ margin: 12 }}>{err}</div> : null}
          <div>
            {list.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>No messages in this view.</p>
            ) : (
              list.map((m) => (
                <button
                  key={m.id}
                  className={`msg-row${selected === m.id ? " active" : ""}${m.unread ? " unread" : ""}`}
                  onClick={() => setSelected(m.id)}
                >
                  <div className="msg-meta">
                    <span>{folder === "sent" ? m.to_addr : m.from_addr || "(unknown)"}</span>
                    <span>{fmtDate(m.date_ms)}</span>
                  </div>
                  <div className="subj">{m.subject || "(no subject)"}</div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className={`read-pane${message ? " has-message" : ""}`}>
          {!message ? (
            <div className="read-empty">Select a message, or compose a new one.</div>
          ) : (
            <>
              <button className="mobile-back" onClick={() => setSelected(null)}>Back to {title}</button>
              <div className="read-head">
                <h2>{message.subject || "(no subject)"}</h2>
                <div className="read-kv">From {message.from_addr || "(unknown)"}</div>
                <div className="read-kv">To {message.to_addr || "(unknown)"}</div>
                <div className="read-kv">{fmtDate(message.date_ms)}</div>
              </div>
              <div className="read-actions">
                {folder !== "spam" ? <button className="btn btn-ghost" onClick={() => void move(message.id, "spam")}>Spam</button> : null}
                {folder !== "trash" ? <button className="btn btn-ghost" onClick={() => void move(message.id, "trash")}>Trash</button> : null}
                {folder !== "inbox" ? <button className="btn btn-ghost" onClick={() => void move(message.id, "inbox")}>Move to Inbox</button> : null}
              </div>
              {message.html_body ? (
                <iframe
                  title="Message body"
                  sandbox=""
                  srcDoc={message.html_body}
                  style={{ width: "100%", minHeight: 360, border: "1px solid var(--line)", borderRadius: 8, background: "#fff" }}
                />
              ) : (
                <div className="body-text">{message.text_body || ""}</div>
              )}
              {atts.length > 0 ? (
                <div className="att-list">
                  {atts.map((a) => (
                    <a key={a.id} href={`/api/mail/${message.id}/attachments/${a.id}`}>
                      {a.filename} ({Math.ceil(a.size / 1024)} KB)
                    </a>
                  ))}
                </div>
              ) : message.has_attachments ? (
                <p className="muted">This message had attachments, but R2 is not bound so files were not stored.</p>
              ) : null}
            </>
          )}
        </section>
      </div>

      {showCompose ? (
        <Compose
          mailboxes={mailboxes}
          onClose={() => {
            setShowCompose(false);
            go("/app");
          }}
          onSent={async () => {
            setShowCompose(false);
            setFolder("sent");
            go("/app");
            await loadList();
          }}
        />
      ) : null}
    </div>
  );
}
