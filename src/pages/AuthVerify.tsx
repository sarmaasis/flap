import { useEffect, useState } from "react";
import { useClerk } from "@clerk/clerk-react";
import { ClerkMissingCard, useClerkReady } from "../lib/clerk";
import { go } from "../lib/nav";

function AuthVerifyInner() {
  const clerk = useClerk();
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!clerk.loaded) return;
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const rawNext = params.get("next") || "/app";
    const next = rawNext.startsWith("/") ? rawNext : "/app";

    void clerk
      .handleEmailLinkVerification({
        redirectUrlComplete: `${window.location.origin}${next}`,
      })
      .then(() => {
        if (!cancelled) go(next);
      })
      .catch((ex) => {
        if (cancelled) return;
        setErr(ex instanceof Error ? ex.message : "Could not verify the email link.");
      });

    return () => {
      cancelled = true;
    };
  }, [clerk, clerk.loaded]);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Verifying…</h1>
        {err ? (
          <>
            <p className="error" role="alert">{err}</p>
            <button type="button" className="auth-password-toggle" onClick={() => go("/login")}>
              Back to sign in
            </button>
          </>
        ) : (
          <p className="muted">Confirming your magic link…</p>
        )}
      </div>
    </div>
  );
}

/** Completes Clerk email-link verification then routes into the app. */
export default function AuthVerify() {
  const ready = useClerkReady();
  if (!ready) return <ClerkMissingCard />;
  return <AuthVerifyInner />;
}
