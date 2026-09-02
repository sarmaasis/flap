import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { go } from "../lib/nav";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.setupStatus().then((s) => {
      if (s.needs_setup) go("/setup");
    }).catch(() => undefined);
    api.me().then(() => go("/app")).catch(() => undefined);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api.login(email, password);
      go("/app");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); go("/"); }} style={{ marginBottom: 18 }}>Inlet</a>
        <h1>Sign in</h1>
        <p className="sub">Use the admin you created on this Worker.</p>
        {err ? <div className="err">{err}</div> : null}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
