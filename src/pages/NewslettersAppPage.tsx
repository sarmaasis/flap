import { useEffect, useState, useRef } from "react";
import AppFeaturePage, { FeatureEmpty } from "../components/AppFeaturePage";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import RichTextEditor, { type EditorHandle } from "../components/RichTextEditor";
import { api, type NewsletterBlast } from "../lib/api";
import { go } from "../lib/nav";
import { tw } from "../lib/tw";
import { cn } from "../lib/utils";

type Subscriber = { id: string; email: string; name: string; status: string; created_at: number };
type MailboxOpt = { id: string; address: string; display_name: string; domain_id: string };

function toLocalInput(ms: number | null | undefined): string {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function statusVariant(status: string): "default" | "secondary" | "success" | "warn" | "danger" {
  if (status === "sent" || status === "active") return "success";
  if (status === "queued" || status === "scheduled" || status === "pending") return "warn";
  if (status === "failed" || status === "unsubscribed") return "danger";
  return "secondary";
}

function blastLabel(n: NewsletterBlast): string {
  if (n.status === "scheduled" || (n.status === "queued" && n.scheduled_at && n.scheduled_at > Date.now())) {
    return "scheduled";
  }
  return n.status;
}

export default function NewslettersAppPage() {
  const [items, setItems] = useState<NewsletterBlast[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxOpt[]>([]);
  const [limits, setLimits] = useState<{ sends_per_month: number; subscribers: number } | null>(null);
  const [audienceCount, setAudienceCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [planOk, setPlanOk] = useState(true);
  const [signupUrl, setSignupUrl] = useState("");
  const [subject, setSubject] = useState("");
  const [mailboxId, setMailboxId] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subEmail, setSubEmail] = useState("");
  const [subName, setSubName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [showCsv, setShowCsv] = useState(false);
  const [fromName, setFromName] = useState("");
  const [physicalAddress, setPhysicalAddress] = useState("");
  const [publicSlug, setPublicSlug] = useState("");
  const editor = useRef<EditorHandle>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [editorHtml, setEditorHtml] = useState("<p></p>");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);

  async function load() {
    try {
      const [res, subs] = await Promise.all([
        api.newsletters(),
        api.newsletterSubscribers().catch(() => ({ subscribers: [] as Subscriber[] })),
      ]);
      setItems(res.items || []);
      setLimits(res.caps || null);
      setAudienceCount(res.audience_count ?? 0);
      setPendingCount(res.pending_count ?? 0);
      setPlanOk(res.plan_ok !== false);
      setSignupUrl(res.signup_url || "");
      setMailboxes(res.mailboxes || []);
      setSubscribers(subs.subscribers || []);
      if (res.settings) {
        setFromName(res.settings.from_name || "");
        setPhysicalAddress(res.settings.physical_address || "");
        setPublicSlug(res.settings.public_slug || "");
        if (!mailboxId) setMailboxId(res.settings.mailbox_id || res.mailboxes?.[0]?.id || "");
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not load newsletters.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetComposer() {
    setSubject("");
    setScheduleAt("");
    setEditingId(null);
    setEditorHtml("<p></p>");
    setEditorKey((k) => k + 1);
  }

  async function saveDraft(e: React.FormEvent, queue: boolean) {
    e.preventDefault();
    if (!subject.trim()) {
      setErr("Add a subject before saving.");
      return;
    }
    setBusy(true);
    setNotice("");
    setErr("");
    const html = editor.current?.getHtml() || "<p></p>";
    const scheduled = fromLocalInput(scheduleAt);
    try {
      if (editingId) {
        await api.updateNewsletter(editingId, {
          subject: subject.trim(),
          html_body: html,
          mailbox_id: mailboxId || undefined,
          from_name: fromName,
          scheduled_at: scheduled,
        });
        if (queue) await api.queueNewsletter(editingId, { scheduled_at: scheduled });
        setNotice(queue ? (scheduled ? "Scheduled." : "Queued for delivery.") : "Draft updated.");
      } else {
        await api.createNewsletter({
          subject: subject.trim(),
          html_body: html,
          mailbox_id: mailboxId || undefined,
          from_name: fromName,
          queue,
          scheduled_at: scheduled,
        });
        setNotice(queue ? (scheduled ? "Scheduled." : "Queued for delivery.") : "Draft saved.");
      }
      resetComposer();
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not save newsletter.");
    } finally {
      setBusy(false);
    }
  }

  async function editBlast(id: string) {
    setErr("");
    try {
      const { item } = await api.newsletter(id);
      setEditingId(item.id);
      setSubject(item.subject);
      setMailboxId(item.mailbox_id || mailboxId);
      setScheduleAt(toLocalInput(item.scheduled_at));
      setEditorHtml(item.html_body || "<p></p>");
      setEditorKey((k) => k + 1);
      document.querySelector<HTMLElement>("#main-content > main")?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not open draft.");
    }
  }

  async function addSubscriber(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setNotice("");
    try {
      const res = await api.addNewsletterSubscriber({ email: subEmail.trim(), name: subName.trim() || undefined, consented: true });
      setSubEmail("");
      setSubName("");
      setNotice(res.subscriber.status === "pending" ? "Confirmation email sent." : "Subscriber added.");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not add subscriber.");
    } finally {
      setBusy(false);
    }
  }

  async function importCsv(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setNotice("");
    try {
      const res = await api.importNewsletterSubscribers({ csv: csvText, consented: true });
      setCsvText("");
      setShowCsv(false);
      setNotice(`Imported ${res.imported} subscriber${res.imported === 1 ? "" : "s"}${res.skipped ? ` · ${res.skipped} skipped` : ""}.`);
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not import CSV.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsBusy(true);
    setErr("");
    setNotice("");
    try {
      const res = await api.saveNewsletterSettings({
        from_name: fromName,
        physical_address: physicalAddress,
        mailbox_id: mailboxId,
        public_slug: publicSlug,
        double_opt_in: true,
      });
      setSignupUrl(res.signup_url);
      setNotice("Newsletter settings saved.");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not save settings.");
    } finally {
      setSettingsBusy(false);
    }
  }

  const locked = !planOk;
  const canSend = Boolean(physicalAddress.trim()) && audienceCount > 0 && !locked;

  return (
    <AppFeaturePage
      current="newsletters"
      title="Newsletters"
      subtitle={
        limits
          ? `${limits.sends_per_month.toLocaleString()} sends / mo · ${audienceCount.toLocaleString()} / ${limits.subscribers.toLocaleString()} subscribers`
          : "Write and send from your own domain. Delivery caps follow your plan."
      }
    >
      {notice ? (
        <p className={cn("mb-4", tw.notice)} role="status">
          {notice}
        </p>
      ) : null}
      {err ? (
        <p className={cn("mb-4", tw.error)} role="alert">
          {err}
        </p>
      ) : null}
      {locked ? (
        <p className={cn("mb-4", tw.noticeWarn)} role="status">
          Newsletters require Solo or higher.{" "}
          <button type="button" className={tw.textButton} onClick={() => go("/app/billing")}>
            View plans
          </button>
        </p>
      ) : null}

      <form className={cn(tw.appFeatureCard, "gap-3 mb-6", tw.stack)} onSubmit={(e) => void saveSettings(e)}>
        <h2>Sender &amp; compliance</h2>
        <p className={cn("text-sm", tw.muted)}>
          Every send includes your mailing address and an unsubscribe link. Public signup always requires email
          confirmation (double opt-in).
        </p>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div className={cn("gap-1.5", tw.stack)}>
            <Label htmlFor="nl-from">From name</Label>
            <Input id="nl-from" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Ada from Acme" className="max-md:min-h-11 max-md:text-base" />
          </div>
          <div className={cn("gap-1.5", tw.stack)}>
            <Label htmlFor="nl-mailbox">Send from</Label>
            <select
              id="nl-mailbox"
              className={cn(tw.nativeControl, "w-full min-w-0 max-md:min-h-11 max-md:text-base")}
              value={mailboxId}
              onChange={(e) => setMailboxId(e.target.value)}
              disabled={!mailboxes.length}
            >
              {!mailboxes.length ? <option value="">Add a mailbox first</option> : null}
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name ? `${m.display_name} · ${m.address}` : m.address}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={cn("gap-1.5", tw.stack)}>
          <Label htmlFor="nl-address">Physical mailing address</Label>
          <Input
            id="nl-address"
            value={physicalAddress}
            onChange={(e) => setPhysicalAddress(e.target.value)}
            placeholder="123 Market St, City, Country"
            className="max-md:min-h-11 max-md:text-base"
            required
          />
        </div>
        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className={cn("min-w-0 gap-1.5", tw.stack)}>
            <Label htmlFor="nl-slug">Public signup URL</Label>
            <div className={tw.rowForm}>
              <Input id="nl-slug" value={publicSlug} onChange={(e) => setPublicSlug(e.target.value)} className="max-md:min-h-11 max-md:text-base" />
              {signupUrl ? (
                <Button type="button" size="sm" variant="outline" className="max-md:w-full" onClick={() => void navigator.clipboard.writeText(signupUrl).then(() => setNotice("Signup link copied.")).catch(() => setErr("Could not copy link."))}>
                  Copy link
                </Button>
              ) : null}
            </div>
            {signupUrl ? (
              <p className={cn(tw.muted, "break-all")}>
                <a href={signupUrl} className="underline-offset-2 hover:underline">
                  {signupUrl}
                </a>
              </p>
            ) : null}
          </div>
          <p className={cn("text-sm", tw.muted)}>
            Public signup always requires email confirmation (double opt-in).
          </p>
        </div>
        <Button type="submit" className="w-full sm:w-auto" disabled={settingsBusy || locked}>
          {settingsBusy ? "Saving…" : "Save settings"}
        </Button>
      </form>

      <section className={cn(tw.appFeatureCard, "gap-3 mb-6", tw.stack)}>
        <h2>Audience</h2>
        <p className={cn("text-sm", tw.muted)}>
          {audienceCount} active{pendingCount ? ` · ${pendingCount} pending` : ""}. Dashboard adds skip confirmation (you attest consent). Public signup still confirms by email.
        </p>
        <form className={tw.rowForm} onSubmit={(e) => void addSubscriber(e)}>
          <Input
            placeholder="subscriber@example.com"
            value={subEmail}
            onChange={(e) => setSubEmail(e.target.value)}
            required
            type="email"
            className="max-md:min-h-11 max-md:text-base"
            disabled={locked}
          />
          <Input placeholder="Name (optional)" value={subName} onChange={(e) => setSubName(e.target.value)} className="max-md:min-h-11 max-md:text-base" disabled={locked} />
          <Button type="submit" disabled={busy || locked} size="sm" className="max-md:w-full">
            Add
          </Button>
        </form>
        <div>
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowCsv((v) => !v)}>
            {showCsv ? "Hide CSV import" : "Import CSV"}
          </Button>
        </div>
        {showCsv ? (
          <form className={cn("gap-2", tw.stack)} onSubmit={(e) => void importCsv(e)}>
            <Label htmlFor="nl-csv">CSV with an email column (optional name)</Label>
            <Textarea
              id="nl-csv"
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"email,name\nfounder@example.com,Ada"}
              className="max-md:text-base"
              disabled={locked}
            />
            <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={busy || locked || !csvText.trim()}>
              Import
            </Button>
          </form>
        ) : null}
        {subscribers.length ? (
          <ul className={tw.appFeatureList}>
            {subscribers.slice(0, 50).map((s) => (
              <li key={s.id} className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <strong className="break-all">{s.email}</strong>
                  <span className={tw.muted}>
                    {" "}
                    {s.name ? `· ${s.name} ` : ""}
                  </span>
                  <Badge variant={statusVariant(s.status)} className="ml-1.5 align-middle">
                    {s.status}
                  </Badge>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="self-start sm:self-auto"
                  disabled={locked}
                  onClick={() =>
                    void api.deleteNewsletterSubscriber(s.id).then(load).catch((ex) => {
                      setErr(ex instanceof Error ? ex.message : "Could not remove subscriber.");
                    })
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <FeatureEmpty
            title="No subscribers yet"
            body="Add people you already have permission to email, or share your public signup link."
            mockup={
              <div className={tw.featureEmptyMock} aria-hidden>
                <div className={tw.featureEmptyRow}>
                  <span className={tw.featureEmptyAvatar}>@</span>
                  <span className={tw.featureEmptyLine} />
                  <span className={tw.featureEmptyChip}>Active</span>
                </div>
                <div className={cn(tw.featureEmptyRow, "opacity-55")}>
                  <span className={tw.featureEmptyAvatar}>@</span>
                  <span className={tw.featureEmptyLine} />
                  <span className={cn(tw.featureEmptyChip, "bg-[var(--surface-hover)] text-[var(--foreground-muted)]")}>Pending</span>
                </div>
              </div>
            }
          />
        )}
      </section>

      <form className={cn(tw.appFeatureCard, "gap-3", tw.stack)} onSubmit={(e) => void saveDraft(e, false)}>
        <h2>{editingId ? "Edit draft" : "New draft"}</h2>
        <div className={cn("gap-1.5", tw.stack)}>
          <Label htmlFor="nl-subject">Subject</Label>
          <Input id="nl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required disabled={locked} className="max-md:min-h-11 max-md:text-base" />
        </div>
        <div className={cn("gap-1.5", tw.stack)}>
          <span className="text-sm font-medium">Message</span>
          <RichTextEditor key={editorKey} ref={editor} initialHtml={editorHtml} />
        </div>
        <div className={cn("gap-1.5", tw.stack)}>
          <Label htmlFor="nl-when">Schedule (optional)</Label>
          <Input id="nl-when" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} disabled={locked} className="w-full min-w-0 max-md:min-h-11 max-md:text-base" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button type="submit" disabled={busy || locked} variant="secondary" className="w-full sm:w-auto">
            {busy ? "Saving…" : editingId ? "Update draft" : "Save draft"}
          </Button>
          <Button type="button" disabled={busy || locked || !canSend} className="w-full sm:w-auto" onClick={(e) => void saveDraft(e, true)}>
            {scheduleAt ? "Schedule send" : "Queue send"}
          </Button>
          {editingId ? (
            <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => resetComposer()}>
              Cancel edit
            </Button>
          ) : null}
        </div>
        {!physicalAddress.trim() && !locked ? (
          <p className={tw.muted}>Add a mailing address above before you can queue a send.</p>
        ) : null}
        {audienceCount === 0 && !locked ? <p className={tw.muted}>Add at least one active subscriber before sending.</p> : null}
      </form>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Recent</h2>
        {loading ? (
          <p className={tw.muted} role="status">
            Loading newsletters…
          </p>
        ) : items.length === 0 ? (
          <FeatureEmpty
            title="No newsletters yet"
            body="Drafts, scheduled sends, and delivered blasts appear here."
            mockup={
              <div className={tw.featureEmptyMock} aria-hidden>
                <div className={tw.featureEmptyRow}>
                  <span className={cn(tw.featureEmptyLine, "flex-[0_0_72%]")} />
                  <span className={cn(tw.featureEmptyChip, "bg-[var(--surface-hover)] text-[var(--foreground-muted)]")}>Draft</span>
                </div>
                <div className={cn(tw.featureEmptyRow, "opacity-55")}>
                  <span className={cn(tw.featureEmptyLine, "flex-[0_0_58%]")} />
                  <span className={tw.featureEmptyChip}>Queued</span>
                </div>
              </div>
            }
          />
        ) : (
          <ul className={tw.appFeatureList}>
            {items.map((n) => {
              const label = blastLabel(n);
              const editable = n.status === "draft" || n.status === "failed";
              return (
                <li key={n.id} className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <strong className="break-words">{n.subject || "(no subject)"}</strong>
                    <span className={cn(tw.muted, "block sm:inline")}>
                      {" "}
                      · {n.capped_count} sent
                      {n.scheduled_at ? ` · ${new Date(n.scheduled_at).toLocaleString()}` : ` · ${new Date(n.created_at).toLocaleString()}`}
                    </span>
                    <Badge variant={statusVariant(label)} className="ml-0 mt-1 align-middle sm:ml-1.5 sm:mt-0">
                      {label}
                    </Badge>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {editable ? (
                      <Button type="button" size="sm" variant="ghost" className="max-md:flex-1" onClick={() => void editBlast(n.id)}>
                        Edit
                      </Button>
                    ) : null}
                    {editable ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="max-md:flex-1"
                        disabled={busy || !canSend}
                        onClick={() =>
                          void api
                            .queueNewsletter(n.id, { scheduled_at: n.scheduled_at && n.scheduled_at > Date.now() ? n.scheduled_at : null })
                            .then(() => {
                              setNotice("Queued for delivery.");
                              return load();
                            })
                            .catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not queue."))
                        }
                      >
                        Queue send
                      </Button>
                    ) : null}
                    {editable ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="max-md:flex-1"
                        onClick={() =>
                          void api
                            .deleteNewsletter(n.id)
                            .then(() => {
                              if (editingId === n.id) resetComposer();
                              return load();
                            })
                            .catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not delete."))
                        }
                      >
                        Delete
                      </Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppFeaturePage>
  );
}
