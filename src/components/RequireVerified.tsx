import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../lib/api";
import { waitForClerkToken } from "../lib/clerk";
import { go } from "../lib/nav";
import { storePendingVerifyEmail, verifyEmailPath } from "../lib/verify-email";
import { tw } from "../lib/tw";

/**
 * Blocks /app until Clerk reports a verified email (via /api/me).
 * Waits for Clerk session before calling the API so a browser refresh
 * does not race an empty token into /login.
 */
export default function RequireVerified({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      go("/login");
      return;
    }

    let cancelled = false;
    void (async () => {
      const token = await waitForClerkToken(() => getToken());
      if (cancelled) return;
      if (!token) {
        go("/login");
        return;
      }
      try {
        const me = await api.me();
        if (cancelled) return;
        if (me.user.email_verified === false) {
          storePendingVerifyEmail(me.user.email);
          go(verifyEmailPath(me.user.email, "signin"));
          return;
        }
        setReady(true);
      } catch {
        if (!cancelled) go("/login");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded || !ready) {
    return (
      <div className={tw.authShell}>
        <p className={tw.muted}>Loading Flap…</p>
      </div>
    );
  }

  return children;
}
