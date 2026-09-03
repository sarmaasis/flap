import { useEffect, useState } from "react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { api } from "../lib/api";
import { go } from "../lib/nav";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.setupStatus().then((s) => {
      if (s.needs_setup) go("/setup");
    }).catch(() => undefined);
    api.me().then(() => go("/app")).catch(() => undefined);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api.login(email, password);
      go("/app");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Sign in failed.");
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
        <h1>Sign in</h1>
        <p className="muted">Access your Flap workspace at useflap.online.</p>
        {err ? <p className="error" role="alert">{err}</p> : null}
        <div className="stack gap-3">
          <div className="stack gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="stack gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </div>
        <p className="muted mt-4 text-sm">
          New here?{" "}
          <a href="/signup" onClick={(e) => { e.preventDefault(); go("/signup"); }}>Create a free workspace</a>
        </p>
        <p className="muted mt-2 text-xs">
          Need help? <a href="mailto:support@useflap.online">support@useflap.online</a>
        </p>
      </form>
    </div>
  );
}
