import { useEffect, useState } from "react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { go } from "../lib/nav";

export default function InviteAccept() {
  const token = window.location.pathname.split("/invite/")[1] || "";
  const [invite, setInvite] = useState<{
    email: string;
    role: string;
    status: string;
    inviter_email?: string;
  } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!token) {
      setErr("Invalid invite link.");
      return;
    }
    api.invitePreview(token).then((r) => setInvite(r.invite)).catch((ex) => {
      setErr(ex instanceof Error ? ex.message : "Invite not found.");
    });
    api.me().then(() => setSignedIn(true)).catch(() => setSignedIn(false));
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
          signedIn ? (
            <Button className="w-full mt-4" disabled={busy} onClick={() => void accept()}>
              {busy ? "Joining…" : "Accept invite"}
            </Button>
          ) : (
            <div className="stack gap-2 mt-4">
              <a className="btn oauth-btn" href={`/api/auth/google?invite=${encodeURIComponent(token)}`}>
                Continue with Google
              </a>
              <a className="btn oauth-btn oauth-btn-secondary" href={`/login`}>
                Sign in first
              </a>
              <a className="btn oauth-btn oauth-btn-secondary" href={`/signup`}>
                Create account
              </a>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
