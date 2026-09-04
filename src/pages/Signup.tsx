import { useEffect, useState } from "react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { api } from "../lib/api";
import { authClient, authErrorMessage } from "../lib/auth-client";
import { track } from "../lib/analytics";
import { go } from "../lib/nav";
import { captureReferralFromUrl, getStoredReferral } from "../lib/seo";

function OAuthButtons() {
  const [providers, setProviders] = useState<{ google: boolean; github: boolean }>({ google: false, github: false });
  useEffect(() => {
    api.authProviders().then(setProviders).catch(() => undefined);
  }, []);
  if (!providers.google && !providers.github) return null;

  async function social(provider: "google" | "github") {
    await authClient.signIn.social({
      provider,
      callbackURL: "/app/settings?tab=setup&onboarding=1",
    });
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
      <div className="auth-divider"><span>or create with email</span></div>
    </div>
  );
}

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [refCode, setRefCode] = useState<string | null>(null);

  useEffect(() => {
    captureReferralFromUrl();
    setRefCode(getStoredReferral());
    track("signup_started");
  }, []);

  async function onMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      const { error } = await authClient.signIn.magicLink({
        email,
        callbackURL: "/app/settings?tab=setup&onboarding=1&verify=ok",
        newUserCallbackURL: "/app/settings?tab=setup&onboarding=1&verify=ok",
        errorCallbackURL: "/signup?error=magic",
      });
      if (error) throw error;
      track("signup_completed", { method: "magic_link", referred: Boolean(refCode) });
      if (refCode) track("referral_signup");
      setNotice("Check your email for a sign-in link to finish creating your workspace.");
    } catch (error) {
      setErr(authErrorMessage(error, "Could not send magic link."));
    } finally {
      setBusy(false);
    }
  }

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      const { error } = await authClient.signUp.email({
        email,
        password,
        name: email.split("@")[0] || "Founder",
        callbackURL: "/app/settings?tab=setup&onboarding=1&verify=ok",
      });
      if (error) throw error;
      track("signup_completed", { method: "password", referred: Boolean(refCode) });
      if (refCode) track("referral_signup");
      go("/app/settings?tab=setup&onboarding=1&verify=sent");
    } catch (error) {
      setErr(authErrorMessage(error, "Could not create account."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={mode === "magic" ? onMagicLink : onPassword}>
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
        <p className="muted">One inbox for every startup you build. Start free — add domains when you launch.</p>
        {refCode ? (
          <p className="muted text-xs">
            Referral applied ({refCode}). Both of you earn +1 domain after you connect a domain.
          </p>
        ) : null}
        {err ? <p className="error" role="alert">{err}</p> : null}
        {notice ? <p className="muted" role="status">{notice}</p> : null}
        <OAuthButtons />
        <div className="stack gap-3">
          <div className="stack gap-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode === "password" ? (
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
          ) : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy
              ? mode === "magic"
                ? "Sending link…"
                : "Creating…"
              : mode === "magic"
                ? "Continue with magic link"
                : "Start free with email"}
          </Button>
        </div>
        <button
          type="button"
          className="auth-password-toggle"
          onClick={() => {
            setMode((m) => (m === "magic" ? "password" : "magic"));
            setErr("");
            setNotice("");
          }}
        >
          {mode === "magic" ? "Continue with email & password" : "Use a magic link instead"}
        </button>
        <p className="muted mt-4 text-xs leading-relaxed">
          By continuing you agree to the{" "}
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
