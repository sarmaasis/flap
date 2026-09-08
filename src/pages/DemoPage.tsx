import { useEffect, useMemo, useState } from "react";
import MarketingShell from "../components/MarketingShell";
import { Button } from "../components/ui/button";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

const PATH = "/demo";

type FakeMsg = {
  id: string;
  domain: string;
  from: string;
  to: string;
  subject: string;
  preview: string;
};

const MESSAGES: FakeMsg[] = [
  {
    id: "1",
    domain: "product-a.com",
    from: "Alex <alex@customer.io>",
    to: "support@product-a.com",
    subject: "Billing question on Product A",
    preview: "Hey — can you confirm the invoice for March?",
  },
  {
    id: "2",
    domain: "product-b.dev",
    from: "Sam <sam@agency.co>",
    to: "hello@product-b.dev",
    subject: "Kickoff for Product B",
    preview: "Excited to start. Who should we send contracts to?",
  },
  {
    id: "3",
    domain: "studio.example",
    from: "Jordan <jordan@press.example>",
    to: "press@studio.example",
    subject: "Interview request",
    preview: "Would love 20 minutes next week about your launch.",
  },
];

/**
 * Front-end-only reply-from demo. Never calls /api/mail send.
 */
export default function DemoPage() {
  const [selectedId, setSelectedId] = useState(MESSAGES[0].id);
  const [replyOpen, setReplyOpen] = useState(false);
  const [draft, setDraft] = useState("Thanks — looping you in from the right address.");

  const selected = useMemo(
    () => MESSAGES.find((m) => m.id === selectedId) || MESSAGES[0],
    [selectedId],
  );

  useEffect(() => {
    setPageMeta({
      title: "Interactive demo | Flap",
      description:
        "Try Flap’s multi-domain inbox without signing up: open a message and see reply From lock to the receiving domain.",
      path: PATH,
    });
    setJsonLd(
      "demo-page",
      webPageLd({
        title: "Interactive demo | Flap",
        description: "No-signup demo of Flap reply-from identity.",
        path: PATH,
      }),
    );
    return () => clearJsonLd("demo-page");
  }, []);

  return (
    <MarketingShell>
      <main className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Demo</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          One inbox. Correct From on reply.
        </h1>
        <p className="mt-4 max-w-2xl text-[var(--muted)]">
          Fake domains and messages only — nothing is sent. Open a thread and Reply to see Flap lock the sender to the
          address that received the mail.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-[220px_1fr]">
          <aside className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3" aria-label="Fake inbox">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
              Inbox
            </p>
            <ul className="flex flex-col gap-1">
              {MESSAGES.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`w-full rounded-lg border-0 px-2.5 py-2 text-left text-[13px] ${
                      m.id === selectedId
                        ? "bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))] font-semibold text-[var(--foreground)]"
                        : "bg-transparent text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]"
                    }`}
                    onClick={() => {
                      setSelectedId(m.id);
                      setReplyOpen(false);
                    }}
                  >
                    <span className="block truncate">{m.subject}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-[var(--foreground-faint)]">via {m.domain}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <p className="text-[12px] text-[var(--foreground-faint)]">via {selected.domain}</p>
            <h2 className="mt-1 text-xl font-semibold">{selected.subject}</h2>
            <p className="mt-2 text-[13px] text-[var(--foreground-muted)]">
              From {selected.from} · To {selected.to}
            </p>
            <p className="mt-5 text-[15px] leading-relaxed text-[var(--foreground)]">{selected.preview}</p>

            {!replyOpen ? (
              <Button className="mt-6" type="button" onClick={() => setReplyOpen(true)}>
                Reply
              </Button>
            ) : (
              <div className="mt-6 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-hover)] p-4">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                  Sending as
                </p>
                <p className="mt-1 font-mono text-[14px] font-semibold text-[var(--foreground)]">{selected.to}</p>
                <p className="mt-1 text-[12.5px] text-[var(--foreground-muted)]">
                  Automatically selected because this message was sent to {selected.to}. Locked so you do not reply from
                  another product’s domain.
                </p>
                <textarea
                  className="mt-3 min-h-[100px] w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px]"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="Demo reply body"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setReplyOpen(false);
                      setDraft("Thanks — looping you in from the right address.");
                    }}
                  >
                    Pretend send (demo only)
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setReplyOpen(false)}>
                    Cancel
                  </Button>
                </div>
                <p className="mt-2 text-[12px] text-[var(--foreground-faint)]">
                  No API call is made. Connect a real domain to send for real.
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button type="button" onClick={() => go("/signup")}>
            Connect your first domain
          </Button>
          <Button type="button" variant="ghost" onClick={() => go("/migrate")}>
            See migration path
          </Button>
        </div>
      </main>
    </MarketingShell>
  );
}
