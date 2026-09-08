import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import {
  api,
  getClerkToken,
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
import { waitForClerkToken } from "../lib/clerk";
import { go } from "../lib/nav";
import AppShell from "../components/AppShell";
import CommandPalette from "../components/CommandPalette";
import MailFolderRail from "../components/MailFolderRail";
import PwaInstallPrompt from "../components/PwaInstallPrompt";
import ProjectWizard from "../components/ProjectWizard";
import MessageReader from "../components/MessageReader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { FOLDERS } from "../lib/mailFolders";
import type { ComposeDraft } from "./Compose";
import { Search, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

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
  const clerk = useClerk();
  const { isLoaded: authLoaded, isSignedIn, getToken } = useAuth();
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
  const [domainFilter, setDomainFilter] = useState("");
  const [domainUnread, setDomainUnread] = useState<Record<string, number>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [undoToast, setUndoToast] = useState<{ id: string; seconds: number } | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
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
  const [thread, setThread] = useState<MailSummary[]>([]);
  const [notifyBrowser, setNotifyBrowser] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const lastUnreadRef = useRef<number | null>(null);
  const countsBusyRef = useRef(false);
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
    setDomainUnread(data.domain_unread ?? {});
    lastUnreadRef.current = data.counts.inbox?.unread ?? 0;
    setContacts(data.contacts);
    setTemplates(data.templates);
    setSignatures(data.signatures);
    setNotifyBrowser(Boolean(data.settings.notify_browser));
    const domains = await api.domains().catch(() => ({ domains: [] as import("../lib/api").Domain[] }));
    setDomains(domains.domains);
    void api.labels().then((r) => setLabels(r.labels)).catch((ex) => {
      setErr(ex instanceof Error ? ex.message : "Could not load labels. Apply migration 0014 if this persists.");
    });
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
    if (!authLoaded) return;
    if (!isSignedIn) {
      go("/login");
      return;
    }
    let cancelled = false;
    void (async () => {
      const token = await waitForClerkToken(() => getToken());
      if (cancelled) return;
      if (!token) {
        go("/login");
        return;
      }
      try {
        await refreshBootstrap();
      } catch {
        if (!cancelled) go("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoaded, isSignedIn, getToken, refreshBootstrap]);

  const loadList = useCallback(async (signal?: AbortSignal) => {
    setErr("");
    try {
      const data =
        qDebounced.length >= 2
          ? await api.search(qDebounced, signal)
          : folder === "needs-you"
            ? await api.needsYou()
            : await api.mail(folder, mailbox || undefined, signal, domainFilter || undefined);
      if (signal?.aborted) return;
      setList(data.messages);
    } catch (ex) {
      if (ex instanceof DOMException && ex.name === "AbortError") return;
      setErr(ex instanceof Error ? ex.message : "Could not load mail.");
    } finally {
      if (!signal?.aborted) setLoadingList(false);
    }
  }, [folder, mailbox, domainFilter, qDebounced]);

  useEffect(() => {
    const ac = new AbortController();
    setLoadingList(true);
    void loadList(ac.signal);
    return () => ac.abort();
  }, [loadList]);

  /** Badge refresh (focus/visibility + mail actions + WebSocket events). */
  const refreshCounts = useCallback(async (opts?: { reloadListOnNew?: boolean; skipToast?: boolean }) => {
    if (countsBusyRef.current) return;
    countsBusyRef.current = true;
    try {
      const d = await api.counts();
      const inboxUnread = d.counts.inbox?.unread ?? 0;
      const prev = lastUnreadRef.current ?? 0;
      if (!opts?.skipToast && lastUnreadRef.current !== null && inboxUnread > prev) {
        const added = inboxUnread - prev;
        setToast({
          title: added === 1 ? "New email" : `${added} new emails`,
          body: "Your inbox was updated.",
        });
        if (opts?.reloadListOnNew !== false && folder === "inbox" && qDebounced.length < 2) {
          void loadList();
        }
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
      if (d.domain_unread) setDomainUnread(d.domain_unread);
    } catch {
      /* ignore transient count failures */
    } finally {
      countsBusyRef.current = false;
    }
  }, [folder, loadList, notifyBrowser, qDebounced.length]);

  const refreshCountsRef = useRef(refreshCounts);
  refreshCountsRef.current = refreshCounts;
  const loadListRef = useRef(loadList);
  loadListRef.current = loadList;
  const folderRef = useRef(folder);
  folderRef.current = folder;
  const qDebouncedRef = useRef(qDebounced);
  qDebouncedRef.current = qDebounced;
  const notifyBrowserRef = useRef(notifyBrowser);
  notifyBrowserRef.current = notifyBrowser;

  useEffect(() => {
    if (!selected) {
      setMessage(null);
      setAtts([]);
      setThread([]);
      setNoteDraft("");
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
    setNoteDraft("");
    api.message(selected, ac.signal)
      .then(async (d) => {
        const wasUnread = d.message.unread;
        setMessage(d.message);
        setAtts(d.attachments);
        setList((prev) => prev.map((m) => (m.id === selected ? { ...m, unread: 0 } : m)));
        if (wasUnread) void refreshCountsRef.current({ reloadListOnNew: false });
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
    if (!composeOpen) return;
    const params = new URLSearchParams(window.location.search);
    const to = params.get("to");
    const subject = params.get("subject");
    if (!to && !subject) return;
    setComposeDraft({
      to: to || "",
      subject: subject || "",
      mode: "new",
    });
    setShowCompose(true);
  }, [composeOpen]);

  // Counts: refetch on tab focus / visibility (light safety net). Primary path is WebSocket events.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshCounts();
    };
    const onFocus = () => {
      if (document.visibilityState === "visible") void refreshCounts();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshCounts]);

  // Durable Object WebSocket hibernation: immediate toast + list/counts on mail.received.
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retryMs = 1_000;
    let retryTimer: number | undefined;

    const onMailReceived = (raw: unknown) => {
      retryMs = 1_000;
      let title = "New email";
      let body = "Your inbox was updated.";
      try {
        const data = (typeof raw === "string" ? JSON.parse(raw) : raw) as {
          type?: string;
          message?: { subject?: string; from?: string; folder?: string };
        };
        if (data.type && data.type !== "mail.received") return;
        const subject = (data.message?.subject || "").trim();
        const from = (data.message?.from || "").trim();
        if (subject) body = subject;
        else if (from) body = `From ${from}`;
      } catch {
        /* keep defaults */
      }
      setToast({ title, body });
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("Flap", { body, tag: "flap-mail" });
        } catch {
          /* ignore */
        }
      } else if (
        notifyBrowserRef.current &&
        typeof Notification !== "undefined" &&
        Notification.permission === "default"
      ) {
        void Notification.requestPermission();
      }
      void refreshCountsRef.current({ reloadListOnNew: false, skipToast: true });
      if (folderRef.current === "inbox" && qDebouncedRef.current.length < 2) {
        void loadListRef.current();
      }
    };

    const connect = async () => {
      if (closed) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const token = await getClerkToken();
      const qs = token ? `?__clerk_token=${encodeURIComponent(token)}` : "";
      ws = new WebSocket(`${proto}//${window.location.host}/api/events/ws${qs}`);
      ws.onopen = () => {
        retryMs = 1_000;
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data || "{}")) as { type?: string };
          if (data.type === "pong") {
            retryMs = 1_000;
            return;
          }
          if (data.type === "mail.received") onMailReceived(data);
        } catch {
          /* ignore malformed */
        }
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        ws = null;
        if (closed) return;
        retryTimer = window.setTimeout(() => {
          retryMs = Math.min(retryMs * 2, 30_000);
          void connect();
        }, retryMs);
      };
    };

    void connect();
    return () => {
      closed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      try {
        ws?.close(1000, "unmount");
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const title = useMemo(() => FOLDERS.find((f) => f.id === folder)?.label ?? "Inbox", [folder]);
  const visibleList = useMemo(
    () => (unreadOnly ? list.filter((m) => m.unread) : list),
    [list, unreadOnly],
  );
  const headerCount = useMemo(() => {
    if (qDebounced || mailbox || domainFilter || unreadOnly) return visibleList.length;
    const badge = counts[folder];
    if (!badge) return visibleList.length;
    // Same number the folder rail shows for this folder (deduped server counts).
    if (folder === "inbox" || folder === "drafts" || folder === "scheduled") {
      return badge.unread || badge.total || visibleList.length;
    }
    return badge.total || visibleList.length;
  }, [counts, domainFilter, folder, mailbox, qDebounced, unreadOnly, visibleList.length]);

  function selectFolder(id: string) {
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
  }

  function selectDomain(id: string) {
    setDomainFilter(id);
    setMailbox("");
    setSelected(null);
  }

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
      setToast({ title: label, body: value });
    } catch {
      setErr("Could not copy.");
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
    if (selected === id) setSelected(null);
    await Promise.all([loadList(), refreshBootstrap().catch(() => undefined)]);
  }

  async function logout() {
    await clerk.signOut({ redirectUrl: "/" });
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

  function replyFromAddress(msg: MailFull): string | undefined {
    const mb = mailboxes.find((m) => m.id === msg.mailbox_id);
    if (mb?.address) return mb.address;
    const to = extractEmail(msg.to_addr);
    if (to && mailboxes.some((m) => m.address === to)) return to;
    return to || undefined;
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
      from: replyFromAddress(message),
      mode: "reply",
    });
  }

  function forward() {
    if (!message) return;
    openCompose({
      subject: message.subject.toLowerCase().startsWith("fwd:") ? message.subject : `Fwd: ${message.subject || "(no subject)"}`,
      html: quoteHtml(message.from_addr, message.date_ms, message.html_body, message.text_body),
      from: replyFromAddress(message),
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
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          setPaletteOpen((v) => !v);
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
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
      if (event.key === "l") {
        event.preventDefault();
        document.getElementById("message-label-select")?.focus();
      }
      if (event.key === "u") {
        event.preventDefault();
        void api.flags(ctx.message.id, { unread: true }).then(() => {
          setList((prev) => prev.map((item) => (item.id === ctx.message!.id ? { ...item, unread: 1 } : item)));
          setMessage((prev) => (prev ? { ...prev, unread: 1 } : prev));
          void refreshCountsRef.current({ reloadListOnNew: false });
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const editingDraft = showCompose && composeDraft?.mode === "draft";
  const composeInPane = editingDraft || openingDraft;
  const filteredDomain = domainFilter ? domains.find((d) => d.id === domainFilter) : undefined;

  return (
    <AppShell
      email={email}
      counts={counts}
      current="mail"
      onCompose={() => {
        void import("./Compose");
        openCompose();
      }}
      onLogout={() => void logout()}
    >
      <div className="mail-main">
        {needsSetup && folder === "inbox" && !qDebounced ? (
          <div className="onboarding-banner inbox-onboarding" role="status">
            <div>
              <strong>Finish setup to receive mail</strong>
              <p>Add your domain and create a mailbox under Domains, then publish the SES DNS records Flap shows at your DNS host.</p>
            </div>
            <Button type="button" onClick={() => go("/app/domains?onboarding=1")}>
              Open setup checklist
            </Button>
          </div>
        ) : null}
        {domainSetupPending && !needsSetup && folder === "inbox" && !qDebounced ? (
          <div className="onboarding-banner inbox-onboarding" role="status">
            <div>
              <strong>Your mailboxes are ready. Finish domain verification to receive mail.</strong>
              <p>Publish SES verification, DKIM, and MX records, then click Check setup.</p>
            </div>
            <Button type="button" onClick={() => go("/app/domains?onboarding=1")}>
              Finish setup
            </Button>
          </div>
        ) : null}
      <div className="workspace">
        <MailFolderRail
          folder={folder}
          counts={counts}
          domains={domains}
          domainUnread={domainUnread}
          domainFilter={domainFilter}
          onFolder={selectFolder}
          onDomainFilter={selectDomain}
          onCompose={() => {
            void import("./Compose");
            openCompose();
          }}
        />
        <section className={`list-pane${message || composeInPane ? " has-selection" : ""}`}>
          <div className="list-head">
            <div className="list-title-row">
              <div>
                <span className="eyebrow"><span className="live-dot" aria-hidden />{qDebounced ? "Search results" : "Mailbox"}</span>
                <h2>{qDebounced ? `Results for “${qDebounced}”` : title}</h2>
              </div>
              <Badge variant="secondary" className="mail-count border-[var(--line-strong)] font-mono text-xs">
                {loadingList ? "…" : headerCount}
              </Badge>
            </div>
            <div className="list-controls">
              <div className="list-search relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
                  aria-hidden
                />
                <Input
                  id="mail-search"
                  className="h-10 !pl-10"
                  placeholder="Search mail"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search mail"
                />
              </div>
              {!qDebounced ? (
                <>
                  <div className="list-toolbar list-toolbar-desktop flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={unreadOnly ? "default" : "outline"}
                      onClick={() => setUnreadOnly((v) => !v)}
                    >
                      {unreadOnly ? "Showing unread" : "Unread only"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void markFolderRead()}>
                      Mark all read
                    </Button>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="list-toolbar-more"
                        aria-label="List filters"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onSelect={() => setUnreadOnly((v) => !v)}
                      >
                        {unreadOnly ? "Show all mail" : "Unread only"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void markFolderRead()}>
                        Mark all read
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : null}
            </div>
            {mailboxes.length > 1 ? (
              <select
                className="mailbox-filter h-10 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm"
                value={mailbox}
                onChange={(e) => {
                  setMailbox(e.target.value);
                  if (e.target.value) setDomainFilter("");
                }}
                aria-label="Mailbox"
              >
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
            ) : visibleList.length === 0 ? (
              <div className="empty-panel">
                <strong>
                  {qDebounced
                    ? "No matches"
                    : unreadOnly
                      ? "No unread mail"
                      : filteredDomain
                        ? `No mail on ${filteredDomain.name} yet`
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
                      : filteredDomain
                        ? "Send a test message to confirm receiving, or finish domain setup."
                        : needsSetup
                          ? "Open the setup checklist to add a domain and address — then new mail for your domain will land here."
                          : domainSetupPending
                            ? "Your mailboxes are ready. Finish domain verification to receive mail."
                            : EMPTY[folder]}
                </p>
                {(filteredDomain || needsSetup || domainSetupPending) && !qDebounced && !unreadOnly ? (
                  <Button type="button" className="mt-3" onClick={() => go("/app/domains?onboarding=1")}>
                    {filteredDomain ? "Send a test →" : domainSetupPending ? "Finish setup" : "Start setup"}
                  </Button>
                ) : null}
              </div>
            ) : (
              visibleList.map((m) => {
                const mb = mailboxes.find((item) => item.id === m.mailbox_id);
                const domain = domains.find((d) => d.id === mb?.domain_id);
                const via = domain?.name || mb?.address || undefined;
                return (
                <MessageRow
                  key={m.id}
                  row={m}
                  folder={folder}
                  domainColor={domain?.color || undefined}
                  via={via}
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
              {(() => {
                const mb = mailboxes.find((item) => item.id === message.mailbox_id);
                const domain = domains.find((d) => d.id === mb?.domain_id);
                return (
                  <MessageReader
                    message={message}
                    folder={folder}
                    attachments={atts}
                    thread={thread}
                    labels={labels}
                    notes={notes}
                    noteDraft={noteDraft}
                    onNoteDraftChange={setNoteDraft}
                    domainName={domain?.name || mb?.address}
                    domainColor={domain?.color || undefined}
                    teamsUnlocked={teamsUnlocked}
                    teamMembers={teamMembers}
                    onSelectThread={setSelected}
                    onReply={reply}
                    onForward={forward}
                    onArchive={() => void move(message.id, "archive")}
                    onToggleStar={() => void toggleStar(message)}
                    onMarkUnread={() => {
                      void api.flags(message.id, { unread: true }).then(() => {
                        setList((prev) => prev.map((item) => (item.id === message.id ? { ...item, unread: 1 } : item)));
                        setMessage({ ...message, unread: 1 });
                        void refreshCounts({ reloadListOnNew: false });
                      });
                    }}
                    onSnooze={(until) => void snooze(message.id, until)}
                    onSpam={() => void move(message.id, "spam")}
                    onDelete={() => void discardMail(message.id, folder)}
                    onMoveInbox={() => void move(message.id, "inbox")}
                    onBlockSender={() => {
                      void api.block(extractEmail(message.from_addr)).then(() => move(message.id, "spam"));
                    }}
                    onCopySender={() => {
                      void copyText(extractEmail(message.from_addr) || message.from_addr, "Sender copied");
                    }}
                    onPrint={() => {
                      const frame = document.querySelector<HTMLIFrameElement>(".message-frame");
                      if (frame?.contentWindow) frame.contentWindow.print();
                      else window.print();
                    }}
                    onApplyLabel={(name) => {
                      void api.addMessageLabel(message.id, { name }).then((r) => {
                        setMessage({ ...message, label: r.name });
                        setList((prev) => prev.map((item) => (item.id === message.id ? { ...item, label: r.name } : item)));
                        return api.labels().then((l) => setLabels(l.labels));
                      }).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not label."));
                    }}
                    onClearLabel={() => {
                      void api.clearMessageLabel(message.id).then(() => {
                        setMessage({ ...message, label: "" });
                        setList((prev) => prev.map((item) => (item.id === message.id ? { ...item, label: "" } : item)));
                      }).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not clear label."));
                    }}
                    onAssign={(user_id) => {
                      void api.assignMessage(message.id, user_id).then(() => {
                        setMessage({ ...message, assignee_user_id: user_id });
                      }).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not assign."));
                    }}
                    onWorkflow={(status) => {
                      void api.setWorkflowStatus(message.id, status).then(() => {
                        setMessage({ ...message, workflow_status: status });
                        setList((prev) =>
                          prev.map((item) => (item.id === message.id ? { ...item, workflow_status: status } : item)),
                        );
                      }).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not update status."));
                    }}
                    onAddNote={() => {
                      if (!noteDraft.trim()) return;
                      void api.addMessageNote(message.id, noteDraft.trim()).then((r) => {
                        setNotes((prev) => [...prev, r.note]);
                        setNoteDraft("");
                      }).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not add note."));
                    }}
                    onOpenBilling={() => go("/app/billing")}
                  />
                );
              })()}
            </>
          )}
        </section>
      </div>
      </div>

      {toast ? (
        <div className="mail-toast" role="status" aria-live="polite">
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
          <button type="button" className="mail-toast-close" aria-label="Close notification" onClick={() => setToast(null)}>×</button>
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
        <div className="mail-toast" role="status" aria-live="polite">
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
                return Promise.all([loadList(), refreshCounts({ reloadListOnNew: false })]);
              }).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not undo."));
            }}
          >
            Undo
          </button>
          <button type="button" className="mail-toast-close" aria-label="Close notification" onClick={() => setUndoToast(null)}>×</button>
        </div>
      ) : null}
      {helpOpen ? (
        <div className="modal-back" onClick={() => setHelpOpen(false)}>
          <div className="modal shortcuts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="compose-title"><h2>Keyboard shortcuts</h2><button type="button" className="icon-btn" onClick={() => setHelpOpen(false)} aria-label="Close">×</button></div>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Press <kbd>?</kbd> anytime in the inbox. Shortcuts ignore focused inputs.</p>
            <ul className="shortcut-list">
              <li><kbd>?</kbd> This help</li>
              <li><kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd> Command palette</li>
              <li><kbd>c</kbd> Compose</li>
              <li><kbd>r</kbd> Reply</li>
              <li><kbd>f</kbd> Forward</li>
              <li><kbd>e</kbd> Archive</li>
              <li><kbd>s</kbd> Star</li>
              <li><kbd>l</kbd> Label</li>
              <li><kbd>u</kbd> Mark unread</li>
              <li><kbd>#</kbd> / <kbd>Delete</kbd> Delete (Trash, or remove draft)</li>
              <li><kbd>j</kbd> / <kbd>k</kbd> Next / previous</li>
              <li><kbd>/</kbd> Search</li>
              <li><kbd>⌘</kbd>+<kbd>Enter</kbd> Send (in compose)</li>
            </ul>
          </div>
        </div>
      ) : null}
      <PwaInstallPrompt ready={domains.length > 0} />
      <ProjectWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        domains={domains}
        onCompose={() => {
          void import("./Compose");
          openCompose();
        }}
        onFolder={selectFolder}
        onDomain={(id) => {
          selectDomain(id);
          setFolder("inbox");
          go("/app");
        }}
        onSearchFocus={() => document.getElementById("mail-search")?.focus()}
        onSettings={(tab) => {
          if (tab === "setup") go("/app/domains");
          else if (tab === "billing") go("/app/billing");
          else if (tab === "developers" || tab === "developer") go("/app/developer");
          else if (tab === "contacts") go("/app/contacts");
          else go(tab ? `/app/settings?tab=${encodeURIComponent(tab)}` : "/app/settings");
        }}
      />
    </AppShell>
  );
}

const MessageRow = memo(function MessageRow({
  row,
  folder,
  domainColor,
  via,
  active,
  onOpen,
  onStar,
  onDelete,
}: {
  row: MailSummary;
  folder: string;
  domainColor?: string;
  via?: string;
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
        <div className="msg-row-copy">
          <div className="msg-meta">
            <span className="msg-sender-block">
              <span>{senderName(who)}</span>
              {via ? (
                <span className="msg-via">
                  <span className="domain-swatch msg-via-chip" aria-hidden style={domainColor ? { background: domainColor } : undefined} />
                  via {via}
                </span>
              ) : null}
            </span>
            <span>{fmtDate(row.date_ms)}</span>
          </div>
          <div className="mail-summary">
            <div className="subj">{row.subject || "(no subject)"}</div>
            {row.label ? <span className="message-chip chip-label">{row.label}</span> : null}
            {!row.label && row.has_attachments ? <span className="message-chip">Attachment</span> : null}
            {!row.label && !row.has_attachments && row.folder === "drafts" ? <span className="message-chip">Draft</span> : null}
          </div>
          {row.snippet ? <div className="preview">{row.snippet}</div> : null}
        </div>
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
