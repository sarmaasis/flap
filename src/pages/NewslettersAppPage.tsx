import { useEffect, useState, useRef } from "react";
import AppFeaturePage, { FeatureEmpty } from "../components/AppFeaturePage";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import RichTextEditor, { type EditorHandle } from "../components/RichTextEditor";
import { api } from "../lib/api";

type Blast = { id: string; subject: string; status: string; capped_count: number; created_at: number };
type Subscriber = { id: string; email: string; name: string; status: string; created_at: number };

export default function NewslettersAppPage() {
  const [items, setItems] = useState<Blast[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [limits, setLimits] = useState<{ sends_per_month: number; subscribers: number } | null>(null);
  const [audienceCount, setAudienceCount] = useState(0);
  const [subject, setSubject] = useState("");
  const [subEmail, setSubEmail] = useState("");
  const [subName, setSubName] = useState("");
  const editor = useRef<EditorHandle>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [res, subs] = await Promise.all([
        api.newsletters(),
        api.newsletterSubscribers().catch(() => ({ subscribers: [] as Subscriber[] })),
      ]);
      setItems(res.items || []);
      setLimits(res.caps || null);
      setAudienceCount(res.audience_count ?? subs.subscribers.length);
      setSubscribers(subs.subscribers || []);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not load newsletters.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) {
      setErr("Add a subject before saving.");
      return;
    }
    setBusy(true);
    setNotice("");
    setErr("");
    try {
      await api.createNewsletter({ subject: subject.trim(), html_body: editor.current?.getHtml() || "<p></p>" });
      setSubject("");
      setEditorKey((k) => k + 1);
      setNotice("Draft saved. Queue it when your audience is ready — cron sends queued blasts.");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not create draft.");
    } finally {
      setBusy(false);
    }
  }

  async function addSubscriber(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setNotice("");
    try {
      await api.addNewsletterSubscriber({ email: subEmail.trim(), name: subName.trim() || undefined });
      setSubEmail("");
      setSubName("");
      setNotice("Subscriber added to your audience.");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not add subscriber.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppFeaturePage
      current="newsletters"
      title="Newsletters"
      subtitle={
        limits
          ? `${limits.sends_per_month.toLocaleString()} sends / mo · ${audienceCount.toLocaleString()} / ${limits.subscribers.toLocaleString()} subscribers (MVP audience)`
          : "Write and send from your own domain. Delivery caps follow your plan."
      }
    >
      <p className="notice mb-4" role="note">
        Partial stack: audiences and a cron queue consumer ship; dedicated sending subdomain, CAN-SPAM footer, and CSV
        import are still ahead.
      </p>
      {notice && (
        <p className="notice mb-4" role="status">
          {notice}
        </p>
      )}
      {err ? (
        <p className="error" role="alert">
          {err}
        </p>
      ) : null}

      <section className="app-feature-card stack gap-3 mb-6">
        <h2>Audiences</h2>
        <p className="muted text-sm">Manual add for now. Double opt-in and CSV import are not finished.</p>
        <form className="row-form" onSubmit={(e) => void addSubscriber(e)}>
          <Input
            placeholder="subscriber@example.com"
            value={subEmail}
            onChange={(e) => setSubEmail(e.target.value)}
            required
            type="email"
          />
          <Input placeholder="Name (optional)" value={subName} onChange={(e) => setSubName(e.target.value)} />
          <Button type="submit" disabled={busy} size="sm">
            Add
          </Button>
        </form>
        {subscribers.length ? (
          <ul className="app-feature-list">
            {subscribers.slice(0, 20).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>{s.email}</strong>
                  <span className="muted">
                    {" "}
                    · {s.status}
                    {s.name ? ` · ${s.name}` : ""}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
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
          <FeatureEmpty title="No subscribers yet" body="Add emails to build an audience before queuing a blast." mockup={
            <div className="feature-empty-mock" aria-hidden>
              <div className="feature-empty-mock-row">
                <span className="feature-empty-mock-avatar">@</span>
                <span className="feature-empty-mock-line grow" />
                <span className="feature-empty-mock-chip">Active</span>
              </div>
              <div className="feature-empty-mock-row dim">
                <span className="feature-empty-mock-avatar">@</span>
                <span className="feature-empty-mock-line grow" />
                <span className="feature-empty-mock-chip muted">Pending</span>
              </div>
            </div>
          } />
        )}
      </section>

      <form className="app-feature-card stack gap-3" onSubmit={(e) => void createDraft(e)}>
        <h2>New draft</h2>
        <div className="stack gap-1.5">
          <Label htmlFor="nl-subject">Subject</Label>
          <Input id="nl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </div>
        <div className="stack gap-1.5">
          <span className="text-sm font-medium">Message</span>
          <RichTextEditor key={editorKey} ref={editor} />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save draft"}
        </Button>
      </form>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-3">Recent</h2>
        {loading ? (
          <p className="muted" role="status">
            Loading newsletters…
          </p>
        ) : items.length === 0 ? (
          <FeatureEmpty
            title="No newsletters yet"
            body="Drafts and sends appear here. Queue a draft to let cron deliver to your audience."
            mockup={
              <div className="feature-empty-mock" aria-hidden>
                <div className="feature-empty-mock-row">
                  <span className="feature-empty-mock-line long" />
                  <span className="feature-empty-mock-chip muted">Draft</span>
                </div>
                <div className="feature-empty-mock-row dim">
                  <span className="feature-empty-mock-line medium" />
                  <span className="feature-empty-mock-chip">Queued</span>
                </div>
              </div>
            }
          />
        ) : (
          <ul className="app-feature-list">
            {items.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>{n.subject || "(no subject)"}</strong>
                  <span className="muted">
                    {" "}
                    · {n.status} · {n.capped_count} sent · {new Date(n.created_at).toLocaleString()}
                  </span>
                </span>
                {n.status === "draft" || n.status === "failed" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy || audienceCount === 0}
                    onClick={() =>
                      void api
                        .queueNewsletter(n.id)
                        .then(() => {
                          setNotice("Queued for cron delivery.");
                          return load();
                        })
                        .catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not queue."))
                    }
                  >
                    Queue send
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppFeaturePage>
  );
}
