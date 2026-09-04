import { useEffect, useState } from "react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { api } from "../lib/api";
import { go } from "../lib/nav";

function OAuthButtons({ invite }: { invite?: string }) {
  const [providers, setProviders] = useState<{ google: boolean; github: boolean }>({ google: false, github: false });
  useEffect(() => {
    api.authProviders().then(setProviders).catch(() => undefined);
  }, []);
  const q = invite ? `?invite=${encodeURIComponent(invite)}&redirect=/app` : "?redirect=/app";
  if (!providers.google && !providers.github) return null;
  return (
    <div className="stack gap-2">
      {providers.google ? (
        <a className="btn oauth-btn" href={`/api/auth/google${q}`}>
          Continue with Google
        </a>
      ) : null}
      {providers.github ? (
        <a className="btn oauth-btn oauth-btn-secondary" href={`/api/auth/github${q}`}>
          Continue with GitHub
        </a>
      ) : null}
      <div className="auth-divider"><span>or use email</span></div>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthErr = params.get("error");
    if (oauthErr) setErr("Sign-in with the provider failed. Try again or use email.");
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
        <p className="muted">Access your brand inbox at useflap.online.</p>
        {err ? <p className="error" role="alert">{err}</p> : null}
        <OAuthButtons />
        {showPassword ? (
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
              {busy ? "Signing in…" : "Sign in with password"}
            </Button>
          </div>
        ) : (
          <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(true)}>
            Sign in with email & password
          </button>
        )}
        <p className="muted mt-4 text-sm">
          New here?{" "}
          <a href="/signup" onClick={(e) => { e.preventDefault(); go("/signup"); }}>Create a free workspace</a>
        </p>
      </form>
    </div>
  );
}
