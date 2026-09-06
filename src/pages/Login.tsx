import { useEffect, useState } from "react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { api } from "../lib/api";
import { authClient, authErrorMessage } from "../lib/auth-client";
import { go } from "../lib/nav";
import { storePendingVerifyEmail, verifyEmailPath } from "../lib/verify-email";

function OAuthButtons({ invite }: { invite?: string }) {
  const [providers, setProviders] = useState<{ google: boolean; github: boolean }>({ google: false, github: false });
  useEffect(() => {
    api.authProviders().then(setProviders).catch(() => undefined);
  }, []);
  if (!providers.google && !providers.github) return null;

  const callbackURL = invite ? `/invite/${invite}` : "/app";

  async function social(provider: "google" | "github") {
    await authClient.signIn.social({ provider, callbackURL });
  }

  return (
    <div className="stack gap-2">
      {providers.google ? (
        <button type="button" className="btn oauth-btn" onClick={() => void social("google")}>
          Continue with Google
        </button>
      ) : null}
      {providers.github ? (
        <button type="button" className="btn oauth-btn oauth-btn-secondary" onClick={() => void social("github")}>
          Continue with GitHub
        </button>
      ) : null}
      <div className="auth-divider"><span>or email a magic link</span></div>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthErr = params.get("error");
    if (oauthErr) setErr("Sign-in failed. Try again or use a magic link.");
    api.setupStatus().then((s) => {
      if (s.needs_setup) go("/setup");
    }).catch(() => undefined);
    api.me().then((me) => {
      if (me.user.email_verified === false) {
        storePendingVerifyEmail(me.user.email);
        go(verifyEmailPath(me.user.email, "signin"));
        return;
      }
      go("/app");
    }).catch(() => undefined);
  }, []);

  async function onMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      const { error } = await authClient.signIn.magicLink({
        email,
        callbackURL: "/app",
        errorCallbackURL: "/login?error=magic",
      });
      if (error) throw error;
      setNotice("Check your email for a sign-in link. It expires in 15 minutes.");
    } catch (ex) {
      setErr(authErrorMessage(ex, "Could not send magic link."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={onMagicLink}>
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); go("/"); }}>
          <BrandMark /> Flap
        </a>
        <h1>Sign in</h1>
        <p className="muted">
          Use Google, GitHub, or a magic link — no password to remember.
        </p>
        {err ? <p className="error" role="alert">{err}</p> : null}
        {notice ? <p className="muted" role="status">{notice}</p> : null}
        <OAuthButtons />
        <div className="stack gap-3">
          <div className="stack gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Sending link…" : "Email me a magic link"}
          </Button>
        </div>
        <p className="muted mt-4 text-sm">
          New here?{" "}
          <a href="/signup" onClick={(e) => { e.preventDefault(); go("/signup"); }}>Create a free workspace</a>
        </p>
      </form>
    </div>
  );
}
