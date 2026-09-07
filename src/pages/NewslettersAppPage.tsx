import { useEffect, useState, useRef } from "react";
import AppFeaturePage, { FeatureEmpty } from "../components/AppFeaturePage";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import RichTextEditor, { type EditorHandle } from "../components/RichTextEditor";
import { api } from "../lib/api";

type Blast = { id: string; subject: string; status: string; capped_count: number; created_at: number };

export default function NewslettersAppPage() {
  const [items, setItems] = useState<Blast[]>([]);
  const [limits, setLimits] = useState<{ sends_per_month: number; subscribers: number } | null>(null);
  const [subject, setSubject] = useState("");
  const editor = useRef<EditorHandle>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await api.newsletters();
      setItems(res.items || []);
      setLimits(res.caps || null);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not load newsletters.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) { setErr("Add a subject before saving."); return; }
    setBusy(true);
    setNotice("");
    setErr("");
    try {
      await api.createNewsletter({ subject: subject.trim(), html_body: editor.current?.getHtml() || "<p></p>" });
      setSubject("");
      setEditorKey(k => k + 1);
      setNotice("Draft saved. It has not been sent.");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not create draft.");
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
          ? `${limits.sends_per_month.toLocaleString()} sends / mo · ${limits.subscribers.toLocaleString()} active subscribers on your plan`
          : "Write and send from your own domain. Delivery caps follow your plan."
      }
    >
      {notice && <p className="notice mb-4" role="status">{notice}</p>}
      {err ? <p className="error" role="alert">{err}</p> : null}
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
        {loading ? <p className="muted" role="status">Loading newsletters…</p> : items.length === 0 ? (
          <FeatureEmpty
            title="No newsletters yet"
            body="Drafts and sends appear here. Subscribers live on your domain — not a rented list."
          />
        ) : (
          <ul className="app-feature-list">
            {items.map((n) => (
              <li key={n.id}>
                <strong>{n.subject || "(no subject)"}</strong>
                <span className="muted">
                  {n.status} · {n.capped_count} capped · {new Date(n.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppFeaturePage>
  );
}
