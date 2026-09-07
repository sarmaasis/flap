import { useEffect, useState } from "react";
import { useAuth, useSignIn } from "@clerk/clerk-react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { api } from "../lib/api";
import { absoluteUrl, authErrorMessage, ClerkMissingCard, useClerkReady } from "../lib/clerk";
import { go } from "../lib/nav";
import { storePendingVerifyEmail, verifyEmailPath } from "../lib/verify-email";

function OAuthButtons({ invite }: { invite?: string }) {
  const { signIn, isLoaded } = useSignIn();
  if (!isLoaded || !signIn) return null;

  const complete = invite ? `/invite/${invite}` : "/app";

  async function social(strategy: "oauth_google" | "oauth_github") {
    if (!signIn) return;
    await signIn.authenticateWithRedirect({
      strategy,
      redirectUrl: absoluteUrl("/sso-callback"),
      redirectUrlComplete: absoluteUrl(complete),
    });
  }

  return (
    <div className="stack gap-2">
      <Button type="button" variant="outline" className="w-full" onClick={() => void social("oauth_google")}>
        Continue with Google
      </Button>
      <Button type="button" variant="secondary" className="w-full" onClick={() => void social("oauth_github")}>
        Continue with GitHub
      </Button>
      <div className="auth-divider"><span>or email a magic link</span></div>
    </div>
  );
}

function LoginInner() {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { signIn, isLoaded } = useSignIn();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const invite = new URLSearchParams(window.location.search).get("invite") || undefined;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) setErr("Sign-in failed. Try again or use a magic link.");
    api.setupStatus().then((s) => {
      if (s.needs_setup) go("/setup");
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!authLoaded || !isSignedIn) return;
    api.me().then((me) => {
      if (me.user.email_verified === false) {
        storePendingVerifyEmail(me.user.email);
        go(verifyEmailPath(me.user.email, "signin"));
        return;
      }
      go(invite ? `/invite/${invite}` : "/app");
    }).catch(() => undefined);
  }, [authLoaded, isSignedIn, invite]);

  async function onMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      await signIn.create({
        strategy: "email_link",
        identifier: email.trim(),
        redirectUrl: absoluteUrl("/auth/verify"),
      });
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
        <OAuthButtons invite={invite} />
        <div className="stack gap-3">
          <div className="stack gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy || !isLoaded} className="w-full">
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

export default function Login() {
  const ready = useClerkReady();
  if (!ready) return <ClerkMissingCard />;
  return <LoginInner />;
}
