import { useEffect, useState, type ReactNode } from "react";
import { useClerk } from "@clerk/clerk-react";
import { EmailLinkErrorCodeStatus, isEmailLinkError } from "@clerk/clerk-react/errors";
import BrandMark from "../components/BrandMark";
import { ClerkMissingCard, useClerkReady } from "../lib/clerk";
import { go } from "../lib/nav";
import { tw } from "../lib/tw";
import { cn } from "../lib/utils";

type VerifyStatus = "loading" | "verified" | "failed" | "expired" | "client_mismatch";

/** Shared across StrictMode remounts so the email-link token is consumed once. */
let inflightKey: string | null = null;
let inflight: Promise<void> | null = null;

function readStatusFromUrl(): VerifyStatus | null {
  const raw = new URLSearchParams(window.location.search).get("__clerk_status");
  if (raw === "verified") return "verified";
  if (raw === "expired") return "expired";
  if (raw === "failed") return "failed";
  if (raw === "client_mismatch") return "client_mismatch";
  return null;
}

function safeNextPath(): string {
  const rawNext = new URLSearchParams(window.location.search).get("next") || "/app";
  return rawNext.startsWith("/") ? rawNext : "/app";
}

function VerifyCard({
  status,
  children,
}: {
  status: VerifyStatus;
  children?: ReactNode;
}) {
  const title =
    status === "loading"
      ? "Verifying…"
      : status === "verified"
        ? "Signed in"
        : status === "expired"
          ? "Link expired"
          : status === "client_mismatch"
            ? "Use an email code instead"
            : "Verification failed";

  const body =
    status === "loading"
      ? "Confirming your magic link…"
      : status === "verified"
        ? "Taking you into Flap…"
        : status === "expired"
          ? "This magic link has expired. Request a new one from sign in."
          : status === "client_mismatch"
            ? "Email links are no longer used for sign-in. Go back and request a one-time code on the sign-in page instead — it works in any browser."
            : "This email link could not be verified. Sign in with a one-time code instead.";

  const isError = status === "failed" || status === "expired" || status === "client_mismatch";

  return (
    <div className={tw.authShell}>
      <div className={tw.authCard}>
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
        <h1>{title}</h1>
        <p className={isError ? tw.error : tw.muted} role={status === "loading" ? "status" : "alert"}>
          {body}
        </p>
        {children}
        {isError ? (
          <div className={cn("gap-2", tw.stack)} style={{ marginTop: 16 }}>
            <button type="button" className={tw.authPasswordToggle} onClick={() => go("/login")}>
              Back to sign in
            </button>
            <button type="button" className={tw.authPasswordToggle} onClick={() => go("/signup")}>
              Create a workspace
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AuthVerifyInner() {
  const clerk = useClerk();
  const [status, setStatus] = useState<VerifyStatus>(() => readStatusFromUrl() || "loading");
  const next = safeNextPath();

  useEffect(() => {
    const urlStatus = readStatusFromUrl();

    // Clerk already resolved the link to a terminal status — show recovery UI, do not re-verify.
    if (urlStatus && urlStatus !== "verified") {
      setStatus(urlStatus);
      return;
    }

    if (!clerk.loaded) return;

    if (clerk.session) {
      setStatus("verified");
      go(next);
      return;
    }

    // URL says verified but no session yet — wait briefly then recover.
    if (urlStatus === "verified") {
      setStatus("verified");
      const t = window.setTimeout(() => {
        if (clerk.session || clerk.user) go(next);
        else go("/login");
      }, 800);
      return () => window.clearTimeout(t);
    }

    const verifyKey = window.location.search || "default";
    let cancelled = false;

    if (inflightKey !== verifyKey || !inflight) {
      inflightKey = verifyKey;
      inflight = clerk
        .handleEmailLinkVerification({
          redirectUrlComplete: `${window.location.origin}${next}`,
        })
        .then(() => undefined);
    }

    void inflight
      .then(() => {
        if (cancelled) return;
        setStatus("verified");
        go(next);
      })
      .catch((ex) => {
        if (cancelled) return;
        if (clerk.session || clerk.user) {
          setStatus("verified");
          go(next);
          return;
        }
        let nextStatus: VerifyStatus = "failed";
        if (isEmailLinkError(ex)) {
          if (ex.code === EmailLinkErrorCodeStatus.Expired) nextStatus = "expired";
          else if (ex.code === EmailLinkErrorCodeStatus.ClientMismatch) nextStatus = "client_mismatch";
          else if (ex.code === EmailLinkErrorCodeStatus.Failed) nextStatus = "failed";
        }
        setStatus(nextStatus);
      });

    return () => {
      cancelled = true;
    };
  }, [clerk, clerk.loaded, clerk.session, clerk.user, next]);

  return <VerifyCard status={status} />;
}

/**
 * Completes Clerk email-link verification then routes into the app.
 * Always renders UI — terminal `__clerk_status` values do not need Clerk loaded.
 */
export default function AuthVerify() {
  const ready = useClerkReady();
  const urlStatus = readStatusFromUrl();

  // Prefer immediate recovery UI so client_mismatch never depends on Clerk boot / CSP.
  if (urlStatus === "client_mismatch" || urlStatus === "expired" || urlStatus === "failed") {
    return <VerifyCard status={urlStatus} />;
  }

  if (!ready) return <ClerkMissingCard />;
  return <AuthVerifyInner />;
}
