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

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const ORIGIN_BOUNCE_KEY = "flap:origin-bounce";

function readBounced(): string {
  try {
    return sessionStorage.getItem(ORIGIN_BOUNCE_KEY) || "";
  } catch {
    return "";
  }
}

function markBounced(origin: string) {
  try {
    sessionStorage.setItem(ORIGIN_BOUNCE_KEY, origin);
  } catch {
    /* private mode — bounce simply stays un-tracked */
  }
}

/**
 * Clerk magic-link cookies are host-scoped. localhost and 127.0.0.1 are different sites.
 * If APP_URL prefers one and the user opened the other, bounce before starting Clerk.
 *
 * Bounces once per tab. The preferred host is only a config value, so it may not be
 * listening; if we land back here the target is dead and rendering on the origin that
 * demonstrably works beats stranding the user on a connection error.
 */
export function maybeRedirectToAppOrigin(appUrl: string): boolean {
  const preferredRaw = appUrl.trim();
  if (!preferredRaw) return false;
  try {
    const preferred = new URL(preferredRaw.includes("://") ? preferredRaw : `http://${preferredRaw}`);
    const current = new URL(window.location.href);
    if (!LOCAL_HOSTS.has(preferred.hostname) || !LOCAL_HOSTS.has(current.hostname)) return false;
    if (preferred.hostname === current.hostname) return false;
    const preferredPort = preferred.port || (preferred.protocol === "https:" ? "443" : "80");
    const currentPort = current.port || (current.protocol === "https:" ? "443" : "80");
    if (preferredPort !== currentPort) return false;
    if (readBounced() === preferred.origin) return false;
    markBounced(preferred.origin);
    const target = `${preferred.protocol}//${preferred.host}${current.pathname}${current.search}${current.hash}`;
    window.location.replace(target);
    return true;
  } catch {
    return false;
  }
}

async function resolveBootstrap(): Promise<{ publishableKey: string; appUrl: string }> {
  const fromVite = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.trim();
  try {
    const res = await fetch("/api/public-config", { credentials: "same-origin" });
    const data = (await res.json().catch(() => ({}))) as {
      clerkPublishableKey?: string;
      appUrl?: string;
    };
    return {
      publishableKey: (fromVite || data.clerkPublishableKey || "").trim(),
      appUrl: (data.appUrl || "").trim(),
    };
  } catch {
    return { publishableKey: fromVite || "", appUrl: "" };
  }
}

export function FlapClerkProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BootstrapState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void resolveBootstrap().then(({ publishableKey, appUrl }) => {
      if (cancelled) return;
      if (maybeRedirectToAppOrigin(appUrl)) return;
      setState(publishableKey ? { status: "ready", publishableKey } : { status: "missing" });
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
    <ClerkProvider
      publishableKey={state.publishableKey}
      afterSignOutUrl="/"
      signInUrl="/login"
      signUpUrl="/signup"
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app/domains?onboarding=1"
    >
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

/** Clerk Frontend API error codes from a thrown response-shaped object. */
export function clerkErrorCodes(error: unknown): string[] {
  if (!error || typeof error !== "object") return [];
  const errors = (error as { errors?: Array<{ code?: string }> }).errors;
  if (!Array.isArray(errors)) return [];
  return errors.map((e) => e.code).filter((c): c is string => Boolean(c));
}

export function clerkHasErrorCode(error: unknown, code: string): boolean {
  return clerkErrorCodes(error).includes(code);
}

/** Wait until Clerk can mint a session JWT (avoids refresh race → /login). */
export async function waitForClerkToken(
  getToken: () => Promise<string | null | undefined>,
  attempts = 20,
  delayMs = 75,
): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const token = (await getToken()) || null;
      if (token) return token;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

/** Magic-link redirectUrl must use the current origin so Clerk cookies match. */
export function absoluteUrl(path: string): string {
  const origin = window.location.origin.replace(/\/$/, "");
  return path.startsWith("http") ? path : `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
