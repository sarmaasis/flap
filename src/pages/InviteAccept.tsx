import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { ClerkMissingCard, useClerkReady } from "../lib/clerk";
import { go } from "../lib/nav";
import { tw } from "../lib/tw";
import { cn } from "../lib/utils";

function InviteAcceptInner() {
  const token = window.location.pathname.split("/invite/")[1] || "";
  const { isSignedIn, isLoaded } = useAuth();
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
    <div className={tw.authShell}>
      <div className={tw.authCard}>
        <a className={tw.brand} href="/" onClick={(e) => { e.preventDefault(); go("/"); }}>
          <BrandMark /> Flap
        </a>
        <h1>Join workspace</h1>
        {invite ? (
          <p className={tw.muted}>
            {invite.inviter_email || "A teammate"} invited <strong>{invite.email}</strong> as{" "}
            <strong>{invite.role}</strong>.
          </p>
        ) : (
          <p className={tw.muted}>Loading invite…</p>
        )}
        {err ? <p className={tw.error} role="alert">{err}</p> : null}
        {invite && invite.status === "pending" ? (
          isLoaded && isSignedIn ? (
            <Button className="w-full mt-4" disabled={busy} onClick={() => void accept()}>
              {busy ? "Joining…" : "Accept invite"}
            </Button>
          ) : (
            <div className={cn("gap-2 mt-4", tw.stack)}>
              <Button asChild className="w-full">
                <a href={`/login?invite=${encodeURIComponent(token)}`}>Sign in with email code</a>
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
