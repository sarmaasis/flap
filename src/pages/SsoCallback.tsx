import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import { ClerkMissingCard, useClerkReady } from "../lib/clerk";

function SsoCallbackInner() {
  return (
    <div className="auth-shell">
      <p className="muted">Finishing sign-in…</p>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}

/** OAuth return URL for Clerk authenticateWithRedirect. */
export default function SsoCallback() {
  const ready = useClerkReady();
  if (!ready) return <ClerkMissingCard />;
  return <SsoCallbackInner />;
}
