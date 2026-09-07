import { useEffect, useState } from "react";
import MarketingShell from "../components/MarketingShell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { setPageMeta } from "../lib/seo";

/** Public booking page - CalDAV full sync remains Partial. */
export default function BookingPage({ path }: { path: string }) {
  const slug = path.replace(/^\/book\/?/, "") || "demo";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPageMeta({
      title: "Book a time | Flap",
      description: "Availability-based booking pages for Flap mailboxes (CalDAV sync Partial).",
      path,
    });
  }, [path]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/booking/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, note }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Could not request booking.");
      setMsg(data.message || "Request received. The host will confirm by email.");
      setName("");
      setEmail("");
      setNote("");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not request booking.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MarketingShell>
      <article className="mx-auto max-w-lg px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Booking</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Book with {slug}</h1>
        <p className="mt-3 text-[var(--muted)]">
          Public booking request form. Full CalDAV sync and live availability overlays are Partial until the
          calendar protocol path ships. Requests are accepted via API and stored for the host.
        </p>
        <form className="mt-8 space-y-4" onSubmit={(e) => void submit(e)}>
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="note">Note</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Request time"}</Button>
        </form>
        {msg ? <p className="mt-4 text-sm text-[var(--muted)]">{msg}</p> : null}
      </article>
    </MarketingShell>
  );
}
