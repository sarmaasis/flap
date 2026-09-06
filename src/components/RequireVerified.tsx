import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { go } from "../lib/nav";
import { storePendingVerifyEmail, verifyEmailPath } from "../lib/verify-email";

/**
 * Blocks /app until Better Auth reports emailVerified.
 * Magic-link / OAuth users are verified on first successful sign-in.
 */
export default function RequireVerified({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        if (me.user.email_verified === false) {
          storePendingVerifyEmail(me.user.email);
          go(verifyEmailPath(me.user.email, "signin"));
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) go("/login");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="auth-shell">
        <p className="muted">Loading Flap…</p>
      </div>
    );
  }

  return children;
}
