import { useState } from "react";
import { api } from "../lib/api";
import { go } from "../lib/nav";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export default function ProjectWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New project in 60 seconds</DialogTitle>
          <DialogDescription>
            Add domain, copy DNS, create hello@ + support@, turn on catch-all, send a test.
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="space-y-3 text-sm">
            <p>
              Wizard started for <strong>{domain}</strong>. Finish DNS in Setup.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={() => go("/app/domains?wizard=1")}>Open Setup</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wiz-domain">Domain</Label>
              <Input
                id="wiz-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="newproject.com"
                required
              />
            </div>
            {err ? <p className="text-sm text-[var(--danger)]">{err}</p> : null}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={busy || !domain.trim()} onClick={() => void start()}>
                {busy ? "Starting…" : "Start"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
