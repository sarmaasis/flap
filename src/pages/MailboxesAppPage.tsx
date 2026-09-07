import { useEffect, useState } from "react";
import AppFeaturePage, { FeatureEmpty } from "../components/AppFeaturePage";
import { Button } from "../components/ui/button";
import { api, type Mailbox } from "../lib/api";
import { go } from "../lib/nav";

export default function MailboxesAppPage() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    api
      .me()
      .then((me) => setMailboxes(me.mailboxes || []))
      .catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not load mailboxes."));
  }, []);

  return (
    <AppFeaturePage
      current="mailboxes"
      title="Mailboxes"
      subtitle="Each address is its own inbox and login surface. Shared inboxes appear for teammates you grant."
      actions={
        <Button type="button" onClick={() => go("/app/domains")}>
          Add mailbox
        </Button>
      }
    >
      {err ? <p className="error">{err}</p> : null}
      {mailboxes.length === 0 ? (
        <FeatureEmpty
          title="No mailboxes yet"
          body="Create hello@yourdomain.com after DNS verifies. Catch-all and aliases deliver into these inboxes."
          cta="Connect a domain"
          onCta={() => go("/app/domains")}
        />
      ) : (
        <ul className="app-feature-list">
          {mailboxes.map((m) => (
            <li key={m.id}>
              <strong>{m.address}</strong>
              <span className="muted">{m.is_shared ? "Shared" : "Private"}</span>
            </li>
          ))}
        </ul>
      )}
    </AppFeaturePage>
  );
}
