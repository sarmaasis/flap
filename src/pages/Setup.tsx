import { useEffect, useState } from "react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { api } from "../lib/api";
import { go } from "../lib/nav";

export default function Setup() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.setupStatus().then((s) => {
      if (!s.needs_setup) go("/login");
    }).catch(() => undefined);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      const res = await api.setup(email);
      if (res.magic_sent) {
        setNotice(`Check ${email} for a magic link to finish setup. It expires in 15 minutes.`);
        return;
      }
      go("/app/settings?tab=setup&onboarding=1");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Setup failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); go("/"); }}>
          <BrandMark /> Flap
        </a>
        <h1>Create your workspace</h1>
        <p className="muted">First account on this deployment. We’ll email a magic link — no password.</p>
        {err ? <p className="error" role="alert">{err}</p> : null}
        {notice ? <p className="muted" role="status">{notice}</p> : null}
        <div className="stack gap-3">
          <div className="stack gap-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy || Boolean(notice)} className="w-full">
            {busy ? "Sending link…" : notice ? "Link sent" : "Email me a magic link"}
          </Button>
        </div>
        <p className="muted mt-4 text-xs leading-relaxed">
          By continuing you agree to the{" "}
          <a href="/terms" onClick={(e) => { e.preventDefault(); go("/terms"); }}>Terms</a>
          {" and "}
          <a href="/privacy" onClick={(e) => { e.preventDefault(); go("/privacy"); }}>Privacy Policy</a>.
        </p>
      </form>
    </div>
  );
}
