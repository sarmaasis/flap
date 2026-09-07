import { useEffect, useState } from "react";
import { useAuth, useSignIn } from "@clerk/clerk-react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { absoluteUrl, ClerkMissingCard, useClerkReady } from "../lib/clerk";
import { go } from "../lib/nav";

function InviteAcceptInner() {
  const token = window.location.pathname.split("/invite/")[1] || "";
  const { isSignedIn, isLoaded } = useAuth();
  const { signIn } = useSignIn();
  const [invite, setInvite] = useState<{
    email: string;
    role: string;
    status: string;
    inviter_email?: string;
  } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setErr("Invalid invite link.");
      return;
    }
    api.invitePreview(token).then((r) => setInvite(r.invite)).catch((ex) => {
      setErr(ex instanceof Error ? ex.message : "Invite not found.");
    });
  }, [token]);

  async function accept() {
    setBusy(true);
    setErr("");
    try {
      await api.acceptInvite(token);
      go("/app/settings?tab=team&joined=1");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not accept invite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); go("/"); }}>
          <BrandMark /> Flap
        </a>
        <h1>Join workspace</h1>
        {invite ? (
          <p className="muted">
            {invite.inviter_email || "A teammate"} invited <strong>{invite.email}</strong> as{" "}
            <strong>{invite.role}</strong>.
          </p>
        ) : (
          <p className="muted">Loading invite…</p>
        )}
        {err ? <p className="error" role="alert">{err}</p> : null}
        {invite && invite.status === "pending" ? (
          isLoaded && isSignedIn ? (
            <Button className="w-full mt-4" disabled={busy} onClick={() => void accept()}>
              {busy ? "Joining…" : "Accept invite"}
            </Button>
          ) : (
            <div className="stack gap-2 mt-4">
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  void signIn?.authenticateWithRedirect({
                    strategy: "oauth_google",
                    redirectUrl: absoluteUrl("/sso-callback"),
                    redirectUrlComplete: absoluteUrl(`/invite/${token}`),
                  });
                }}
              >
                Continue with Google
              </Button>
              <Button asChild variant="outline" className="w-full">
                <a href={`/login?invite=${encodeURIComponent(token)}`}>Sign in first</a>
              </Button>
              <Button asChild variant="secondary" className="w-full">
                <a href={`/signup`}>Create account</a>
              </Button>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

export default function InviteAccept() {
  const ready = useClerkReady();
  if (!ready) return <ClerkMissingCard />;
  return <InviteAcceptInner />;
}
