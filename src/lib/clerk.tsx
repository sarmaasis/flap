import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { setClerkTokenGetter } from "./api";

type BootstrapState =
  | { status: "loading" }
  | { status: "ready"; publishableKey: string }
  | { status: "missing" };

const ClerkReadyContext = createContext(false);

/** True when ClerkProvider is mounted with a publishable key. */
export function useClerkReady() {
  return useContext(ClerkReadyContext);
}

function TokenBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    setClerkTokenGetter(async () => {
      if (!isLoaded) return null;
      try {
        return (await getToken()) || null;
      } catch {
        return null;
      }
    });
    return () => setClerkTokenGetter(null);
  }, [getToken, isLoaded]);

  return <ClerkReadyContext.Provider value={true}>{children}</ClerkReadyContext.Provider>;
}

async function resolvePublishableKey(): Promise<string> {
  const fromVite = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.trim();
  if (fromVite) return fromVite;
  try {
    const res = await fetch("/api/public-config", { credentials: "same-origin" });
    const data = (await res.json().catch(() => ({}))) as { clerkPublishableKey?: string };
    return (data.clerkPublishableKey || "").trim();
  } catch {
    return "";
  }
}

export function FlapClerkProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BootstrapState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void resolvePublishableKey().then((key) => {
      if (cancelled) return;
      setState(key ? { status: "ready", publishableKey: key } : { status: "missing" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="auth-shell">
        <p className="muted">Loading Flap…</p>
      </div>
    );
  }

  // Marketing can render without Clerk; auth screens check useClerkReady().
  if (state.status === "missing") {
    return <ClerkReadyContext.Provider value={false}>{children}</ClerkReadyContext.Provider>;
  }

  return (
    <ClerkProvider publishableKey={state.publishableKey} afterSignOutUrl="/">
      <TokenBridge>{children}</TokenBridge>
    </ClerkProvider>
  );
}

export function ClerkMissingCard() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Clerk is not configured</h1>
        <p className="muted">
          Set <code>CLERK_PUBLISHABLE_KEY</code> and <code>CLERK_SECRET_KEY</code> in{" "}
          <code>.dev.vars</code> (see <code>.dev.vars.example</code>), then restart{" "}
          <code>npm run dev</code>.
        </p>
      </div>
    </div>
  );
}

export function authErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const err = error as { errors?: Array<{ longMessage?: string; message?: string }>; message?: unknown };
    const first = err.errors?.[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
    if (typeof err.message === "string" && err.message) return err.message;
  }
  return fallback;
}

export function absoluteUrl(path: string): string {
  const origin = window.location.origin.replace(/\/$/, "");
  return path.startsWith("http") ? path : `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
