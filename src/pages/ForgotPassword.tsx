import { useState } from "react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { authClient, authErrorMessage } from "../lib/auth-client";
import { go } from "../lib/nav";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      if (error) throw error;
      setNotice("If that email has a password account, we sent a reset link. It expires soon.");
    } catch (ex) {
      setErr(authErrorMessage(ex, "Could not send reset email."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); go("/"); }}>
          <BrandMark /> Flap
        </a>
        <h1>Reset password</h1>
        <p className="muted">We’ll email a link to set a new password for your Flap account.</p>
        {err ? <p className="error" role="alert">{err}</p> : null}
        {notice ? <p className="muted" role="status">{notice}</p> : null}
        <div className="stack gap-3">
          <div className="stack gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
        </div>
        <p className="muted" style={{ marginTop: 16 }}>
          <a href="/login" onClick={(e) => { e.preventDefault(); go("/login"); }}>Back to sign in</a>
        </p>
      </form>
    </div>
  );
}
