import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { api } from "../lib/api";
import { go } from "../lib/nav";

export default function ProjectWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  if (!open) return null;

  async function start() {
    setBusy(true);
    setErr("");
    try {
      await api.wizardNewProject({
        domain,
        create_hello: true,
        create_support: true,
        catch_all: true,
      });
      // Best-effort: add domain if API exists
      try {
        await api.createDomain(domain);
      } catch {
        /* Settings flow continues */
      }
      setDone(true);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not start wizard.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal max-w-lg p-6">
        <h2 className="text-lg font-semibold">New project in 60 seconds</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Add domain, copy DNS, create hello@ + support@, turn on catch-all, send a test.
        </p>
        {done ? (
          <div className="mt-4 space-y-3 text-sm">
            <p>Wizard started for <strong>{domain}</strong>. Finish DNS in Setup.</p>
            <Button onClick={() => go("/app/settings?tab=setup&wizard=1")}>Open Setup</Button>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wiz-domain">Domain</Label>
              <Input id="wiz-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="newproject.com" required />
            </div>
            {err ? <p className="text-sm text-red-700">{err}</p> : null}
            <div className="flex gap-2">
              <Button disabled={busy || !domain.trim()} onClick={() => void start()}>
                {busy ? "Starting…" : "Start"}
              </Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
