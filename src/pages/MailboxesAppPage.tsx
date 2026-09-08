import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import AppFeaturePage, { FeatureEmpty } from "../components/AppFeaturePage";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { api, type Domain, type Mailbox } from "../lib/api";
import { go } from "../lib/nav";
import { tw } from "../lib/tw";
import { cn } from "../lib/utils";

export default function MailboxesAppPage() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainId, setDomainId] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [me, domainRes] = await Promise.all([api.me(), api.domains()]);
    setMailboxes(me.mailboxes || []);
    const nextDomains = domainRes.domains || [];
    setDomains(nextDomains);
    setDomainId((prev) => {
      if (prev && nextDomains.some((d) => d.id === prev)) return prev;
      return nextDomains[0]?.id || "";
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    void refresh()
      .catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not load mailboxes."))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function addMailbox(e: React.FormEvent) {
    e.preventDefault();
    if (!domainId) {
      setErr("Select a domain first.");
      return;
    }
    const local = localPart.trim().toLowerCase();
    if (!local) {
      setErr("Enter a mailbox name (for example hello).");
      return;
    }
    setBusy(true);
    setErr("");
    setNotice("");
    try {
      const created = await api.createMailbox(domainId, local);
      if (displayName.trim()) await api.updateMailbox(created.mailbox.id, displayName.trim());
      setLocalPart("");
      setDisplayName("");
      await refresh();
      setNotice(`Created ${created.mailbox.address}.`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not add mailbox.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDisplayName(id: string, value: string, previous: string) {
    const next = value.trim();
    if (next === (previous || "")) return;
    try {
      await api.updateMailbox(id, next);
      await refresh();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not update display name.");
    }
  }

  async function removeMailbox(address: string, id: string) {
    if (!window.confirm(`Remove ${address}?`)) return;
    setErr("");
    try {
      await api.deleteMailbox(id);
      await refresh();
      setNotice(`Removed ${address}.`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not remove mailbox.");
    }
  }

  const selectedDomain = domains.find((d) => d.id === domainId);
  const previewAddress =
    localPart.trim() && selectedDomain
      ? `${localPart.trim().toLowerCase()}@${selectedDomain.name}`
      : selectedDomain
        ? `you@${selectedDomain.name}`
        : "you@yourdomain.com";

  return (
    <AppFeaturePage
      current="mailboxes"
      title="Mailboxes"
      subtitle="Create addresses on your domains. Each one is its own inbox."
      actions={
        domains.length ? (
          <Button type="button" variant="secondary" onClick={() => go("/app/domains")}>
            Manage domains
          </Button>
        ) : null
      }
    >
      {err ? (
        <p className={cn("mb-4", tw.error)} role="alert">
          {err}
        </p>
      ) : null}
      {notice ? (
        <p className={cn("mb-4", tw.notice)} role="status">
          {notice}
        </p>
      ) : null}

      {loading ? <p className={cn("mb-4 text-sm", tw.muted)}>Loading mailboxes…</p> : null}

      {!loading && domains.length === 0 ? (
        <FeatureEmpty
          title="Connect a domain first"
          body="Mailboxes live on a domain you control. Add example.com, publish DNS, then create hello@ here."
          cta="Connect a domain"
          onCta={() => go("/app/domains")}
          mockup={
            <div className={tw.featureEmptyMock} aria-hidden>
              <div className={tw.featureEmptyRow}>
                <span className={tw.featureEmptySwatch} />
                <span className={tw.featureEmptyLine} />
                <span className={tw.featureEmptyChip}>Shared</span>
              </div>
              <div className={tw.featureEmptyRow}>
                <span className={tw.featureEmptySwatch} />
                <span className={tw.featureEmptyLine} />
                <span className={cn(tw.featureEmptyChip, "bg-[var(--surface-hover)] text-[var(--foreground-muted)]")}>Private</span>
              </div>
            </div>
          }
        />
      ) : null}

      {!loading && domains.length > 0 ? (
        <section className="mb-8 rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] p-5">
          <h2 className="m-0 text-base font-semibold text-[var(--foreground)]">Add mailbox</h2>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            Creates <span className="font-[family-name:var(--font-mono)] text-[var(--foreground)]">{previewAddress}</span>
          </p>
          <form
            onSubmit={(e) => void addMailbox(e)}
            className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="mb-local" className="block h-4 leading-4">
                Local part
              </Label>
              <Input
                id="mb-local"
                value={localPart}
                onChange={(e) => setLocalPart(e.target.value)}
                placeholder="hello"
                required
                autoComplete="off"
                pattern="[A-Za-z0-9._+-]+"
                title="Letters, numbers, dots, plus, underscore, hyphen"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="mb-display" className="block h-4 leading-4">
                Display name
              </Label>
              <Input
                id="mb-display"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label className="block h-4 leading-4">Domain</Label>
              <Select value={domainId} onValueChange={setDomainId}>
                <SelectTrigger
                  aria-label="Domain"
                  className="h-9 w-full rounded-[10px] border-[var(--line-strong)] bg-[var(--surface-input)] text-[var(--foreground)] focus:ring-0 focus-visible:border-[var(--accent)] focus-visible:shadow-[var(--focus-ring)]"
                >
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>
                <SelectContent>
                  {domains.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={busy || !domainId} className="h-9 shrink-0">
              <Plus className="h-4 w-4" />
              {busy ? "Adding…" : "Add mailbox"}
            </Button>
          </form>
        </section>
      ) : null}

      {!loading && domains.length > 0 && mailboxes.length === 0 ? (
        <p className={cn("text-sm", tw.muted)}>No mailboxes yet — create your first address above.</p>
      ) : null}

      {!loading && mailboxes.length > 0 ? (
        <div className="rounded-2xl border border-[var(--line)]">
          {/* ── Mobile card list (hidden sm+) ── */}
          <ul className="divide-y divide-[var(--line)] sm:hidden">
            {mailboxes.map((m) => (
              <li key={m.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <span className="break-all text-sm font-semibold text-[var(--foreground)]">{m.address}</span>
                  <span className="shrink-0 rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] text-[var(--foreground-muted)]">
                    {m.is_shared ? "Shared" : "Private"}
                  </span>
                </div>
                <Input
                  defaultValue={m.display_name ?? ""}
                  aria-label={`Display name for ${m.address}`}
                  placeholder="From name (optional)"
                  onBlur={(e) => void saveDisplayName(m.id, e.target.value, m.display_name ?? "")}
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => void removeMailbox(m.address, m.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {/* ── Desktop table (hidden on mobile) ── */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surface-hover)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--foreground-faint)]">
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">From name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {mailboxes.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">{m.address}</td>
                    <td className="px-4 py-3">
                      <Input
                        defaultValue={m.display_name ?? ""}
                        aria-label={`Display name for ${m.address}`}
                        className="max-w-xs"
                        onBlur={(e) => void saveDisplayName(m.id, e.target.value, m.display_name ?? "")}
                      />
                    </td>
                    <td className="px-4 py-3 text-[var(--foreground-muted)]">
                      {m.is_shared ? "Shared" : "Private"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => void removeMailbox(m.address, m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </AppFeaturePage>
  );
}
