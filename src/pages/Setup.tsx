import { useEffect, useState } from "react";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { go } from "../lib/nav";
import { tw } from "../lib/tw";

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
    <div className={tw.authShell}>
      <div className={tw.authCard}>
        <a className={tw.brand} href="/" onClick={(e) => { e.preventDefault(); go("/"); }}>
          <BrandMark /> Flap
        </a>
        <h1>Create your workspace</h1>
        <p className={tw.muted}>Opening signup for the first account…</p>
        {err ? <p className={tw.error} role="alert">{err}</p> : null}
        <Button className="w-full mt-4" onClick={() => go("/signup")}>
          Continue to signup
        </Button>
      </div>
    </div>
  );
}
