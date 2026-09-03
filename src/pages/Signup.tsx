import { useState } from "react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { api } from "../lib/api";
import { go } from "../lib/nav";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api.signup(email, password);
      go("/app/settings?tab=setup&onboarding=1");
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Could not create account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go("/");
          }}
        >
          <BrandMark /> Flap
        </a>
        <h1>Create your workspace</h1>
        <p className="muted">Start on Free. Next you’ll add a domain, create a mailbox, and optionally upgrade.</p>
        {err ? <p className="error" role="alert">{err}</p> : null}
        <div className="stack gap-3">
          <div className="stack gap-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="stack gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Creating…" : "Start free"}
          </Button>
        </div>
        <p className="muted mt-4 text-xs leading-relaxed">
          By creating an account you agree to the{" "}
          <a href="/terms" onClick={(e) => { e.preventDefault(); go("/terms"); }}>Terms</a>
          {", "}
          <a href="/privacy" onClick={(e) => { e.preventDefault(); go("/privacy"); }}>Privacy Policy</a>
          {", and "}
          <a href="/billing-terms" onClick={(e) => { e.preventDefault(); go("/billing-terms"); }}>Billing Terms</a>.
        </p>
        <p className="muted mt-4 text-sm">
          Already have an account?{" "}
          <a
            href="/login"
            onClick={(e) => {
              e.preventDefault();
              go("/login");
            }}
          >
            Sign in
          </a>
        </p>
      </form>
    </div>
  );
}
