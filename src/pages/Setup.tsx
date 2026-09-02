import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { go } from "../lib/nav";

export default function Setup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.setupStatus().then((s) => {
      if (!s.needs_setup) go("/login");
    }).catch(() => undefined);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api.setup(email, password);
      go("/app/settings");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Setup failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); go("/"); }} style={{ marginBottom: 18 }}>Inlet</a>
        <h1>Create the admin</h1>
        <p className="sub">First run only. This account signs in to the inbox and owns domains you add.</p>
        {err ? <div className="err">{err}</div> : null}
        <div className="field">
          <label htmlFor="email">Admin email</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Creating…" : "Create admin"}
        </button>
      </form>
    </div>
  );
}
