import { useEffect } from "react";
import { go } from "../lib/nav";

/**
 * Legacy OAuth return URL. Flap is magic-link only; redirect to sign-in.
 * Kept so old bookmarks / Clerk dashboard redirect allowlists do not 404.
 */
export default function SsoCallback() {
  useEffect(() => {
    go("/login");
  }, []);

  return (
    <div className="auth-shell">
      <p className="muted">Redirecting to sign in…</p>
    </div>
  );
}
