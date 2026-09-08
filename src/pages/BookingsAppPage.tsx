import { useEffect, useState } from "react";
import AppFeaturePage, { FeatureEmpty } from "../components/AppFeaturePage";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { api } from "../lib/api";
import { tw } from "../lib/tw";
import { cn } from "../lib/utils";

export default function BookingsAppPage() {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdUrl, setCreatedUrl] = useState("");

  useEffect(() => {
    setPageHint();
  }, []);

  function setPageHint() {
    /* keep hook for future list endpoint */
  }

  async function createPage(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setNotice("");
    try {
      const res = await api.createBookingPage({
        slug: slug.trim(),
        title: title.trim() || slug.trim(),
      });
      setCreatedUrl(res.page.url);
      setNotice(`Booking page ready at ${res.page.url}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not create booking page.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppFeaturePage
      current="bookings"
      title="Booking pages"
      subtitle="Let guests request a meeting with a link. Automatic availability checks are not yet available."
    >
      {err ? <p className={tw.error} role="alert">{err}</p> : null}
      {notice ? <p className={tw.notice} role="status">{notice}</p> : null}
      <form className={cn(tw.appFeatureCard, "gap-3", tw.stack)} onSubmit={(e) => void createPage(e)}>
        <h2>Create a page</h2>
        <div className={cn("gap-1.5", tw.stack)}>
          <Label htmlFor="book-slug">Slug</Label>
          <Input
            id="book-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="your-name"
            required
            pattern="[a-z0-9-]+"
          />
        </div>
        <div className={cn("gap-1.5", tw.stack)}>
          <Label htmlFor="book-title">Title</Label>
          <Input id="book-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book a call" />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create booking page"}
        </Button>
        {createdUrl ? (
          <p className={cn("text-sm", tw.muted)}>
            Public URL: <a href={createdUrl} className="break-all">{createdUrl}</a>
          </p>
        ) : null}
      </form>
      {!createdUrl ? (
        <div className="mt-6">
          <FeatureEmpty
            title="No booking pages yet"
            body="Create your first link to collect meeting requests. Review each request before confirming a time."
            mockup={
              <div className={tw.featureEmptyMock} aria-hidden>
                <div className={tw.featureEmptyCal}>
                  {Array.from({ length: 7 }, (_, i) => (
                    <span key={i} className={i === 2 || i === 4 ? tw.featureEmptyDayHit : tw.featureEmptyDay} />
                  ))}
                </div>
                <div className={tw.featureEmptyRow}>
                  <span className={tw.featureEmptyLine} />
                  <span className={tw.featureEmptyChip}>30 min</span>
                </div>
              </div>
            }
          />
        </div>
      ) : null}
    </AppFeaturePage>
  );
}
