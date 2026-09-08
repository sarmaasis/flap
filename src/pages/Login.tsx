import { useEffect, useState } from "react";
import { useAuth, useSignIn } from "@clerk/clerk-react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { api } from "../lib/api";
import {
  authErrorMessage,
  clerkHasErrorCode,
  ClerkMissingCard,
  useClerkReady,
} from "../lib/clerk";
import { go } from "../lib/nav";
import { storePendingVerifyEmail, verifyEmailPath } from "../lib/verify-email";
import { tw } from "../lib/tw";
import { cn } from "../lib/utils";

function LoginInner() {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { signIn, isLoaded, setActive } = useSignIn();
  const params = new URLSearchParams(window.location.search);
  const [email, setEmail] = useState(() => (params.get("email") || "").trim());
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState(() => {
    const n = params.get("notice");
    if (n === "exists") return "That email already has an account. Sign in with a code.";
    if (n === "already") return "That email is already verified in Clerk. Sign in with a fresh code.";
    return "";
  });
  const [busy, setBusy] = useState(false);
  const invite = params.get("invite") || undefined;

  useEffect(() => {
    if (params.get("error")) setErr("Sign-in failed. Try again or request a new code.");
    api.setupStatus().then((s) => {
      if (s.needs_setup) go("/setup");
    }).catch(() => undefined);
    // Intentionally once on mount for query-driven notices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      const created = await signIn.create({ identifier: email.trim() });
      const emailCodeFactor = created.supportedFirstFactors?.find(
        (f): f is Extract<typeof f, { strategy: "email_code" }> => f.strategy === "email_code",
      );
      if (!emailCodeFactor?.emailAddressId) {
        setErr(
          "Email code sign-in is not enabled. In Clerk Dashboard enable Email verification code (User & authentication → Email).",
        );
        return;
      }
      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: emailCodeFactor.emailAddressId,
      });
      setStep("code");
      setNotice("We sent a 6-digit code to your email. It expires in a few minutes.");
    } catch (ex) {
      if (clerkHasErrorCode(ex, "form_identifier_not_found")) {
        setErr("No account for that email yet.");
        return;
      }
      setErr(authErrorMessage(ex, "Could not send sign-in code."));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn || !setActive) return;
    setErr("");
    setBusy(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "email_code",
        code: code.trim(),
      });
      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        return;
      }
      setErr("Could not complete sign-in. Request a new code.");
    } catch (ex) {
      if (clerkHasErrorCode(ex, "verification_already_verified") && signIn.createdSessionId) {
        await setActive({ session: signIn.createdSessionId });
        return;
      }
      setErr(authErrorMessage(ex, "Invalid or expired code."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={tw.authShell}>
      <form className={tw.authCard} onSubmit={step === "email" ? sendCode : verifyCode}>
        <a className={tw.brand} href="/" onClick={(e) => { e.preventDefault(); go("/"); }}>
          <BrandMark /> Flap
        </a>
        <h1>Sign in</h1>
        <p className={tw.muted}>
          {step === "email"
            ? "Enter your email and we’ll send a one-time code — no password."
            : `Enter the code we sent to ${email}.`}
        </p>
        {err ? <p className={tw.error} role="alert">{err}</p> : null}
        {notice ? <p className={tw.muted} role="status">{notice}</p> : null}
        <div className={cn("gap-3", tw.stack)}>
          {step === "email" ? (
            <div className={cn("gap-1.5", tw.stack)}>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          ) : (
            <div className={cn("gap-1.5", tw.stack)}>
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
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
          )}
          <Button type="submit" disabled={busy || !isLoaded} className="w-full">
            {busy
              ? step === "email"
                ? "Sending code…"
                : "Verifying…"
              : step === "email"
                ? "Email me a code"
                : "Verify and sign in"}
          </Button>
          {step === "code" ? (
            <button
              type="button"
              className={tw.authPasswordToggle}
              disabled={busy}
              onClick={() => {
                setStep("email");
                setCode("");
                setNotice("");
                setErr("");
              }}
            >
              Use a different email
            </button>
          ) : null}
        </div>
        <p className={cn("mt-4 text-sm", tw.muted)}>
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
