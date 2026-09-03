import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type Attachment,
  type Contact,
  type FolderCounts,
  type MailFull,
  type MailSummary,
  type Mailbox,
  type Signature,
  type Template,
} from "../lib/api";
import { extractEmail, fmtDate, initials, quoteHtml, senderName } from "../lib/format";
import { go } from "../lib/nav";
import AppShell, { FOLDERS } from "../components/AppShell";
import type { ComposeDraft } from "./Compose";

const Compose = lazy(() => import("./Compose"));

const EMPTY: Record<string, string> = {
  inbox: "You're all caught up. New mail for your domain will land here.",
  starred: "Star messages you want to find again.",
  snoozed: "Nothing is waiting to come back. Snooze a message from the reader.",
  drafts: "No drafts yet. Inlet saves them as you write.",
  scheduled: "No messages waiting to send.",
  sent: "Nothing sent yet. Compose a message to get started.",
  archive: "Archived mail lives here, out of the way.",
  spam: "Blocked and junk mail will appear here.",
  trash: "Trash is empty.",
};

export default function Inbox({ composeOpen }: { composeOpen?: boolean }) {
  const [folder, setFolder] = useState("inbox");
  const [list, setList] = useState<MailSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<MailFull | null>(null);
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [err, setErr] = useState("");
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [mailbox, setMailbox] = useState("");
  const [showCompose, setShowCompose] = useState(Boolean(composeOpen));
  const [composeDraft, setComposeDraft] = useState<ComposeDraft | null>(null);
  const [email, setEmail] = useState("");
  const [counts, setCounts] = useState<FolderCounts>({});
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 280);
    return () => window.clearTimeout(t);
  }, [q]);

  const refreshBootstrap = useCallback(async () => {
    const data = await api.bootstrap();
    setEmail(data.user.email);
    setMailboxes(data.mailboxes);
    setCounts(data.counts);
    setContacts(data.contacts);
    setTemplates(data.templates);
    setSignatures(data.signatures);
  }, []);

  useEffect(() => {
    refreshBootstrap().catch(() => go("/login"));
  }, [refreshBootstrap]);

  const loadList = useCallback(async (signal?: AbortSignal) => {
    setErr("");
    try {
      const data = qDebounced.length >= 2 ? await api.search(qDebounced, signal) : await api.mail(folder, mailbox || undefined, signal);
      if (signal?.aborted) return;
      setList(data.messages);
    } catch (ex) {
      if (ex instanceof DOMException && ex.name === "AbortError") return;
      setErr(ex instanceof Error ? ex.message : "Could not load mail.");
    } finally {
      if (!signal?.aborted) setLoadingList(false);
    }
  }, [folder, mailbox, qDebounced]);

  useEffect(() => {
    const ac = new AbortController();
    setLoadingList(true);
    void loadList(ac.signal);
    return () => ac.abort();
  }, [loadList]);

  useEffect(() => {
    if (!selected) {
      setMessage(null);
      setAtts([]);
      return;
    }
    const ac = new AbortController();
    setLoadingMessage(true);
    api.message(selected, ac.signal)
      .then((d) => {
        setMessage(d.message);
        setAtts(d.attachments);
        setList((prev) => prev.map((m) => (m.id === selected ? { ...m, unread: 0 } : m)));
      })
      .catch((ex: unknown) => {
        if (ex instanceof DOMException && ex.name === "AbortError") return;
        setErr(ex instanceof Error ? ex.message : "Could not open message.");
      })
      .finally(() => setLoadingMessage(false));
    return () => ac.abort();
  }, [selected]);

  useEffect(() => {
    setShowCompose(Boolean(composeOpen));
  }, [composeOpen]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void api.counts().then((d) => {
        setCounts(d.counts);
        const inboxUnread = d.counts.inbox?.unread ?? 0;
        if (folder === "inbox" && qDebounced.length < 2 && inboxUnread > (counts.inbox?.unread ?? 0)) {
          void loadList();
        }
      }).catch(() => undefined);
    }, 20000);
    return () => window.clearInterval(id);
  }, [counts.inbox?.unread, folder, loadList, qDebounced.length]);

  const title = useMemo(() => FOLDERS.find((f) => f.id === folder)?.label ?? "Inbox", [folder]);

  const openCompose = useCallback((draft?: ComposeDraft) => {
    setComposeDraft(draft ?? null);
    setShowCompose(true);
    if (window.location.pathname !== "/app/compose") window.history.replaceState({}, "", "/app/compose");
  }, []);

  const closeCompose = useCallback(() => {
    setShowCompose(false);
    setComposeDraft(null);
    go("/app");
  }, []);

  async function move(id: string, dest: string) {
    await api.move(id, dest);
    if (selected === id) setSelected(null);
    await Promise.all([loadList(), refreshBootstrap().catch(() => undefined)]);
  }

  async function toggleStar(row: MailSummary) {
    const next = !row.starred;
    setList((prev) => prev.map((item) => (item.id === row.id ? { ...item, starred: next ? 1 : 0 } : item)));
    if (message?.id === row.id) setMessage({ ...message, starred: next ? 1 : 0 });
    await api.flags(row.id, { starred: next });
    await refreshBootstrap().catch(() => undefined);
  }

  async function snooze(id: string, until: number) {
    await api.flags(id, { snooze_until: until });
    setSnoozeOpen(false);
    if (selected === id) setSelected(null);
    await Promise.all([loadList(), refreshBootstrap().catch(() => undefined)]);
  }

  async function logout() {
    await api.logout();
    go("/");
  }

  function onRowClick(row: MailSummary) {
    if (row.folder === "drafts" || folder === "drafts" || folder === "scheduled") {
      void api.message(row.id).then((d) => {
        openCompose({
          id: d.message.id,
          to: d.message.to_addr,
          cc: d.message.cc_addr,
          bcc: d.message.bcc_addr,
          subject: d.message.subject,
          html: d.message.html_body || `<p>${d.message.text_body}</p>`,
          from: extractEmail(d.message.from_addr),
          mode: "draft",
        });
      });
      return;
    }
    setSelected(row.id);
  }

  function reply(all = false) {
    if (!message) return;
    const to = extractEmail(folder === "sent" ? message.to_addr : message.from_addr);
    const cc = all ? [message.to_addr, message.cc_addr].filter(Boolean).join(", ") : "";
    const prefix = message.subject.toLowerCase().startsWith("re:") ? message.subject : `Re: ${message.subject || "(no subject)"}`;
    openCompose({
      to,
      cc,
      subject: prefix,
      html: quoteHtml(message.from_addr, message.date_ms, message.html_body, message.text_body),
      inReplyTo: message.id,
      mode: "reply",
    });
  }

  function forward() {
    if (!message) return;
    openCompose({
      subject: message.subject.toLowerCase().startsWith("fwd:") ? message.subject : `Fwd: ${message.subject || "(no subject)"}`,
      html: quoteHtml(message.from_addr, message.date_ms, message.html_body, message.text_body),
      mode: "forward",
    });
  }

  const keyCtx = useRef({ list, selected, message, showCompose, folder, openCompose, reply, forward: () => undefined as void, move, toggleStar, onRowClick });
  keyCtx.current = { list, selected, message, showCompose, folder, openCompose, reply, move, toggleStar, onRowClick, forward: () => undefined };
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      const ctx = keyCtx.current;
      if (ctx.showCompose) return;
      if (event.key === "c") { event.preventDefault(); ctx.openCompose(); }
      if (event.key === "/") { event.preventDefault(); document.getElementById("mail-search")?.focus(); }
      if (event.key === "?") { event.preventDefault(); setHelpOpen((v) => !v); }
      if (event.key === "j" || event.key === "k") {
        event.preventDefault();
        if (!ctx.list.length) return;
        const index = Math.max(0, ctx.list.findIndex((item) => item.id === ctx.selected));
        const next = event.key === "j" ? Math.min(ctx.list.length - 1, index + 1) : Math.max(0, index - 1);
        ctx.onRowClick(ctx.list[next]);
      }
      if (!ctx.message) return;
      if (event.key === "r") { event.preventDefault(); ctx.reply(false); }
      if (event.key === "e") { event.preventDefault(); void ctx.move(ctx.message.id, "archive"); }
      if (event.key === "s") { event.preventDefault(); void ctx.toggleStar(ctx.message); }
      if (event.key === "#") { event.preventDefault(); void ctx.move(ctx.message.id, "trash"); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <AppShell
      email={email}
      counts={counts}
      folder={folder}
      current="mail"
      onCompose={() => {
        void import("./Compose");
        openCompose();
      }}
      onFolder={(id) => {
        setFolder(id);
        setSelected(null);
        setQ("");
        setQDebounced("");
        go("/app");
      }}
      onLogout={() => void logout()}
    >
      <div className="workspace">
        <section className={`list-pane${message ? " has-selection" : ""}`}>
          <div className="list-head">
            <div className="list-title-row">
              <div>
                <span className="eyebrow">{qDebounced ? "Search results" : "Mailbox"}</span>
                <h2>{qDebounced ? `Results for “${qDebounced}”` : title}</h2>
              </div>
              <span className="mail-count">{loadingList ? "…" : list.length}</span>
            </div>
            <div className="search-field">
              <span aria-hidden>⌕</span>
              <input id="mail-search" placeholder="Search mail" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search mail" />
            </div>
            {mailboxes.length > 1 ? (
              <select className="mailbox-filter" value={mailbox} onChange={(e) => setMailbox(e.target.value)} aria-label="Mailbox">
                <option value="">All mailboxes</option>
                {mailboxes.map((m) => (
                  <option key={m.id} value={m.id}>{m.address}</option>
                ))}
              </select>
            ) : null}
          </div>
          {err ? <div className="err" style={{ margin: 12 }}>{err}</div> : null}
          <div className="list-body">
            {loadingList ? (
              <div className="skeleton-stack" aria-hidden>
                <div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" />
              </div>
            ) : list.length === 0 ? (
              <div className="empty-panel">
                <strong>{qDebounced ? "No matches" : `No ${title.toLowerCase()} yet`}</strong>
                <p>{qDebounced ? "Try a different name, subject, or phrase." : EMPTY[folder]}</p>
              </div>
            ) : (
              list.map((m) => (
                <MessageRow
                  key={m.id}
                  row={m}
                  folder={folder}
                  active={selected === m.id}
                  onOpen={() => onRowClick(m)}
                  onStar={() => void toggleStar(m)}
                />
              ))
            )}
          </div>
        </section>

        <section className={`read-pane${message ? " has-message" : ""}`}>
          {loadingMessage && selected ? (
            <div className="empty-panel"><p className="muted">Opening message…</p></div>
          ) : !message ? (
            <div className="read-empty">
              <div className="empty-panel">
                <strong>Select a message</strong>
                <p>Or press C to compose. Press ? for keyboard shortcuts.</p>
              </div>
            </div>
          ) : (
            <>
              <button type="button" className="mobile-back" onClick={() => setSelected(null)}>Back to {title}</button>
              <div className="read-head">
                <div className="read-subject-row">
                  <h2>{message.subject || "(no subject)"}</h2>
                  <span className="read-date">{fmtDate(message.date_ms)}</span>
                </div>
                <div className="sender-card">
                  <span className="mail-avatar large" aria-hidden>{initials(message.from_addr)}</span>
                  <div>
                    <strong>{senderName(message.from_addr)}</strong>
                    <div className="read-kv">{message.from_addr || "(unknown)"} <span>→</span> {message.to_addr || "(unknown)"}</div>
                    {message.cc_addr ? <div className="read-kv">Cc {message.cc_addr}</div> : null}
                  </div>
                </div>
              </div>
              <div className="read-actions">
                <button type="button" className="btn" onClick={() => reply(false)}>Reply</button>
                <button type="button" className="btn btn-ghost" onClick={() => reply(true)}>Reply all</button>
                <button type="button" className="btn btn-ghost" onClick={forward}>Forward</button>
                <button type="button" className="btn btn-ghost" onClick={() => void toggleStar(message)}>{message.starred ? "Unstar" : "Star"}</button>
                <button type="button" className="btn btn-ghost" onClick={() => void move(message.id, "archive")}>Archive</button>
                <button type="button" className="btn btn-ghost" onClick={() => setSnoozeOpen((v) => !v)}>Snooze</button>
                {folder !== "spam" ? <button type="button" className="btn btn-ghost" onClick={() => void move(message.id, "spam")}>Spam</button> : null}
                {folder !== "trash" ? <button type="button" className="btn btn-ghost" onClick={() => void move(message.id, "trash")}>Trash</button> : (
                  <button type="button" className="btn btn-danger" onClick={() => void api.remove(message.id).then(() => { setSelected(null); return loadList(); })}>Delete forever</button>
                )}
                {folder !== "inbox" && folder !== "starred" && folder !== "snoozed" ? <button type="button" className="btn btn-ghost" onClick={() => void move(message.id, "inbox")}>Move to Inbox</button> : null}
                <button type="button" className="btn btn-ghost" onClick={() => { void api.block(extractEmail(message.from_addr)).then(() => move(message.id, "spam")); }}>Block sender</button>
              </div>
              {snoozeOpen ? (
                <div className="snooze-row">
                  <button type="button" className="btn btn-ghost" onClick={() => void snooze(message.id, Date.now() + 3 * 60 * 60 * 1000)}>In 3 hours</button>
                  <button type="button" className="btn btn-ghost" onClick={() => void snooze(message.id, Date.now() + 24 * 60 * 60 * 1000)}>Tomorrow</button>
                  <button type="button" className="btn btn-ghost" onClick={() => void snooze(message.id, Date.now() + 7 * 24 * 60 * 60 * 1000)}>Next week</button>
                </div>
              ) : null}
              {message.html_body ? (
                <iframe
                  title="Message body"
                  sandbox=""
                  srcDoc={message.html_body}
                  className="message-frame"
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
        <Suspense fallback={<div className="modal-back"><div className="modal"><p className="muted">Opening composer…</p></div></div>}>
          <Compose
            mailboxes={mailboxes}
            contacts={contacts}
            templates={templates}
            signatures={signatures}
            draft={composeDraft}
            onClose={closeCompose}
            onSent={async (kind) => {
              closeCompose();
              setFolder(kind === "draft" ? "drafts" : kind === "scheduled" ? "scheduled" : "sent");
              await Promise.all([loadList(), refreshBootstrap().catch(() => undefined)]);
            }}
          />
        </Suspense>
      ) : null}
      {helpOpen ? (
        <div className="modal-back" onClick={() => setHelpOpen(false)}>
          <div className="modal shortcuts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="compose-title"><h2>Keyboard shortcuts</h2><button type="button" className="icon-btn" onClick={() => setHelpOpen(false)}>×</button></div>
            <ul className="shortcut-list">
              <li><kbd>c</kbd> Compose</li>
              <li><kbd>r</kbd> Reply</li>
              <li><kbd>e</kbd> Archive</li>
              <li><kbd>s</kbd> Star</li>
              <li><kbd>#</kbd> Trash</li>
              <li><kbd>j</kbd> / <kbd>k</kbd> Next / previous</li>
              <li><kbd>/</kbd> Search</li>
              <li><kbd>⌘</kbd>+<kbd>Enter</kbd> Send</li>
            </ul>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

const MessageRow = memo(function MessageRow({
  row,
  folder,
  active,
  onOpen,
  onStar,
}: {
  row: MailSummary;
  folder: string;
  active: boolean;
  onOpen: () => void;
  onStar: () => void;
}) {
  const who = folder === "sent" || folder === "drafts" || folder === "scheduled" ? row.to_addr || "(no recipient)" : row.from_addr;
  return (
    <div className={`msg-row${active ? " active" : ""}${row.unread ? " unread" : ""}`}>
      <button type="button" className="star-btn" aria-label={row.starred ? "Unstar" : "Star"} onClick={(e) => { e.stopPropagation(); onStar(); }}>{row.starred ? "★" : "☆"}</button>
      <button type="button" className="msg-row-main" onClick={onOpen}>
        <span className="mail-avatar" aria-hidden>{initials(who)}</span>
        <div className="msg-meta">
          <span>{senderName(who)}</span>
          <span>{fmtDate(row.date_ms)}</span>
        </div>
        <div className="mail-summary">
          <div className="subj">{row.subject || "(no subject)"}</div>
          <span className="message-chip">{row.has_attachments ? "Attachment" : row.folder === "drafts" ? "Draft" : "Message"}</span>
        </div>
        {row.snippet ? <div className="preview">{row.snippet}</div> : null}
      </button>
    </div>
  );
});
