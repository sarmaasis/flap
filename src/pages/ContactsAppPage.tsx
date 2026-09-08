import { useEffect, useMemo, useState } from "react";
import AppFeaturePage, { FeatureEmpty } from "../components/AppFeaturePage";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { api, type Contact } from "../lib/api";
import { tw } from "../lib/tw";
import { cn } from "../lib/utils";

export default function ContactsAppPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await api.contacts();
      setContacts(res.contacts || []);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not load contacts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter(
      (c) =>
        c.email.toLowerCase().includes(needle) ||
        (c.name || "").toLowerCase().includes(needle),
    );
  }, [contacts, q]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setErr("");
    try {
      await api.createContact(email.trim(), name.trim() || undefined);
      setEmail("");
      setName("");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not add contact.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppFeaturePage
      current="contacts"
      title="Contacts"
      subtitle="Your address book for compose autocomplete. Contacts are also remembered as you send."
    >
      {err ? <p className={cn("mb-4", tw.error)} role="alert">{err}</p> : null}

      <form className={cn(tw.appFeatureCard, "gap-3", tw.stack)} onSubmit={(e) => void onAdd(e)}>
        <h2>Add contact</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
          <Input
            type="email"
            required
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email"
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Input
          className="max-w-sm"
          placeholder="Search contacts"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search contacts"
        />
        <p className={cn("text-sm", tw.muted)}>
          {loading ? "Loading…" : `${filtered.length} contact${filtered.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {!loading && filtered.length === 0 ? (
        <FeatureEmpty
          title={q.trim() ? "No matches" : "No contacts yet"}
          body={
            q.trim()
              ? "Try a different name or email."
              : "Add people you email often, or send a message and Flap will remember the address."
          }
          mockup={
            q.trim() ? undefined : (
              <div className={tw.featureEmptyMock} aria-hidden>
                <div className={tw.featureEmptyRow}>
                  <span className={tw.featureEmptyAvatar}>A</span>
                  <div className={tw.stack}>
                    <span className={cn(tw.featureEmptyLine, "flex-[0_0_58%]")} />
                    <span className={cn(tw.featureEmptyLine, "h-1.5 flex-[0_0_42%] bg-[var(--surface-active)]")} />
                  </div>
                </div>
                <div className={tw.featureEmptyRow}>
                  <span className={tw.featureEmptyAvatar}>B</span>
                  <div className={tw.stack}>
                    <span className={cn(tw.featureEmptyLine, "flex-[0_0_42%]")} />
                    <span className={cn(tw.featureEmptyLine, "h-1.5 flex-[0_0_58%] bg-[var(--surface-active)]")} />
                  </div>
                </div>
                <div className={cn(tw.featureEmptyRow, "opacity-55")}>
                  <span className={tw.featureEmptyAvatar}>C</span>
                  <div className={tw.stack}>
                    <span className={cn(tw.featureEmptyLine, "flex-[0_0_72%]")} />
                    <span className={cn(tw.featureEmptyLine, "h-1.5 flex-[0_0_42%] bg-[var(--surface-active)]")} />
                  </div>
                </div>
              </div>
            )
          }
        />
      ) : (
        <ul className={cn(tw.appFeatureList, "mt-4")}>
          {filtered.map((c) => (
            <li key={c.id}>
              <div className="min-w-0">
                <strong className="block truncate">{c.name || c.email}</strong>
                {c.name ? <span className={cn("block truncate text-sm", tw.muted)}>{c.email}</span> : null}
              </div>
              <Button
                size="sm"
                variant="danger"
                type="button"
                onClick={() => {
                  if (!window.confirm(`Remove ${c.email}?`)) return;
                  void api.deleteContact(c.id).then(load).catch((ex) => {
                    setErr(ex instanceof Error ? ex.message : "Could not remove contact.");
                  });
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </AppFeaturePage>
  );
}
