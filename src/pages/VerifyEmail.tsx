import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { authErrorMessage, ClerkMissingCard, useClerkReady } from "../lib/clerk";
import { go } from "../lib/nav";
import { tw } from "../lib/tw";
import { cn } from "../lib/utils";
import {
  readPendingVerifyEmail,
  storePendingVerifyEmail,
} from "../lib/verify-email";

function VerifyEmailInner() {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [reason, setReason] = useState<"signup" | "signin" | "">("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingCode, setAwaitingCode] = useState(false);

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
  }, []);

  useEffect(() => {
    if (!authLoaded || !userLoaded) return;
    if (user?.primaryEmailAddress?.verification?.status === "verified") {
      go("/app");
    }
    if (user?.primaryEmailAddress?.emailAddress) {
      setEmail(user.primaryEmailAddress.emailAddress);
    }
  }, [authLoaded, userLoaded, user]);

  async function sendCode() {
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      if (!isSignedIn || !user?.primaryEmailAddress) {
        setErr("Sign in first, then request a code — or use /login.");
        return;
      }
      const addr = user.primaryEmailAddress;
      await addr.prepareVerification({ strategy: "email_code" });
      storePendingVerifyEmail(addr.emailAddress);
      setAwaitingCode(true);
      setNotice("Verification code sent. Check your inbox (and spam).");
    } catch (ex) {
      setErr(authErrorMessage(ex, "Could not send verification code."));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (!isSignedIn || !user?.primaryEmailAddress) {
        setErr("Sign in first, then enter the code.");
        return;
      }
      await user.primaryEmailAddress.attemptVerification({ code: code.trim() });
      go("/app");
    } catch (ex) {
      setErr(authErrorMessage(ex, "Invalid or expired code."));
    } finally {
      setBusy(false);
    }
  }

  const headline =
    reason === "signin" ? "Verify your email to sign in" : "Verify your email";

  const blurb =
    reason === "signin"
      ? "This account still needs email verification before you can open Flap. Request a code below."
      : "Enter the one-time code from your email to finish verification.";

  return (
    <div className={tw.authShell}>
      <form className={tw.authCard} onSubmit={(e) => void (awaitingCode ? verifyCode(e) : (e.preventDefault(), sendCode()))}>
        <a
          className={tw.brand}
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go("/");
          }}
        >
          <BrandMark /> Flap
        </a>
        <h1>{headline}</h1>
        <p className={tw.muted}>{blurb}</p>
        {err ? <p className={tw.error} role="alert">{err}</p> : null}
        {notice ? <p className={tw.muted} role="status">{notice}</p> : null}
        <div className={cn("gap-3", tw.stack)} style={{ marginTop: 16 }}>
          <div className={cn("gap-1.5", tw.stack)}>
            <Label htmlFor="verify-email">Email</Label>
            <Input
              id="verify-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={Boolean(user?.primaryEmailAddress)}
            />
          </div>
          {awaitingCode ? (
            <div className={cn("gap-1.5", tw.stack)}>
              <Label htmlFor="verify-code">Verification code</Label>
              <Input
                id="verify-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                minLength={6}
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
              />
            </div>
          ) : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy
              ? awaitingCode
                ? "Verifying…"
                : "Sending…"
              : awaitingCode
                ? "Verify code"
                : "Send verification code"}
          </Button>
          <button type="button" className={tw.authPasswordToggle} onClick={() => go("/login")}>
            Back to sign in
          </button>
        </div>
      </form>
    </div>
  );
}

export default function VerifyEmail() {
  const ready = useClerkReady();
  if (!ready) return <ClerkMissingCard />;
  return <VerifyEmailInner />;
}
