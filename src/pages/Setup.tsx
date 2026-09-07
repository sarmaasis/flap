import { useEffect, useState } from "react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { go } from "../lib/nav";

/** First-boot: redirect into Clerk signup once the deployment has no users. */
export default function Setup() {
  const [err, setErr] = useState("");

  useEffect(() => {
    api
      .setupStatus()
      .then((s) => {
        if (!s.needs_setup) {
          go("/login");
          return;
        }
        go("/signup");
      })
      .catch(() => setErr("Could not check setup status."));
  }, []);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); go("/"); }}>
          <BrandMark /> Flap
        </a>
        <h1>Create your workspace</h1>
        <p className="muted">Opening signup for the first account…</p>
        {err ? <p className="error" role="alert">{err}</p> : null}
        <Button className="w-full mt-4" onClick={() => go("/signup")}>
          Continue to signup
        </Button>
      </div>
    </div>
  );
}
