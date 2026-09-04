import { useEffect, useState } from "react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { authClient, authErrorMessage } from "../lib/auth-client";
import { go } from "../lib/nav";
import {
  readPendingVerifyEmail,
  storePendingVerifyEmail,
} from "../lib/verify-email";

export default function VerifyEmail() {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState<"signup" | "signin" | "">("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = (params.get("email") || "").trim().toLowerCase();
    const fromStore = readPendingVerifyEmail();
    const next = fromQuery || fromStore;
    if (next) {
      setEmail(next);
      storePendingVerifyEmail(next);
    }
    const r = params.get("reason");
    if (r === "signup" || r === "signin") setReason(r);

    void authClient.getSession().then(({ data }) => {
      if (data?.user?.emailVerified) go("/app");
    });
  }, []);

  async function resend() {
    const target = email.trim().toLowerCase();
    if (!target) {
      setErr("Enter the email you signed up with.");
      return;
    }
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email: target,
        callbackURL: "/app/settings?tab=setup&onboarding=1&verify=ok",
      });
      if (error) throw error;
      storePendingVerifyEmail(target);
      setNotice("Verification email sent. Check your inbox (and spam) — the link expires in 48 hours.");
    } catch (ex) {
      setErr(authErrorMessage(ex, "Could not resend verification email."));
    } finally {
      setBusy(false);
    }
  }

  const headline =
    reason === "signin" ? "Verify your email to sign in" : "Check your email to verify";

  const blurb =
    reason === "signin"
      ? "Your password is correct, but this account still needs email verification before you can open Flap."
      : "We created your account. Open the verification link we sent, then you can use the app.";

  return (
    <div className="auth-shell">
      <div className="auth-card">
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
        <h1>{headline}</h1>
        <p className="muted">{blurb}</p>
        {err ? <p className="error" role="alert">{err}</p> : null}
        {notice ? <p className="muted" role="status">{notice}</p> : null}
        <div className="stack gap-3" style={{ marginTop: 16 }}>
          <div className="stack gap-1.5">
            <Label htmlFor="verify-email">Email</Label>
            <Input
              id="verify-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="button" disabled={busy} className="w-full" onClick={() => void resend()}>
            {busy ? "Sending…" : "Resend verification email"}
          </Button>
          <button type="button" className="auth-password-toggle" onClick={() => go("/login")}>
            Back to sign in
          </button>
        </div>
        <p className="muted mt-4 text-xs leading-relaxed">
          Prefer a faster path next time?{" "}
          <a
            href="/login"
            onClick={(e) => {
              e.preventDefault();
              go("/login");
            }}
          >
            Use a magic link
          </a>{" "}
          — it signs you in and verifies your email in one click.
        </p>
      </div>
    </div>
  );
}
