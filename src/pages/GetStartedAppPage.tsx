import { useEffect, useState } from "react";
import AppFeaturePage from "../components/AppFeaturePage";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { go } from "../lib/nav";

const STEPS = [
  { id: "domain", label: "Add a domain", href: "/app/domains" },
  { id: "dns", label: "Publish DNS records", href: "/app/domains" },
  { id: "mailbox", label: "Create an address", href: "/app/mailboxes" },
  { id: "test", label: "Send & receive a test", href: "/app" },
] as const;

export default function GetStartedAppPage() {
  const [done, setDone] = useState({ domain: false, dns: false, mailbox: false });

  useEffect(() => {
    api
      .me()
      .then(async (me) => {
        const domains = await api.domains().catch(() => ({ domains: [] }));
        setDone({
          domain: domains.domains.length > 0,
          dns: domains.domains.some(d => Boolean(d.mx_verified_at && d.identity_verified_at)),
          mailbox: (me.mailboxes || []).length > 0,
        });
      })
      .catch(() => undefined);
  }, []);

  return (
    <AppFeaturePage
      current="get-started"
      title="Get started"
      subtitle="Connect your domain, create mailboxes, then explore calendar, newsletters, bookings, and the AI assistant."
    >
      <ol className="setup-steps">
        {STEPS.map((s, i) => {
          const complete =
            (s.id === "domain" && done.domain) ||
            (s.id === "mailbox" && done.mailbox) ||
            (s.id === "dns" && done.dns);
          return (
            <li key={s.id} className={complete ? "complete" : i === 0 || done.domain ? "current" : ""}>
              <span>{i + 1}</span>
              <div>
                <strong>{s.label}</strong>
                <small>
                  <button type="button" className="text-[var(--cta)] underline" onClick={() => go(s.href)}>
                    Open
                  </button>
                </small>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="app-feature-card mt-6">
        <h2>Make yourself at home</h2>
        <p className="muted">Your email is just the beginning. Explore the rest of your workspace.</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button type="button" variant="secondary" onClick={() => go("/app/calendar")}>
            Calendar
          </Button>
          <Button type="button" variant="secondary" onClick={() => go("/app/newsletters")}>
            Newsletters
          </Button>
          <Button type="button" variant="secondary" onClick={() => go("/app/bookings")}>
            Bookings
          </Button>
          <Button type="button" variant="secondary" onClick={() => go("/app/ai")}>
            AI assistant
          </Button>
          <Button type="button" variant="secondary" onClick={() => go("/docs/api")}>
            API docs
          </Button>
        </div>
      </div>
    </AppFeaturePage>
  );
}
