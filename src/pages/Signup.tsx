import { useEffect, useRef, useState } from "react";
import { useSignUp } from "@clerk/clerk-react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  authErrorMessage,
  clerkHasErrorCode,
  ClerkMissingCard,
  useClerkReady,
} from "../lib/clerk";
import { track } from "../lib/analytics";
import { go } from "../lib/nav";
import { captureReferralFromUrl, getStoredReferral } from "../lib/seo";

type SignUpLike = NonNullable<ReturnType<typeof useSignUp>["signUp"]>;

function loginWithEmail(email: string, notice: "exists" | "already" = "exists") {
  const q = new URLSearchParams({ email: email.trim(), notice });
  go(`/login?${q.toString()}`);
}

function missingLabel(fields: string[] | undefined): string {
  if (!fields?.length) return "";
  return ` Still needed in Clerk: ${fields.join(", ")}.`;
}

function SignupInner() {
  const { signUp, isLoaded, setActive } = useSignUp();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const verifyInflight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    captureReferralFromUrl();
    setRefCode(getStoredReferral());
    track("signup_started");
  }, []);

  async function activateAndEnter(sessionId: string) {
    if (!setActive) return;
    track("signup_completed", { method: "email_code", referred: Boolean(refCode) });
    if (refCode) track("referral_signup");
    await setActive({ session: sessionId });
    go("/app/domains?onboarding=1&verify=ok");
  }

  /**
   * Email verify can succeed while SignUp stays `missing_requirements`
   * (legal acceptance, password, name, …). Try to close those we can, then activate.
   */
  async function finalizeSignUp(resource: SignUpLike): Promise<"done" | "stuck"> {
    let current = resource;

    const tryActivate = async () => {
      if (current.status === "complete" && current.createdSessionId) {
        await activateAndEnter(current.createdSessionId);
        return true;
      }
      return false;
    };

    if (await tryActivate()) return "done";

    const missing = current.missingFields || [];
    const needsLegal = missing.includes("legal_accepted");
    if (needsLegal || current.status === "missing_requirements") {
      try {
        // User already agreed via the Terms copy on this page.
        current = await current.update({ legalAccepted: true });
      } catch {
        // Ignore — may not be required.
      }
      if (await tryActivate()) return "done";
    }

    // User row may already exist without a session (abandoned prior attempt).
    if (current.createdUserId && !current.createdSessionId) {
      loginWithEmail(email, "exists");
      return "done";
    }

    setErr(
      `Email is verified, but Clerk did not create a session.${missingLabel(current.missingFields)} ` +
        "In Clerk Dashboard → User & authentication: make Password optional/off for sign-up, " +
        "enable Email verification code, and turn off other required fields (name/username) unless you collect them.",
    );
    return "stuck";
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp) return;
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      // legalAccepted up front so verify can reach `complete` when Clerk requires it.
      const created = await signUp.create({
        emailAddress: email.trim(),
        legalAccepted: true,
      });
      if ((await finalizeSignUp(created)) === "done") return;

      const emailStatus = created.verifications?.emailAddress?.status;
      if (emailStatus === "verified") {
        if ((await finalizeSignUp(created)) === "done") return;
        return;
      }

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("code");
      setNotice("We sent a 6-digit code to your email. Enter it below to create your workspace.");
    } catch (error) {
      if (clerkHasErrorCode(error, "form_identifier_exists")) {
        loginWithEmail(email, "exists");
        return;
      }
      // Some instances reject legalAccepted on create if not enabled — retry without it.
      if (clerkHasErrorCode(error, "form_param_unknown") || clerkHasErrorCode(error, "form_param_nil")) {
        try {
          const created = await signUp.create({ emailAddress: email.trim() });
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          setStep("code");
          setNotice("We sent a 6-digit code to your email. Enter it below to create your workspace.");
          void created;
          return;
        } catch (retryErr) {
          if (clerkHasErrorCode(retryErr, "form_identifier_exists")) {
            loginWithEmail(email, "exists");
            return;
          }
          setErr(authErrorMessage(retryErr, "Could not send verification code."));
          return;
        }
      }
      setErr(authErrorMessage(error, "Could not send verification code."));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp || !setActive) return;
    if (verifyInflight.current) {
      await verifyInflight.current;
      return;
    }
    setErr("");
    setBusy(true);

    const run = (async () => {
      try {
        let result: SignUpLike;
        try {
          result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
        } catch (error) {
          if (clerkHasErrorCode(error, "verification_already_verified")) {
            // First attempt (or StrictMode twin) already verified — finish that SignUp.
            result = signUp;
          } else if (clerkHasErrorCode(error, "form_identifier_exists")) {
            loginWithEmail(email, "exists");
            return;
          } else {
            setErr(authErrorMessage(error, "Invalid or expired code."));
            return;
          }
        }
        await finalizeSignUp(result);
      } finally {
        verifyInflight.current = null;
        setBusy(false);
      }
    })();

    verifyInflight.current = run;
    await run;
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={step === "email" ? sendCode : verifyCode}>
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
        <p className="muted">
          {step === "email"
            ? "Enter your work email and we’ll send a one-time code — no password."
            : `Enter the code we sent to ${email}.`}
        </p>
        {refCode ? (
          <p className="muted text-xs">
            Referral applied ({refCode}). Both of you earn +1 domain after you connect a domain.
          </p>
        ) : null}
        {err ? <p className="error" role="alert">{err}</p> : null}
        {notice ? <p className="muted" role="status">{notice}</p> : null}
        <div className="stack gap-3">
          {step === "email" ? (
            <div className="stack gap-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          ) : (
            <div className="stack gap-1.5">
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
                : "Verify and continue"}
          </Button>
          {step === "code" ? (
            <button
              type="button"
              className="auth-password-toggle"
              disabled={busy}
              onClick={() => {
                setStep("email");
                setCode("");
                setNotice("");
                setErr("");
                verifyInflight.current = null;
              }}
            >
              Use a different email
            </button>
          ) : null}
        </div>
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

export default function Signup() {
  const ready = useClerkReady();
  if (!ready) return <ClerkMissingCard />;
  return <SignupInner />;
}
