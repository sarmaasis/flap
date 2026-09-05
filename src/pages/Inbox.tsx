import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  api,
  type Attachment,
  type Contact,
  type Domain,
  type FolderCounts,
  type Label,
  type MailFull,
  type MailSummary,
  type Mailbox,
  type MessageNote,
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
  drafts: "No drafts yet. Flap saves them as you write — click a draft to open it in the composer.",
  scheduled: "No messages waiting to send. Click one to edit it in the composer.",
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
  const [domains, setDomains] = useState<Domain[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [notes, setNotes] = useState<MessageNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [teamMembers, setTeamMembers] = useState<Array<{ user_id: string; email: string }>>([]);
  const [teamsUnlocked, setTeamsUnlocked] = useState(false);
  const [mailbox, setMailbox] = useState("");
  const [undoToast, setUndoToast] = useState<{ id: string; seconds: number } | null>(null);
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
  const [thread, setThread] = useState<MailSummary[]>([]);
  const [notifyBrowser, setNotifyBrowser] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [copyNotice, setCopyNotice] = useState("");
  const lastUnreadRef = useRef<number | null>(null);
  const pollBusyRef = useRef(false);
  /** When true, selected id is for draft/scheduled compose — do not load the reader. */
  const openInComposeRef = useRef(false);
  const [openingDraft, setOpeningDraft] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [domainSetupPending, setDomainSetupPending] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 280);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!undoToast) return;
    if (undoToast.seconds <= 0) {
      setUndoToast(null);
      return;
    }
    const t = window.setTimeout(() => {
      setUndoToast((prev) => (prev && prev.id === undoToast.id ? { ...prev, seconds: prev.seconds - 1 } : prev));
    }, 1000);
    return () => window.clearTimeout(t);
  }, [undoToast]);

  const refreshBootstrap = useCallback(async () => {
    const data = await api.bootstrap();
    setEmail(data.user.email);
    setMailboxes(data.mailboxes);
    setCounts(data.counts);
    setContacts(data.contacts);
    setTemplates(data.templates);
    setSignatures(data.signatures);
    setNotifyBrowser(Boolean(data.settings.notify_browser));
    const domains = await api.domains().catch(() => ({ domains: [] as import("../lib/api").Domain[] }));
    setDomains(domains.domains);
    void api.labels().then((r) => setLabels(r.labels)).catch(() => undefined);
    void api.team().then((t) => {
      setTeamsUnlocked(Boolean(t.teams_unlocked));
      setTeamMembers((t.members || []).map((m) => ({ user_id: m.user_id, email: m.email })));
    }).catch(() => undefined);
    if (data.mailboxes.length === 0) {
      setNeedsSetup(true);
      setDomainSetupPending(false);
    } else {
      setNeedsSetup(false);
      const pending = domains.domains.some((d) => !d.receiving_ready_at);
      setDomainSetupPending(pending);
    }
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
      setThread([]);
      return;
    }
    // Drafts/scheduled open in the composer pane by design — skip the message reader.
    if (openInComposeRef.current) {
      setMessage(null);
      setAtts([]);
      setThread([]);
      setLoadingMessage(false);
      return;
    }
    const ac = new AbortController();
    setLoadingMessage(true);
    api.message(selected, ac.signal)
      .then(async (d) => {
        setMessage(d.message);
        setAtts(d.attachments);
        setList((prev) => prev.map((m) => (m.id === selected ? { ...m, unread: 0 } : m)));
        void api.messageNotes(selected).then((n) => { if (!ac.signal.aborted) setNotes(n.notes); }).catch(() => setNotes([]));
        try {
          const t = await api.thread(selected, ac.signal);
          if (!ac.signal.aborted) setThread(t.messages);
        } catch {
          if (!ac.signal.aborted) setThread([]);
        }
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
    const poll = () => {
      if (pollBusyRef.current || document.visibilityState === "hidden") return;
      pollBusyRef.current = true;
      void api.counts()
        .then((d) => {
          const inboxUnread = d.counts.inbox?.unread ?? 0;
          const prev = lastUnreadRef.current ?? counts.inbox?.unread ?? 0;
          if (lastUnreadRef.current !== null && inboxUnread > prev) {
            const added = inboxUnread - prev;
            setToast({
              title: added === 1 ? "New email" : `${added} new emails`,
              body: "Your inbox was updated.",
            });
            if (folder === "inbox" && qDebounced.length < 2) void loadList();
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              try {
                new Notification("Flap", {
                  body: added === 1 ? "You have a new message." : `You have ${added} new messages.`,
                  tag: "flap-mail",
                });
              } catch {
                /* ignore */
              }
            } else if (notifyBrowser && typeof Notification !== "undefined" && Notification.permission === "default") {
              void Notification.requestPermission();
            }
          }
          lastUnreadRef.current = inboxUnread;
          setCounts(d.counts);
        })
        .catch(() => undefined)
        .finally(() => {
          pollBusyRef.current = false;
        });
    };
    const id = window.setInterval(poll, 3500);
    const onVis = () => {
      if (document.visibilityState === "visible") poll();
    };
    const onFocus = () => poll();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [counts.inbox?.unread, folder, loadList, notifyBrowser, qDebounced.length]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!copyNotice) return;
    const t = window.setTimeout(() => setCopyNotice(""), 1800);
    return () => window.clearTimeout(t);
  }, [copyNotice]);

  const title = useMemo(() => FOLDERS.find((f) => f.id === folder)?.label ?? "Inbox", [folder]);
  const visibleList = useMemo(
    () => (unreadOnly ? list.filter((m) => m.unread) : list),
    [list, unreadOnly],
  );

  async function markFolderRead() {
    try {
      await api.markFolderRead(folder, mailbox || undefined);
      setList((prev) => prev.map((m) => ({ ...m, unread: 0 })));
      if (message) setMessage({ ...message, unread: 0 });
      await refreshBootstrap().catch(() => undefined);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not mark as read.");
    }
  }

  async function copyText(value: string, label = "Copied") {
    try {
      await navigator.clipboard.writeText(value);
      setCopyNotice(label);
    } catch {
      setCopyNotice("Could not copy");
    }
  }

  const openCompose = useCallback((draft?: ComposeDraft) => {
    // New / reply / forward use the modal — clear any drafts-folder reader selection.
    if (!draft || draft.mode !== "draft") {
      if (openInComposeRef.current) {
        openInComposeRef.current = false;
        setSelected(null);
      }
      setOpeningDraft(false);
    }
    setComposeDraft(draft ?? null);
    setShowCompose(true);
    if (window.location.pathname !== "/app/compose") window.history.replaceState({}, "", "/app/compose");
  }, []);

  const closeCompose = useCallback(() => {
    const wasDraftCompose = composeDraft?.mode === "draft";
    setShowCompose(false);
    setComposeDraft(null);
    setOpeningDraft(false);
    if (wasDraftCompose) {
      openInComposeRef.current = false;
      setSelected(null);
    }
    go("/app");
  }, [composeDraft?.mode]);

  async function move(id: string, dest: string) {
    await api.move(id, dest);
    if (selected === id) setSelected(null);
    await Promise.all([loadList(), refreshBootstrap().catch(() => undefined)]);
  }

  /** Drafts/scheduled → permanent delete; Trash → permanent delete; otherwise move to Trash. */
  async function discardMail(id: string, rowFolder?: string) {
    const source = rowFolder || folder;
    const permanent = source === "drafts" || source === "scheduled" || source === "trash";
    if (permanent) {
      const label =
        source === "drafts" ? "Delete this draft permanently?"
          : source === "scheduled" ? "Delete this scheduled message permanently?"
            : "Delete forever? This cannot be undone.";
      if (!window.confirm(label)) return;
      await api.remove(id);
    } else {
      await api.move(id, "trash");
    }
    if (selected === id || composeDraft?.id === id) {
      openInComposeRef.current = false;
      setOpeningDraft(false);
      setSelected(null);
      setMessage(null);
      if (composeDraft?.id === id) {
        setShowCompose(false);
        setComposeDraft(null);
      }
    }
    setErr("");
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
    // Drafts & scheduled: open in the reader-pane composer (not the message reader).
    if (row.folder === "drafts" || row.folder === "scheduled" || folder === "drafts" || folder === "scheduled") {
      openInComposeRef.current = true;
      setSelected(row.id);
      setMessage(null);
      setAtts([]);
      setThread([]);
      setOpeningDraft(true);
      setErr("");
      void api.message(row.id)
        .then((d) => {
          openCompose({
            id: d.message.id,
            to: d.message.to_addr,
            cc: d.message.cc_addr,
            bcc: d.message.bcc_addr,
            subject: d.message.subject,
            html: d.message.html_body || (d.message.text_body ? `<p>${d.message.text_body}</p>` : ""),
            from: extractEmail(d.message.from_addr),
            mode: "draft",
          });
        })
        .catch((ex: unknown) => {
          setErr(ex instanceof Error ? ex.message : "Could not open draft.");
          openInComposeRef.current = false;
          setSelected(null);
        })
        .finally(() => setOpeningDraft(false));
      return;
    }
    openInComposeRef.current = false;
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

  const keyCtx = useRef({
    list,
    selected,
    message,
    showCompose,
    composeDraft,
    folder,
    openCompose,
    reply,
    forward: () => undefined as void,
    move,
    discardMail,
    toggleStar,
    onRowClick,
  });
  keyCtx.current = {
    list: visibleList,
    selected,
    message,
    showCompose,
    composeDraft,
    folder,
    openCompose,
    reply,
    move,
    discardMail,
    toggleStar,
    onRowClick,
    forward,
  };
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      const ctx = keyCtx.current;
      const editingSavedDraft = Boolean(ctx.showCompose && ctx.composeDraft?.mode === "draft" && ctx.composeDraft?.id);
      const deleteKey = event.key === "#" || event.key === "Delete" || event.key === "Backspace";

      if (deleteKey) {
        const id = (editingSavedDraft ? ctx.composeDraft?.id : null) || ctx.selected || ctx.message?.id;
        if (!id) return;
        if (ctx.showCompose && !editingSavedDraft) return;
        event.preventDefault();
        const row = ctx.list.find((item) => item.id === id);
        void ctx.discardMail(id, row?.folder);
        return;
      }

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
      if (event.key === "f") { event.preventDefault(); ctx.forward(); }
      if (event.key === "e") { event.preventDefault(); void ctx.move(ctx.message.id, "archive"); }
      if (event.key === "s") { event.preventDefault(); void ctx.toggleStar(ctx.message); }
      if (event.key === "u") {
        event.preventDefault();
        void api.flags(ctx.message.id, { unread: true }).then(() => {
          setList((prev) => prev.map((item) => (item.id === ctx.message!.id ? { ...item, unread: 1 } : item)));
          setMessage((prev) => (prev ? { ...prev, unread: 1 } : prev));
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const editingDraft = showCompose && composeDraft?.mode === "draft";
  const composeInPane = editingDraft || openingDraft;

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
        openInComposeRef.current = false;
        setOpeningDraft(false);
        if (showCompose && composeDraft?.mode === "draft") {
          setShowCompose(false);
          setComposeDraft(null);
        }
        setQ("");
        setQDebounced("");
        go("/app");
      }}
      onLogout={() => void logout()}
    >
      <div className="mail-main">
        {needsSetup && folder === "inbox" && !qDebounced ? (
          <div className="onboarding-banner inbox-onboarding" role="status">
            <div>
              <strong>Finish setup to receive mail</strong>
              <p>Add your domain and create a mailbox in Settings, then publish the SES DNS records Flap shows at your DNS host.</p>
            </div>
            <button type="button" className="btn" onClick={() => go("/app/settings?tab=setup&onboarding=1")}>
              Open setup checklist
            </button>
          </div>
        ) : null}
        {domainSetupPending && !needsSetup && folder === "inbox" && !qDebounced ? (
          <div className="onboarding-banner inbox-onboarding" role="status">
            <div>
              <strong>Your mailboxes are ready. Finish domain verification to receive mail.</strong>
              <p>Publish SES verification, DKIM, and MX records, then click Check setup.</p>
            </div>
            <button type="button" className="btn" onClick={() => go("/app/settings?tab=setup&onboarding=1")}>
              Finish setup
            </button>
          </div>
        ) : null}
      <div className="workspace">
        <section className={`list-pane${message || composeInPane ? " has-selection" : ""}`}>
          <div className="list-head">
            <div className="list-title-row">
              <div>
                <span className="eyebrow"><span className="live-dot" aria-hidden />{qDebounced ? "Search results" : "Mailbox"}</span>
                <h2>{qDebounced ? `Results for “${qDebounced}”` : title}</h2>
              </div>
              <span className="mail-count">{loadingList ? "…" : visibleList.length}</span>
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
            {!qDebounced ? (
              <div className="list-toolbar">
                <button
                  type="button"
                  className={`btn${unreadOnly ? " active" : ""}`}
                  onClick={() => setUnreadOnly((v) => !v)}
                >
                  {unreadOnly ? "Showing unread" : "Unread only"}
                </button>
                <button type="button" className="btn" onClick={() => void markFolderRead()}>
                  Mark all read
                </button>
              </div>
            ) : null}
          </div>
          {err ? <div className="err" style={{ margin: 12 }}>{err}</div> : null}
          <div className="list-body">
            {loadingList ? (
              <div className="skeleton-stack" aria-hidden>
                <div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" />
              </div>
            ) : visibleList.length === 0 ? (
              <div className="empty-panel">
                <strong>
                  {qDebounced
                    ? "No matches"
                    : unreadOnly
                      ? "No unread mail"
                      : needsSetup
                        ? "No mailbox yet"
                        : domainSetupPending
                          ? "Waiting on domain setup"
                          : `No ${title.toLowerCase()} yet`}
                </strong>
                <p>
                  {qDebounced
                    ? "Try a different name, subject, or phrase."
                    : unreadOnly
                      ? "Everything in this folder is read."
                      : needsSetup
                        ? "Open the setup checklist to add a domain and address — then new mail for your domain will land here."
                        : domainSetupPending
                          ? "Your mailboxes are ready. Finish domain verification to receive mail."
                          : EMPTY[folder]}
                </p>
                {(needsSetup || domainSetupPending) && !qDebounced && !unreadOnly ? (
                  <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => go("/app/settings?tab=setup&onboarding=1")}>
                    {domainSetupPending ? "Finish setup" : "Start setup"}
                  </button>
                ) : null}
              </div>
            ) : (
              visibleList.map((m) => {
                const domain = domains.find((d) => d.id === mailboxes.find((mb) => mb.id === m.mailbox_id)?.domain_id);
                return (
                <MessageRow
                  key={m.id}
                  row={m}
                  folder={folder}
                  domainColor={domain?.color || undefined}
                  active={selected === m.id || composeDraft?.id === m.id}
                  onOpen={() => onRowClick(m)}
                  onStar={() => void toggleStar(m)}
                  onDelete={() => void discardMail(m.id, m.folder || folder)}
                />
                );
              })
            )}
          </div>
        </section>

        <section className={`read-pane${message || composeInPane ? " has-message" : ""}${composeInPane ? " has-compose" : ""}`}>
          {composeInPane ? (
            <>
              <button
                type="button"
                className="mobile-back"
                onClick={() => {
                  if (showCompose) closeCompose();
                  else {
                    setOpeningDraft(false);
                    openInComposeRef.current = false;
                    setSelected(null);
                  }
                }}
              >
                Back to {title}
              </button>
              {openingDraft && !editingDraft ? (
                <div className="empty-panel"><p className="muted">Opening draft…</p></div>
              ) : (
                <Suspense fallback={<div className="empty-panel"><p className="muted">Opening composer…</p></div>}>
                  <Compose
                    key={composeDraft?.id ?? "draft"}
                    mailboxes={mailboxes}
                    contacts={contacts}
                    templates={templates}
                    signatures={signatures}
                    draft={composeDraft}
                    variant="pane"
                    onClose={closeCompose}
                    onDiscard={composeDraft?.id ? () => void discardMail(composeDraft.id!, folder) : undefined}
                    onSent={async (kind, meta) => {
                      closeCompose();
                      if (meta?.undo && meta.id) {
                        setUndoToast({ id: meta.id, seconds: meta.undo_seconds || 10 });
                        setFolder("scheduled");
                      } else {
                        setFolder(kind === "draft" ? "drafts" : kind === "scheduled" ? "scheduled" : "sent");
                      }
                      await Promise.all([loadList(), refreshBootstrap().catch(() => undefined)]);
                    }}
                  />
                </Suspense>
              )}
            </>
          ) : loadingMessage && selected ? (
            <div className="empty-panel"><p className="muted">Opening message…</p></div>
          ) : !message ? (
            <div className="read-empty">
              <div className="empty-panel">
                {folder === "drafts" || folder === "scheduled" ? (
                  <>
                    <strong>{folder === "drafts" ? "Drafts open in compose" : "Scheduled messages open in compose"}</strong>
                    <p>
                      {folder === "drafts"
                        ? "Click a draft in the list to continue writing. Press C for a new message."
                        : "Click a scheduled message to edit it. Press C for a new message."}
                    </p>
                  </>
                ) : (
                  <>
                    <strong>Select a message</strong>
                    <p>Or press C to compose. Press ? for keyboard shortcuts.</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <button type="button" className="mobile-back" onClick={() => setSelected(null)}>Back to {title}</button>
              <article className="read-card">
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
                  <div className="sender-actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => void copyText(extractEmail(message.from_addr) || message.from_addr, "Sender copied")}
                    >
                      Copy sender
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        const frame = document.querySelector<HTMLIFrameElement>(".message-frame");
                        if (frame?.contentWindow) frame.contentWindow.print();
                        else window.print();
                      }}
                    >
                      Print
                    </button>
                  </div>
                </div>
              </div>
              {copyNotice ? <p className="muted" style={{ margin: "8px 0 0" }}>{copyNotice}</p> : null}
              {message.label ? <div className="label-chip">{message.label}</div> : null}
              {thread.length > 1 ? (
                <div className="thread-rail" aria-label="Conversation">
                  <div className="thread-rail-title">Thread · {thread.length}</div>
                  {thread.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`thread-item${item.id === message.id ? " active" : ""}`}
                      onClick={() => setSelected(item.id)}
                    >
                      <span>
                        <strong>{item.subject || "(no subject)"}</strong>
                        {senderName(item.from_addr)}
                      </span>
                      <span>{fmtDate(item.date_ms)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="read-actions">
                <button type="button" className="btn" onClick={() => reply(false)}>Reply</button>
                <button type="button" className="btn btn-ghost" onClick={() => reply(true)}>Reply all</button>
                <button type="button" className="btn btn-ghost" onClick={forward}>Forward</button>
                <button type="button" className="btn btn-ghost" onClick={() => void toggleStar(message)}>{message.starred ? "Unstar" : "Star"}</button>
                <button type="button" className="btn btn-ghost" onClick={() => {
                  void api.flags(message.id, { unread: true }).then(() => {
                    setList((prev) => prev.map((item) => (item.id === message.id ? { ...item, unread: 1 } : item)));
                    setMessage({ ...message, unread: 1 });
                  });
                }}>Mark unread</button>
                <button type="button" className="btn btn-ghost" onClick={() => void move(message.id, "archive")}>Archive</button>
                <button type="button" className="btn btn-ghost" onClick={() => setSnoozeOpen((v) => !v)}>Snooze</button>
                {folder !== "spam" ? <button type="button" className="btn btn-ghost" onClick={() => void move(message.id, "spam")}>Spam</button> : null}
                {folder === "trash" ? (
                  <button type="button" className="btn btn-danger" onClick={() => void discardMail(message.id, folder)}>Delete forever</button>
                ) : (
                  <button type="button" className="btn btn-ghost" onClick={() => void discardMail(message.id, folder)}>Delete</button>
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
              <div className="collab-panel">
                <h3>Organize</h3>
                <div className="list-toolbar" style={{ marginTop: 0 }}>
                  <select
                    aria-label="Add label"
                    defaultValue=""
                    onChange={(e) => {
                      const name = e.target.value;
                      e.target.value = "";
                      if (!name) return;
                      void api.addMessageLabel(message.id, { name }).then((r) => {
                        setMessage({ ...message, label: r.name });
                        setList((prev) => prev.map((item) => (item.id === message.id ? { ...item, label: r.name } : item)));
                        return api.labels().then((l) => setLabels(l.labels));
                      }).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not label."));
                    }}
                  >
                    <option value="">Add label…</option>
                    {labels.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
                    <option value="Follow-up">Follow-up</option>
                    <option value="Customer">Customer</option>
                  </select>
                  {teamsUnlocked ? (
                    <select
                      aria-label="Assign"
                      value={message.assignee_user_id || ""}
                      onChange={(e) => {
                        const user_id = e.target.value || null;
                        void api.assignMessage(message.id, user_id).then(() => {
                          setMessage({ ...message, assignee_user_id: user_id });
                        }).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not assign."));
                      }}
                    >
                      <option value="">Unassigned</option>
                      {teamMembers.map((m) => (
                        <option key={m.user_id} value={m.user_id}>{m.email}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>Assignment on Studio</span>
                  )}
                </div>
                {message.plus_tag ? <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>Plus-tag: +{message.plus_tag}</p> : null}
                <h3 style={{ marginTop: 14 }}>Internal notes</h3>
                {teamsUnlocked ? (
                  <>
                    <ul className="note-list">
                      {notes.map((n) => (
                        <li key={n.id}>
                          <div>{n.body}</div>
                          <div className="muted">{n.author_email || "teammate"} · {new Date(n.created_at).toLocaleString()}</div>
                        </li>
                      ))}
                    </ul>
                    <form
                      className="row-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!noteDraft.trim()) return;
                        void api.addMessageNote(message.id, noteDraft.trim()).then((r) => {
                          setNotes((prev) => [...prev, r.note]);
                          setNoteDraft("");
                        }).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not add note."));
                      }}
                    >
                      <input placeholder="Private note (not emailed)" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
                      <button className="btn" type="submit">Add note</button>
                    </form>
                  </>
                ) : (
                  <p className="muted" style={{ fontSize: 12 }}>Private team notes are on Studio.</p>
                )}
              </div>
              </article>
            </>
          )}
        </section>
      </div>
      </div>

      {toast ? (
        <div className="mail-toast" role="status">
          <div>
            <strong>{toast.title}</strong>
            <span>{toast.body}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setFolder("inbox");
              setUnreadOnly(false);
              setToast(null);
              void loadList();
            }}
          >
            View
          </button>
          <button type="button" className="mail-toast-close" aria-label="Dismiss" onClick={() => setToast(null)}>×</button>
        </div>
      ) : null}

      {showCompose && !editingDraft ? (
        <Suspense fallback={<div className="modal-back"><div className="modal"><p className="muted">Opening composer…</p></div></div>}>
          <Compose
            key={composeDraft?.id ?? composeDraft?.mode ?? "new"}
            mailboxes={mailboxes}
            contacts={contacts}
            templates={templates}
            signatures={signatures}
            draft={composeDraft}
            variant="modal"
            onClose={closeCompose}
            onDiscard={composeDraft?.id && composeDraft.mode === "draft" ? () => void discardMail(composeDraft.id!, "drafts") : undefined}
            onSent={async (kind, meta) => {
              closeCompose();
              if (meta?.undo && meta.id) {
                setUndoToast({ id: meta.id, seconds: meta.undo_seconds || 10 });
                setFolder("scheduled");
              } else {
                setFolder(kind === "draft" ? "drafts" : kind === "scheduled" ? "scheduled" : "sent");
              }
              await Promise.all([loadList(), refreshBootstrap().catch(() => undefined)]);
            }}
          />
        </Suspense>
      ) : null}
      {undoToast ? (
        <div className="mail-toast" role="status">
          <div>
            <strong>Message queued</strong>
            <span>Sending in {undoToast.seconds}s — undo to keep as draft.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const id = undoToast.id;
              setUndoToast(null);
              void api.undoSend(id).then(() => {
                setFolder("drafts");
                return loadList();
              }).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not undo."));
            }}
          >
            Undo
          </button>
          <button type="button" className="mail-toast-close" aria-label="Dismiss" onClick={() => setUndoToast(null)}>×</button>
        </div>
      ) : null}
      {helpOpen ? (
        <div className="modal-back" onClick={() => setHelpOpen(false)}>
          <div className="modal shortcuts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="compose-title"><h2>Keyboard shortcuts</h2><button type="button" className="icon-btn" onClick={() => setHelpOpen(false)} aria-label="Close">×</button></div>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Press <kbd>?</kbd> anytime in the inbox. Shortcuts ignore focused inputs.</p>
            <ul className="shortcut-list">
              <li><kbd>?</kbd> This help</li>
              <li><kbd>c</kbd> Compose</li>
              <li><kbd>r</kbd> Reply</li>
              <li><kbd>f</kbd> Forward</li>
              <li><kbd>e</kbd> Archive</li>
              <li><kbd>s</kbd> Star</li>
              <li><kbd>u</kbd> Mark unread</li>
              <li><kbd>#</kbd> / <kbd>Delete</kbd> Delete (Trash, or remove draft)</li>
              <li><kbd>j</kbd> / <kbd>k</kbd> Next / previous</li>
              <li><kbd>/</kbd> Search</li>
              <li><kbd>⌘</kbd>+<kbd>Enter</kbd> Send (in compose)</li>
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
  domainColor,
  active,
  onOpen,
  onStar,
  onDelete,
}: {
  row: MailSummary;
  folder: string;
  domainColor?: string;
  active: boolean;
  onOpen: () => void;
  onStar: () => void;
  onDelete: () => void;
}) {
  const who = folder === "sent" || folder === "drafts" || folder === "scheduled" ? row.to_addr || "(no recipient)" : row.from_addr;
  const source = row.folder || folder;
  const deleteLabel = source === "drafts" || source === "scheduled"
    ? "Delete"
    : source === "trash"
      ? "Delete forever"
      : "Move to Trash";
  return (
    <div
      className={`msg-row${active ? " active" : ""}${row.unread ? " unread" : ""}`}
      style={domainColor ? ({ ["--domain-color"]: domainColor } as CSSProperties) : undefined}
    >
      <button type="button" className="star-btn" aria-label={row.starred ? "Unstar" : "Star"} onClick={(e) => { e.stopPropagation(); onStar(); }}>{row.starred ? "★" : "☆"}</button>
      <button type="button" className="msg-row-main" onClick={onOpen}>
        <span className="mail-avatar" aria-hidden>{initials(who)}</span>
        <div className="msg-meta">
          <span>{senderName(who)}</span>
          <span>{fmtDate(row.date_ms)}</span>
        </div>
        <div className="mail-summary">
          <div className="subj">{row.subject || "(no subject)"}</div>
          <span className="message-chip">{row.label || (row.has_attachments ? "Attachment" : row.folder === "drafts" ? "Draft" : "Message")}</span>
        </div>
        {row.snippet ? <div className="preview">{row.snippet}</div> : null}
      </button>
      <button
        type="button"
        className="row-delete-btn"
        aria-label={deleteLabel}
        title={deleteLabel}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        ×
      </button>
    </div>
  );
});
