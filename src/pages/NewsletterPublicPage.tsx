import { useEffect, useState } from "react";
import MarketingShell from "../components/MarketingShell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { setPageMeta } from "../lib/seo";

type Mode = "subscribe" | "confirm" | "unsubscribe";

function parsePublicPath(path: string): { mode: Mode; value: string } {
  const confirm = path.match(/^\/n\/c\/([^/]+)/);
  if (confirm) return { mode: "confirm", value: decodeURIComponent(confirm[1]) };
  const unsub = path.match(/^\/n\/u\/([^/]+)/);
  if (unsub) return { mode: "unsubscribe", value: decodeURIComponent(unsub[1]) };
  const slug = path.replace(/^\/n\/?/, "").split("/")[0] || "";
  return { mode: "subscribe", value: decodeURIComponent(slug) };
}

export default function NewsletterPublicPage({ path }: { path: string }) {
  const parsed = parsePublicPath(path);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [fromName, setFromName] = useState("Newsletter");
  const [fromAddress, setFromAddress] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(parsed.mode !== "subscribe");

  useEffect(() => {
    const title =
      parsed.mode === "confirm"
        ? "Confirm subscription | Flap"
        : parsed.mode === "unsubscribe"
          ? "Unsubscribe | Flap"
          : "Subscribe | Flap";
    setPageMeta({
      title,
      description: "Public newsletter signup, confirmation, and unsubscribe for Flap lists.",
      path,
    });
  }, [parsed.mode, path]);

  useEffect(() => {
    let cancelled = false;
    setErr("");
    setMsg("");
    if (parsed.mode === "subscribe") {
      void fetch(`/api/public/n/${encodeURIComponent(parsed.value)}`)
        .then(async (res) => {
          const data = (await res.json().catch(() => ({}))) as { error?: string; from_name?: string; from_address?: string };
          if (cancelled) return;
          if (!res.ok) throw new Error(data.error || "This signup page is not available.");
          setFromName(data.from_name || "Newsletter");
          setFromAddress(data.from_address || "");
          setReady(true);
        })
        .catch((ex) => {
          if (!cancelled) {
            setErr(ex instanceof Error ? ex.message : "This signup page is not available.");
            setReady(true);
          }
        });
    }
    if (parsed.mode === "confirm") {
      void fetch(`/api/public/n/confirm/${encodeURIComponent(parsed.value)}`)
        .then(async (res) => {
          const data = (await res.json().catch(() => ({}))) as { error?: string; email?: string };
          if (cancelled) return;
          if (!res.ok) throw new Error(data.error || "This confirmation link is invalid.");
          setMsg(`You’re subscribed${data.email ? ` as ${data.email}` : ""}.`);
          setReady(true);
        })
        .catch((ex) => {
          if (!cancelled) {
            setErr(ex instanceof Error ? ex.message : "This confirmation link is invalid.");
            setReady(true);
          }
        });
    }
    if (parsed.mode === "unsubscribe") {
      void fetch(`/api/public/n/unsubscribe/${encodeURIComponent(parsed.value)}`)
        .then(async (res) => {
          const data = (await res.json().catch(() => ({}))) as { error?: string; email?: string; status?: string };
          if (cancelled) return;
          if (!res.ok) throw new Error(data.error || "This unsubscribe link is invalid.");
          setEmail(data.email || "");
          if (data.status === "unsubscribed") setMsg(`${data.email} is already unsubscribed.`);
          setReady(true);
        })
        .catch((ex) => {
          if (!cancelled) {
            setErr(ex instanceof Error ? ex.message : "This unsubscribe link is invalid.");
            setReady(true);
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [parsed.mode, parsed.value]);

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`/api/public/n/${encodeURIComponent(parsed.value)}/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Could not subscribe.");
      setMsg(data.message || "Check your inbox to confirm.");
      setEmail("");
      setName("");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not subscribe.");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/public/n/unsubscribe/${encodeURIComponent(parsed.value)}`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; email?: string };
      if (!res.ok) throw new Error(data.error || "Could not unsubscribe.");
      setMsg(`${data.email || "You"} will no longer receive this list.`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not unsubscribe.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MarketingShell>
      <article className="mx-auto w-full max-w-lg px-4 pb-24 pt-8 sm:px-5 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Newsletter</p>
        {parsed.mode === "subscribe" ? (
          <>
            <h1 className="mt-3 break-words text-[1.75rem] font-semibold leading-tight tracking-tight md:text-3xl">Subscribe to {fromName}</h1>
            <p className="mt-3 break-words text-[var(--muted)]">
              {fromAddress ? `Sent from ${fromAddress}. ` : ""}
              Confirm your email if the list uses double opt-in. You can unsubscribe from every send.
            </p>
            {ready && !err ? (
              <form className="mt-8 space-y-4" onSubmit={(e) => void subscribe(e)}>
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 text-base" autoComplete="name" />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11 text-base" />
                </div>
                <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Subscribing…" : "Subscribe"}</Button>
              </form>
            ) : null}
          </>
        ) : null}
        {parsed.mode === "confirm" ? (
          <>
            <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-tight md:text-3xl">Confirm subscription</h1>
            <p className="mt-3 text-[var(--muted)]">We’re verifying your email for this list.</p>
          </>
        ) : null}
        {parsed.mode === "unsubscribe" ? (
          <>
            <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-tight md:text-3xl">Unsubscribe</h1>
            <p className="mt-3 break-all text-[var(--muted)]">
              {email ? `${email} will stop receiving this newsletter.` : "Stop receiving this newsletter."}
            </p>
            {ready && !err && !msg ? (
              <form className="mt-8" onSubmit={(e) => void unsubscribe(e)}>
                <Button type="submit" className="h-11 w-full sm:w-auto" disabled={busy}>{busy ? "Updating…" : "Unsubscribe"}</Button>
              </form>
            ) : null}
          </>
        ) : null}
        {msg ? <p className="mt-6 text-sm text-[var(--foreground)]">{msg}</p> : null}
        {err ? <p className="mt-6 text-sm text-[var(--error-text)]">{err}</p> : null}
      </article>
    </MarketingShell>
  );
}
