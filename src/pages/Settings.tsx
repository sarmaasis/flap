import { useEffect, useState } from "react";
import {
  api,
  type Alias,
  type ApiKey,
  type BillingSubscription,
  type BlockedSender,
  type Contact,
  type DnsRecords,
  type Domain,
  type Filter,
  type Mailbox,
  type PlanSummary,
  type Prefs,
  type Signature,
  type TeamInvite,
  type TeamMember,
  type TeamResponse,
  type Template,
  type Webhook,
} from "../lib/api";
import { go } from "../lib/nav";
import AppShell from "../components/AppShell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

type Tab = "setup" | "compose" | "contacts" | "filters" | "aliases" | "developers" | "privacy" | "billing" | "team";

function initialTab(): Tab {
  const q = new URLSearchParams(window.location.search).get("tab");
  const allowed: Tab[] = ["setup", "compose", "contacts", "filters", "aliases", "developers", "privacy", "billing", "team"];
  return allowed.includes(q as Tab) ? (q as Tab) : "setup";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function Settings() {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [email, setEmail] = useState("");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [domainName, setDomainName] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [domainId, setDomainId] = useState("");
  const [dns, setDns] = useState<DnsRecords | null>(null);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [blocked, setBlocked] = useState<BlockedSender[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teamInfo, setTeamInfo] = useState<Pick<TeamResponse, "teams_unlocked" | "plan_id" | "limits" | "workspace" | "shared_mailboxes"> | null>(null);
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteMailboxes, setInviteMailboxes] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({ vacation_enabled: 0, vacation_body: "", notify_browser: 0 });
  const [newToken, setNewToken] = useState("");
  const [newWebhookSecret, setNewWebhookSecret] = useState("");
  const [billing, setBilling] = useState<BillingSubscription | null>(null);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [checkoutConfigured, setCheckoutConfigured] = useState(true);
  const [checkoutMissing, setCheckoutMissing] = useState<string[]>([]);
  const [dodoEnvironment, setDodoEnvironment] = useState<"test_mode" | "live_mode" | null>(null);
  const [supportEmail, setSupportEmail] = useState("support@useflap.online");
  const [onboardingBanner, setOnboardingBanner] = useState(
    () => new URLSearchParams(window.location.search).get("onboarding") === "1",
  );

  async function refresh() {
    const me = await api.me();
    setEmail(me.user.email);
    const [d, m, s, t, c, f, b, k, a, w, p, team, bill, planList] = await Promise.all([
      api.domains(),
      api.mailboxes(),
      api.signatures(),
      api.templates(),
      api.contacts(),
      api.filters(),
      api.blocked(),
      api.keys(),
      api.aliases(),
      api.webhooks(),
      api.prefs(),
      api.team(),
      api.billingSubscription().catch(() => null),
      api.billingPlans().catch(() => ({
        plans: [] as PlanSummary[],
        checkout_configured: false as boolean,
        checkout_missing: ["DODO_PAYMENTS_API_KEY", "DODO_PRODUCT_PRO", "DODO_PRODUCT_TEAM"] as string[],
        dodo_environment: undefined as "test_mode" | "live_mode" | undefined,
        support_email: "support@useflap.online",
      })),
    ]);
    setDomains(d.domains);
    if (!domainId && d.domains[0]) setDomainId(d.domains[0].id);
    setMailboxes(m.mailboxes);
    setSignatures(s.signatures);
    setTemplates(t.templates);
    setContacts(c.contacts);
    setFilters(f.filters);
    setBlocked(b.blocked);
    setKeys(k.keys);
    setAliases(a.aliases);
    setWebhooks(w.webhooks);
    setPrefs(p.settings);
    setInvites(team.invites);
    setMembers(team.members ?? []);
    setTeamInfo({
      teams_unlocked: team.teams_unlocked,
      plan_id: team.plan_id,
      limits: team.limits,
      workspace: team.workspace,
      shared_mailboxes: team.shared_mailboxes ?? [],
    });
    setBilling(bill);
    setPlans(planList.plans);
    setCheckoutConfigured(bill?.checkout_configured ?? planList.checkout_configured ?? false);
    setCheckoutMissing(bill?.checkout_missing ?? planList.checkout_missing ?? []);
    setDodoEnvironment(bill?.dodo_environment ?? planList.dodo_environment ?? null);
    setSupportEmail(bill?.support_email || planList.support_email || "support@useflap.online");
    const focus = d.domains.find((x) => x.id === domainId) ?? d.domains[0];
    if (focus) setDns((await api.dns(focus.name)).records);
  }

  useEffect(() => {
    refresh().catch(() => go("/login"));
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "done") {
      setNotice("Checkout complete. Plan entitlements update when Dodo confirms the subscription webhook.");
      setTab("billing");
    }
    if (params.get("onboarding") === "1") {
      setOnboardingBanner(true);
      setTab("setup");
      setNotice("Welcome to Flap. Complete the checklist below to receive your first message.");
    }
    if (params.get("joined") === "1") {
      setTab("team");
      setNotice("You joined the workspace. Shared mailboxes you were granted appear in the inbox.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const focus = domains.find((x) => x.id === domainId);
    if (!focus) return;
    api.dns(focus.name).then((r) => setDns(r.records)).catch(() => undefined);
  }, [domainId, domains]);

  async function addDomain(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await api.createDomain(domainName);
      setDomainName("");
      await refresh();
      setNotice("Domain added. Next, create an address to receive mail.");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not add domain.");
    }
  }

  async function addMailbox(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      const created = await api.createMailbox(domainId, localPart);
      if (displayName.trim()) await api.updateMailbox(created.mailbox.id, displayName.trim());
      setLocalPart("");
      setDisplayName("");
      await refresh();
      setNotice("Mailbox added. Create a matching Email Routing rule in Cloudflare to begin receiving mail.");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not add mailbox.");
    }
  }

  async function logout() {
    await api.logout();
    go("/");
  }

  const selectedDomain = domains.find((d) => d.id === domainId);
  const selectedName = selectedDomain?.name ?? "your-domain.com";
  const hasDomain = domains.length > 0;
  const hasMailbox = mailboxes.length > 0;
  const domainMailboxes = mailboxes.filter((m) => m.domain_id === domainId);

  const tabs: Array<[Tab, string]> = [
    ["setup", "Setup"],
    ["compose", "Compose"],
    ["contacts", "Contacts"],
    ["filters", "Rules"],
    ["aliases", "Aliases"],
    ["developers", "Developers"],
    ["privacy", "Privacy"],
    ["billing", "Billing"],
    ["team", "Team"],
  ];

  async function startCheckout(planId: string) {
    setErr("");
    setCheckoutBusy(planId);
    try {
      const session = await api.billingCheckout(planId);
      window.location.href = session.checkout_url;
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not start checkout.");
      setCheckoutBusy(null);
    }
  }

  async function openPortal() {
    setErr("");
    setPortalBusy(true);
    try {
      const session = await api.billingPortal();
      window.location.href = session.portal_url;
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not open billing portal.");
      setPortalBusy(false);
    }
  }

  return (
    <AppShell email={email} current="settings" onLogout={() => void logout()}>
      <main className="settings">
        <div className="settings-intro">
          <p className="eyebrow">Workspace</p>
          <h1>Settings</h1>
          <p className="lede">Wire your domain, route mail, automate delivery, and keep developer hooks under one roof.</p>
        </div>
        {onboardingBanner ? (
          <div className="onboarding-banner" role="status">
            <div>
              <strong>Get your domain live</strong>
              <p>Add a domain → create a mailbox → point Cloudflare Email Routing → send a test. Upgrade anytime from Billing.</p>
            </div>
            <button type="button" className="btn" onClick={() => setOnboardingBanner(false)}>Dismiss</button>
          </div>
        ) : null}
        <div className="settings-tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tab${tab === id ? " active" : ""}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        {err ? <div className="err">{err}</div> : null}
        {notice ? <div className="notice" role="status">{notice}</div> : null}

        {tab === "setup" ? (
          <>
            <ol className="setup-steps" aria-label="Setup progress">
              <li className={hasDomain ? "complete" : "current"}>
                <span>1</span><div><strong>Add a domain</strong><small>{hasDomain ? `${domains.length} configured` : "The domain you receive mail on"}</small></div>
              </li>
              <li className={hasMailbox ? "complete" : hasDomain ? "current" : ""}>
                <span>2</span><div><strong>Create an address</strong><small>{hasMailbox ? `${mailboxes.length} mailbox${mailboxes.length === 1 ? "" : "es"} ready` : "For example, hello@your-domain.com"}</small></div>
              </li>
              <li className={hasMailbox ? "current" : ""}>
                <span>3</span><div><strong>Route email in Cloudflare</strong><small>MX + Worker routing rule for each address</small></div>
              </li>
              <li className={hasMailbox ? "current" : ""}>
                <span>4</span><div><strong>Send a test &amp; pick a plan</strong><small>Compose from Inbox · upgrade in Billing if you need more room</small></div>
              </li>
            </ol>
            <section className="settings-card" aria-labelledby="domains-title">
              <div className="section-heading"><div><h2 id="domains-title">Domains</h2><p>Add the domain managed in your Cloudflare account.</p></div></div>
              <form className="row-form" onSubmit={addDomain}>
                <label className="sr-only" htmlFor="domain-name">Domain name</label>
                <input id="domain-name" placeholder="example.com" value={domainName} onChange={(e) => setDomainName(e.target.value)} required />
                <button className="btn" type="submit">Add domain</button>
              </form>
              {domains.length ? <table className="table"><thead><tr><th>Name</th><th>Catch-all</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
                {domains.map((d) => (
                  <tr key={d.id}>
                    <td><button className={`text-button${domainId === d.id ? " selected" : ""}`} type="button" onClick={() => setDomainId(d.id)}>{d.name}</button></td>
                    <td>
                      <select
                        value={d.catch_all_mailbox_id ?? ""}
                        onChange={(e) => {
                          const value = e.target.value || null;
                          void api.updateDomain(d.id, value).then(refresh).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not update catch-all."));
                        }}
                        aria-label={`Catch-all for ${d.name}`}
                      >
                        <option value="">Off</option>
                        {mailboxes.filter((m) => m.domain_id === d.id).map((m) => (
                          <option key={m.id} value={m.id}>{m.address}</option>
                        ))}
                      </select>
                    </td>
                    <td><button className="btn btn-danger" type="button" onClick={() => { if (window.confirm(`Remove ${d.name} and its mailboxes? Existing messages will remain.`)) void api.deleteDomain(d.id).then(refresh); }}>Remove</button></td>
                  </tr>
                ))}
              </tbody></table> : <p className="empty-state">No domains yet. Add the domain you plan to receive mail on.</p>}
            </section>
            <section className="settings-card" aria-labelledby="mailboxes-title">
              <div className="section-heading"><div><h2 id="mailboxes-title">Mailboxes</h2><p>Flap accepts mail for addresses listed here, plus aliases and catch-all when enabled.</p></div></div>
              <form className="row-form" onSubmit={addMailbox}>
                <label className="sr-only" htmlFor="local-part">Mailbox name</label>
                <input id="local-part" placeholder="hello" value={localPart} onChange={(e) => setLocalPart(e.target.value)} required />
                <input placeholder="Display name (optional)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                <label className="sr-only" htmlFor="mailbox-domain">Domain</label>
                <select id="mailbox-domain" value={domainId} onChange={(e) => setDomainId(e.target.value)} style={{ maxWidth: 220 }} disabled={!hasDomain}>
                  {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button className="btn" type="submit" disabled={!domainId}>Add mailbox</button>
              </form>
              {mailboxes.length ? <table className="table"><thead><tr><th>Address</th><th>From name</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
                {mailboxes.map((m) => <tr key={m.id}><td>{m.address}</td><td><input defaultValue={m.display_name ?? ""} aria-label={`Display name for ${m.address}`} onBlur={(e) => { const value = e.target.value.trim(); if (value !== (m.display_name ?? "")) void api.updateMailbox(m.id, value).then(refresh); }} /></td><td><button className="btn btn-danger" type="button" onClick={() => { if (window.confirm(`Remove ${m.address}?`)) void api.deleteMailbox(m.id).then(refresh); }}>Remove</button></td></tr>)}
              </tbody></table> : <p className="empty-state">{hasDomain ? "Create your first address above." : "Add a domain before creating an address."}</p>}
            </section>
            <section className="settings-card" aria-labelledby="routing-title">
              <div className="section-heading"><div><h2 id="routing-title">Cloudflare routing checklist</h2><p>Finish these steps in the Cloudflare dashboard for {selectedName}.</p></div></div>
              {dns ? (
                <div className="dns">
                  <p>{dns.note}</p>
                  <p><strong>MX</strong></p>
                  {dns.mx.map((r) => (
                    <div key={r.value}><code>{r.type} {r.name} {r.priority} {r.value}</code></div>
                  ))}
                  <p style={{ marginTop: 12 }}><strong>SPF</strong></p>
                  <code>{dns.spf.type} {dns.spf.name} {dns.spf.value}</code>
                  <p style={{ marginTop: 12 }}><strong>DKIM</strong></p>
                  <div><code>{dns.dkim.type} {dns.dkim.name}</code></div>
                  <p>{dns.dkim.value}</p>
                  <p style={{ marginTop: 12 }}><strong>Worker rule</strong></p>
                  <p>{dns.worker_rule}</p>
                  <p style={{ marginTop: 12 }}><strong>Sending</strong></p>
                  <p>{dns.send_note}</p>
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        {tab === "compose" ? (
          <>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Signatures</h2><p>A default signature is appended to new messages.</p></div></div>
              <SignatureForm onSave={async (body) => { await api.createSignature(body); await refresh(); setNotice("Signature saved."); }} />
              {signatures.length ? <table className="table"><thead><tr><th>Name</th><th>Default</th><th /></tr></thead><tbody>
                {signatures.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.is_default ? "Yes" : <button type="button" className="text-button" onClick={() => void api.updateSignature(s.id, { name: s.name, html_body: s.html_body, text_body: s.text_body, is_default: true }).then(refresh)}>Make default</button>}</td>
                    <td><button type="button" className="btn btn-danger" onClick={() => void api.deleteSignature(s.id).then(refresh)}>Remove</button></td>
                  </tr>
                ))}
              </tbody></table> : <p className="empty-state">No signatures yet.</p>}
            </section>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Templates</h2><p>Reusable messages you can insert while composing.</p></div></div>
              <TemplateForm onSave={async (body) => { await api.createTemplate(body); await refresh(); setNotice("Template saved."); }} />
              {templates.length ? <table className="table"><thead><tr><th>Name</th><th>Subject</th><th /></tr></thead><tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.subject || "—"}</td>
                    <td><button type="button" className="btn btn-danger" onClick={() => void api.deleteTemplate(t.id).then(refresh)}>Remove</button></td>
                  </tr>
                ))}
              </tbody></table> : <p className="empty-state">Save a reply you send often.</p>}
            </section>
          </>
        ) : null}

        {tab === "contacts" ? (
          <section className="settings-card">
            <div className="section-heading"><div><h2>Address book</h2><p>Contacts are remembered as you send, and you can add them by hand.</p></div></div>
            <ContactForm onSave={async (emailValue, name) => { await api.createContact(emailValue, name); await refresh(); }} />
            {contacts.length ? <table className="table"><thead><tr><th>Name</th><th>Email</th><th /></tr></thead><tbody>
              {contacts.map((c) => (
                <tr key={c.id}><td>{c.name || "—"}</td><td>{c.email}</td><td><button type="button" className="btn btn-danger" onClick={() => void api.deleteContact(c.id).then(refresh)}>Remove</button></td></tr>
              ))}
            </tbody></table> : <p className="empty-state">Your address book fills in as you write.</p>}
          </section>
        ) : null}

        {tab === "filters" ? (
          <section className="settings-card">
            <div className="section-heading"><div><h2>Email rules</h2><p>Catch-all, auto-label, archive, forward, or keep mail in inbox. Blocked senders still go to spam first.</p></div></div>
            <FilterForm onSave={async (body) => { await api.createFilter(body); await refresh(); setNotice("Filter added."); }} />
            {filters.length ? <table className="table"><thead><tr><th>Name</th><th>Match</th><th>Action</th><th /></tr></thead><tbody>
              {filters.map((f) => (
                <tr key={f.id}>
                  <td>{f.name}{f.is_catch_all ? " · catch-all" : ""}</td>
                  <td className="muted">{f.is_catch_all ? "All unmatched mail" : [f.match_from && `from ${f.match_from}`, f.match_to && `to ${f.match_to}`, f.match_subject && `subject ${f.match_subject}`].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{f.action}{f.label ? `:${f.label}` : ""}{f.forward_to ? ` → ${f.forward_to}` : ""}{f.enabled ? "" : " (off)"}</td>
                  <td className="row-actions">
                    <button type="button" className="text-button" onClick={() => void api.toggleFilter(f.id).then(refresh)}>{f.enabled ? "Disable" : "Enable"}</button>
                    <button type="button" className="btn btn-danger" onClick={() => void api.deleteFilter(f.id).then(refresh)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody></table> : <p className="empty-state">No rules yet. Keep the inbox quiet on your terms.</p>}
          </section>
        ) : null}

        {tab === "aliases" ? (
          <section className="settings-card">
            <div className="section-heading"><div><h2>Aliases & disposable addresses</h2><p>Route extra local-parts to an existing mailbox. Disposable aliases can expire automatically.</p></div></div>
            <AliasForm
              mailboxes={mailboxes}
              onSave={async (body) => {
                await api.createAlias(body);
                await refresh();
                setNotice("Alias created. Point Cloudflare Email Routing at this Worker for that address (or use catch-all).");
              }}
            />
            {aliases.length ? <table className="table"><thead><tr><th>Address</th><th>Delivers to</th><th>Type</th><th /></tr></thead><tbody>
              {aliases.map((a) => (
                <tr key={a.id}>
                  <td>{a.address}</td>
                  <td className="muted">{mailboxes.find((m) => m.id === a.mailbox_id)?.address ?? a.mailbox_id}</td>
                  <td>{a.disposable ? `Disposable${a.expires_at ? ` · ends ${new Date(a.expires_at).toLocaleDateString()}` : ""}` : a.label || "Alias"}</td>
                  <td><button type="button" className="btn btn-danger" onClick={() => void api.deleteAlias(a.id).then(refresh)}>Remove</button></td>
                </tr>
              ))}
            </tbody></table> : <p className="empty-state">No aliases yet. Handy for newsletters and one-off signups.</p>}
            {!domainMailboxes.length && hasDomain ? <p className="muted">Select a domain with at least one mailbox to create aliases.</p> : null}
          </section>
        ) : null}

        {tab === "developers" ? (
          <>
            <section className="settings-card">
              <div className="section-heading"><div><h2>API keys</h2><p>Send transactional mail with <code>POST /api/v1/send</code> and a Bearer token.</p></div></div>
              <form className="row-form" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const input = form.elements.namedItem("keyname") as HTMLInputElement; void api.createKey(input.value || "Transactional").then((res) => { setNewToken(res.key.token ?? ""); input.value = ""; return refresh(); }); }}>
                <input name="keyname" placeholder="Key name" />
                <button className="btn" type="submit">Create key</button>
              </form>
              {newToken ? <div className="notice">Copy this key now. It will not be shown again: <code>{newToken}</code></div> : null}
              {keys.length ? <table className="table"><thead><tr><th>Name</th><th>Prefix</th><th /></tr></thead><tbody>
                {keys.map((k) => <tr key={k.id}><td>{k.name}</td><td><code>{k.key_prefix}…</code></td><td><button type="button" className="btn btn-danger" onClick={() => void api.deleteKey(k.id).then(refresh)}>Revoke</button></td></tr>)}
              </tbody></table> : <p className="empty-state">No API keys yet.</p>}
            </section>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Webhooks</h2><p>HTTPS POST on <code>mail.received</code>. Signature header: <code>x-flap-signature</code> = SHA-256 of <code>secret.body</code>.</p></div></div>
              <form className="stack-form" onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const name = (form.elements.namedItem("whname") as HTMLInputElement).value;
                const url = (form.elements.namedItem("whurl") as HTMLInputElement).value;
                void api.createWebhook({ name, url, events: "mail.received" }).then((res) => {
                  setNewWebhookSecret(res.webhook.secret ?? "");
                  form.reset();
                  return refresh();
                }).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not create webhook."));
              }}>
                <div className="row-form">
                  <input name="whname" placeholder="Hook name" />
                  <input name="whurl" placeholder="https://example.com/hooks/flap" required />
                </div>
                <button className="btn" type="submit">Add webhook</button>
              </form>
              {newWebhookSecret ? <div className="notice">Copy this signing secret now: <code>{newWebhookSecret}</code></div> : null}
              {webhooks.length ? <table className="table"><thead><tr><th>Name</th><th>URL</th><th>Status</th><th /></tr></thead><tbody>
                {webhooks.map((w) => (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td className="muted">{w.url}</td>
                    <td>{w.enabled ? "On" : "Off"}</td>
                    <td className="row-actions">
                      <button type="button" className="text-button" onClick={() => void api.toggleWebhook(w.id).then(refresh)}>{w.enabled ? "Disable" : "Enable"}</button>
                      <button type="button" className="btn btn-danger" onClick={() => void api.deleteWebhook(w.id).then(refresh)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody></table> : <p className="empty-state">No webhooks yet.</p>}
            </section>
          </>
        ) : null}

        {tab === "privacy" ? (
          <>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Browser notifications</h2><p>Desktop alerts while Flap is open in a tab. Press ? in the inbox for keyboard shortcuts.</p></div></div>
              <form className="stack-form" onSubmit={(e) => {
                e.preventDefault();
                void (async () => {
                  if (prefs.notify_browser && typeof Notification !== "undefined") {
                    if (Notification.permission === "denied") {
                      setErr("Notifications are blocked in this browser. Allow them for useflap.online in site settings, then try again.");
                      return;
                    }
                    if (Notification.permission !== "granted") {
                      const perm = await Notification.requestPermission();
                      if (perm !== "granted") {
                        setErr("Notification permission was not granted.");
                        return;
                      }
                    }
                  }
                  await api.savePrefs({
                    vacation_enabled: Boolean(prefs.vacation_enabled),
                    vacation_body: prefs.vacation_body,
                    notify_browser: Boolean(prefs.notify_browser),
                  });
                  setErr("");
                  setNotice(prefs.notify_browser ? "Notifications on. Keep a Flap tab open to receive alerts." : "Notifications disabled.");
                })();
              }}>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={Boolean(prefs.notify_browser)}
                    onChange={(e) => setPrefs((p) => ({ ...p, notify_browser: e.target.checked ? 1 : 0 }))}
                  />
                  Enable browser notifications for new mail
                </label>
                <button className="btn" type="submit">Save notifications</button>
              </form>
            </section>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Automatic replies</h2><p>Send one vacation reply per sender every seven days.</p></div></div>
              <form className="stack-form" onSubmit={(e) => { e.preventDefault(); void api.savePrefs({ vacation_enabled: Boolean(prefs.vacation_enabled), vacation_body: prefs.vacation_body, notify_browser: Boolean(prefs.notify_browser) }).then(() => setNotice("Automatic replies updated.")); }}>
                <label className="check-row"><input type="checkbox" checked={Boolean(prefs.vacation_enabled)} onChange={(e) => setPrefs((p) => ({ ...p, vacation_enabled: e.target.checked ? 1 : 0 }))} /> Enable automatic replies</label>
                <textarea value={prefs.vacation_body} onChange={(e) => setPrefs((p) => ({ ...p, vacation_body: e.target.value }))} placeholder="Thanks for writing — I’ll get back to you soon." />
                <button className="btn" type="submit">Save replies</button>
              </form>
            </section>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Blocked senders</h2><p>Future mail from these addresses is filed to Spam.</p></div></div>
              <form className="row-form" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const input = form.elements.namedItem("block") as HTMLInputElement; void api.block(input.value).then(() => { input.value = ""; return refresh(); }).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not block sender.")); }}>
                <input name="block" placeholder="sender@example.com" required />
                <button className="btn" type="submit">Block</button>
              </form>
              {blocked.length ? <table className="table"><thead><tr><th>Address</th><th /></tr></thead><tbody>
                {blocked.map((b) => <tr key={b.id}><td>{b.address}</td><td><button type="button" className="btn btn-danger" onClick={() => void api.unblock(b.id).then(refresh)}>Unblock</button></td></tr>)}
              </tbody></table> : <p className="empty-state">Nobody is blocked.</p>}
            </section>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Backup & restore</h2><p>Export messages and workspace data as JSON. Restore merges contacts, templates, signatures, and rules (messages are export-only).</p></div></div>
              <div className="row-form">
                <button type="button" className="btn" onClick={() => void api.exportBackup().catch((ex) => setErr(ex instanceof Error ? ex.message : "Export failed."))}>Download backup</button>
                <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
                  Restore JSON
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        try {
                          const payload = JSON.parse(String(reader.result));
                          void api.restoreBackup(payload).then((res) => {
                            setNotice(`Restored ${res.restored} items.`);
                            return refresh();
                          }).catch((ex) => setErr(ex instanceof Error ? ex.message : "Restore failed."));
                        } catch {
                          setErr("That file is not valid JSON.");
                        }
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </section>
          </>
        ) : null}

        {tab === "billing" ? (
          <section className="settings-card">
            <div className="section-heading">
              <div>
                <h2>Plan & usage</h2>
                <p>Flap billing runs through Dodo Payments. Limits apply after webhook confirmation.</p>
              </div>
              {billing ? <Badge>{billing.plan.name} · {billing.status}</Badge> : null}
            </div>
            {!checkoutConfigured ? (
              <div className="deferred-banner" style={{ marginBottom: 16 }}>
                Self-serve checkout is not configured
                {dodoEnvironment ? ` (${dodoEnvironment})` : ""}.
                {checkoutMissing.length > 0 ? (
                  <>
                    {" "}Missing env: <code>{checkoutMissing.join(", ")}</code>.
                  </>
                ) : null}{" "}
                For local testing set test API key + product IDs in <code>.dev.vars</code> with{" "}
                <code>DODO_PAYMENTS_ENVIRONMENT=test_mode</code>. Or email{" "}
                <a href={`mailto:${supportEmail}`}>{supportEmail}</a> to upgrade.
              </div>
            ) : dodoEnvironment === "test_mode" ? (
              <div className="deferred-banner" style={{ marginBottom: 16 }}>
                Dodo is in <code>test_mode</code> — checkouts use test keys and{" "}
                <code>test.dodopayments.com</code> (no real charges).
              </div>
            ) : null}
            {billing ? (
              <div className="grid-2" style={{ marginBottom: 20 }}>
                <div>
                  <p className="muted" style={{ margin: 0 }}>Domains</p>
                  <strong>{billing.usage.domains} / {billing.limits.domains}</strong>
                </div>
                <div>
                  <p className="muted" style={{ margin: 0 }}>Mailboxes</p>
                  <strong>{billing.usage.mailboxes} / {billing.limits.mailboxes}</strong>
                </div>
                <div>
                  <p className="muted" style={{ margin: 0 }}>Aliases</p>
                  <strong>{billing.usage.aliases} / {billing.limits.aliases}</strong>
                </div>
                <div>
                  <p className="muted" style={{ margin: 0 }}>Storage</p>
                  <strong>{formatBytes(billing.usage.storage_bytes)} / {formatBytes(billing.limits.storage_bytes)}</strong>
                </div>
                <div>
                  <p className="muted" style={{ margin: 0 }}>Sends this month</p>
                  <strong>{billing.usage.send_per_month ?? 0} / {billing.limits.send_per_month ?? "—"}</strong>
                </div>
                <div>
                  <p className="muted" style={{ margin: 0 }}>API keys</p>
                  <strong>{billing.usage.api_keys} / {billing.limits.api_keys}</strong>
                </div>
                <div>
                  <p className="muted" style={{ margin: 0 }}>Webhooks</p>
                  <strong>{billing.usage.webhooks} / {billing.limits.webhooks}</strong>
                </div>
                <div>
                  <p className="muted" style={{ margin: 0 }}>Team seats</p>
                  <strong>{billing.usage.team_seats ?? 1} / {billing.limits.team_seats}</strong>
                </div>
              </div>
            ) : (
              <p className="empty-state">Billing data unavailable. Apply migration 0005_billing and reload.</p>
            )}
            {billing ? (
              <p className="muted" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>
                Storage counts message bodies and attachments. Outbound sends reset each UTC calendar month.
              </p>
            ) : null}
            <div className="row-form" style={{ marginBottom: 16, flexWrap: "wrap" }}>
              {billing?.portal_available ? (
                <Button variant="outline" disabled={portalBusy} onClick={() => void openPortal()}>
                  {portalBusy ? "Opening…" : "Manage subscription"}
                </Button>
              ) : billing && billing.plan_id !== "free" ? (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  To cancel or change payment methods, email{" "}
                  <a href={`mailto:${supportEmail}?subject=Flap%20subscription`}>{supportEmail}</a>
                  {" "}or complete a portal-linked checkout first.
                </p>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  Cancel anytime after upgrading via the customer portal, or contact{" "}
                  <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
                </p>
              )}
            </div>
            <div className="grid-2">
              {plans.filter((p) => p.id !== "free").map((plan) => {
                const available = plan.checkout_available !== false && checkoutConfigured;
                const isCurrent = billing?.plan_id === plan.id;
                return (
                  <div key={plan.id} className="settings-card" style={{ margin: 0, padding: 16 }}>
                    <div className="row-form" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                      <strong>{plan.name}</strong>
                      <span>${plan.price_monthly}/mo</span>
                    </div>
                    <p className="muted" style={{ marginTop: 0 }}>{plan.blurb}</p>
                    <ul className="muted" style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 13 }}>
                      {plan.features.slice(0, 4).map((f) => <li key={f}>{f}</li>)}
                    </ul>
                    <Button
                      disabled={isCurrent || checkoutBusy === plan.id || !available}
                      onClick={() => void startCheckout(plan.id)}
                    >
                      {isCurrent
                        ? "Current plan"
                        : checkoutBusy === plan.id
                          ? "Redirecting…"
                          : !available
                            ? "Contact to upgrade"
                            : `Upgrade to ${plan.name}`}
                    </Button>
                    {!available && !isCurrent ? (
                      <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                        <a href={`mailto:${supportEmail}?subject=Upgrade%20to%20${plan.name}`}>{supportEmail}</a>
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>
              See <a href="/billing-terms" onClick={(e) => { e.preventDefault(); go("/billing-terms"); }}>Billing Terms</a> for renewals and cancellation.
            </p>
          </section>
        ) : null}

        {tab === "team" ? (
          <section className="settings-card">
            <div className="section-heading">
              <div>
                <h2>Team &amp; shared mailboxes</h2>
                <p>
                  {teamInfo?.teams_unlocked
                    ? `Invite teammates, assign roles, and share inboxes like support@ or hello@. ${members.length} / ${teamInfo.limits.team_seats} seats used.`
                    : "Upgrade to Team to invite members and share mailboxes. Pro stays solo."}
                </p>
              </div>
              <Badge variant={teamInfo?.teams_unlocked ? "default" : "secondary"}>
                {teamInfo?.teams_unlocked ? "Team plan" : "Solo"}
              </Badge>
            </div>

            {!teamInfo?.teams_unlocked ? (
              <div className="deferred-banner">
                Team seats unlock on the Team plan ($39/mo). You can still manage your own mailboxes on Free or Pro.
                <div style={{ marginTop: 12 }}>
                  <Button size="sm" onClick={() => setTab("billing")}>View Team plan</Button>
                </div>
              </div>
            ) : null}

            {teamInfo?.workspace?.can_manage_team ? (
              <form
                className="stack-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const input = form.elements.namedItem("invite") as HTMLInputElement;
                  void api
                    .inviteTeam(input.value, inviteRole, inviteMailboxes)
                    .then((res) => {
                      const link = res.invite.accept_path
                        ? `${window.location.origin}${res.invite.accept_path}`
                        : "";
                      setNotice(link ? `Invite created. Share this link: ${link}` : "Invite created.");
                      input.value = "";
                      return refresh();
                    })
                    .catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not send invite."));
                }}
              >
                <div className="row-form">
                  <input name="invite" type="email" placeholder="teammate@example.com" required disabled={!teamInfo?.teams_unlocked} />
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} disabled={!teamInfo?.teams_unlocked}>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button className="btn" type="submit" disabled={!teamInfo?.teams_unlocked}>Invite</button>
                </div>
                {mailboxes.length ? (
                  <div className="mailbox-grant-list">
                    <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Grant mailbox access (optional — defaults to shared inboxes):</p>
                    {mailboxes.map((mb) => (
                      <label key={mb.id} className="check-row">
                        <input
                          type="checkbox"
                          checked={inviteMailboxes.includes(mb.id)}
                          disabled={!teamInfo?.teams_unlocked}
                          onChange={(e) => {
                            setInviteMailboxes((prev) =>
                              e.target.checked ? [...prev, mb.id] : prev.filter((id) => id !== mb.id),
                            );
                          }}
                        />
                        {mb.address}{mb.is_shared ? " · shared" : ""}
                      </label>
                    ))}
                  </div>
                ) : null}
              </form>
            ) : (
              <p className="muted">You are a {teamInfo?.workspace?.role || "member"} in this workspace.</p>
            )}

            <h3 style={{ marginTop: 28, marginBottom: 12 }}>Members</h3>
            {members.length ? (
              <table className="table">
                <thead><tr><th>Email</th><th>Role</th><th></th></tr></thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.user_id}>
                      <td>{m.email}{m.name ? ` (${m.name})` : ""}</td>
                      <td>{m.role}</td>
                      <td>
                        {teamInfo?.workspace?.can_manage_team && m.role !== "owner" ? (
                          <button
                            className="btn ghost"
                            type="button"
                            onClick={() => {
                              void api.removeMember(m.user_id).then(refresh).catch((ex) =>
                                setErr(ex instanceof Error ? ex.message : "Could not remove member."),
                              );
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-state">No members yet.</p>
            )}

            <h3 style={{ marginTop: 28, marginBottom: 12 }}>Pending invites</h3>
            {invites.filter((i) => i.status === "pending").length ? (
              <table className="table">
                <thead><tr><th>Email</th><th>Role</th><th>Link</th><th></th></tr></thead>
                <tbody>
                  {invites.filter((i) => i.status === "pending").map((i) => (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td>{i.role}</td>
                      <td style={{ fontSize: 12 }}>
                        {i.accept_path ? (
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => {
                              void navigator.clipboard.writeText(`${window.location.origin}${i.accept_path}`);
                              setNotice("Invite link copied.");
                            }}
                          >
                            Copy link
                          </button>
                        ) : "—"}
                      </td>
                      <td>
                        {teamInfo?.workspace?.can_manage_team ? (
                          <button
                            className="btn ghost"
                            type="button"
                            onClick={() => {
                              void api.revokeInvite(i.id).then(refresh).catch((ex) =>
                                setErr(ex instanceof Error ? ex.message : "Could not revoke."),
                              );
                            }}
                          >
                            Revoke
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-state">No pending invites.</p>
            )}

            <h3 style={{ marginTop: 28, marginBottom: 12 }}>Shared mailboxes</h3>
            <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
              Mark support@ or hello@ as shared so invitees can access them. Requires Team plan.
            </p>
            {mailboxes.length ? (
              <table className="table">
                <thead><tr><th>Address</th><th>Shared</th><th></th></tr></thead>
                <tbody>
                  {mailboxes.map((mb) => (
                    <tr key={mb.id}>
                      <td>{mb.address}</td>
                      <td>{mb.is_shared ? "Yes" : "No"}</td>
                      <td>
                        {teamInfo?.workspace?.can_manage_team ? (
                          <button
                            className="btn ghost"
                            type="button"
                            disabled={!teamInfo.teams_unlocked && !mb.is_shared}
                            onClick={() => {
                              void api
                                .shareMailbox(mb.id, !mb.is_shared)
                                .then(refresh)
                                .catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not update."));
                            }}
                          >
                            {mb.is_shared ? "Unshare" : "Make shared"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-state">Create a mailbox in Setup first.</p>
            )}
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}

function SignatureForm({ onSave }: { onSave: (body: { name: string; html_body: string; text_body: string; is_default: boolean }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  return (
    <form className="stack-form" onSubmit={(e) => { e.preventDefault(); void onSave({ name, html_body: `<p>${body.replace(/\n/g, "<br/>")}</p>`, text_body: body, is_default: isDefault }).then(() => { setName(""); setBody(""); }); }}>
      <input placeholder="Signature name" value={name} onChange={(e) => setName(e.target.value)} required />
      <textarea placeholder="Best,\nAda" value={body} onChange={(e) => setBody(e.target.value)} required />
      <label className="check-row"><input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Default signature</label>
      <button className="btn" type="submit">Add signature</button>
    </form>
  );
}

function TemplateForm({ onSave }: { onSave: (body: { name: string; subject: string; html_body: string; text_body: string }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  return (
    <form className="stack-form" onSubmit={(e) => { e.preventDefault(); void onSave({ name, subject, html_body: `<p>${body.replace(/\n/g, "<br/>")}</p>`, text_body: body }).then(() => { setName(""); setSubject(""); setBody(""); }); }}>
      <div className="row-form">
        <input placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <textarea placeholder="Message body" value={body} onChange={(e) => setBody(e.target.value)} required />
      <button className="btn" type="submit">Add template</button>
    </form>
  );
}

function ContactForm({ onSave }: { onSave: (email: string, name: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  return (
    <form className="row-form" onSubmit={(e) => { e.preventDefault(); void onSave(email, name).then(() => { setEmail(""); setName(""); }); }}>
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <button className="btn" type="submit">Add contact</button>
    </form>
  );
}

function FilterForm({ onSave }: { onSave: (body: {
  name: string;
  match_from?: string;
  match_to?: string;
  match_subject?: string;
  action: string;
  forward_to?: string;
  label?: string;
  is_catch_all?: boolean;
}) => Promise<void> }) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [action, setAction] = useState("archive");
  const [forwardTo, setForwardTo] = useState("");
  const [label, setLabel] = useState("");
  const [catchAll, setCatchAll] = useState(false);
  return (
    <form className="stack-form" onSubmit={(e) => {
      e.preventDefault();
      void onSave({
        name,
        match_from: from,
        match_to: to,
        match_subject: subject,
        action,
        forward_to: forwardTo,
        label,
        is_catch_all: catchAll,
      }).then(() => {
        setName("");
        setFrom("");
        setTo("");
        setSubject("");
        setForwardTo("");
        setLabel("");
        setCatchAll(false);
      });
    }}>
      <div className="row-form">
        <input placeholder="Rule name" value={name} onChange={(e) => setName(e.target.value)} required />
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="archive">Archive</option>
          <option value="spam">Spam</option>
          <option value="trash">Trash</option>
          <option value="star">Star</option>
          <option value="label">Auto-label</option>
          <option value="forward">Forward</option>
          <option value="inbox">Keep in inbox</option>
        </select>
      </div>
      <div className="row-form">
        <input placeholder="From contains" value={from} onChange={(e) => setFrom(e.target.value)} disabled={catchAll} />
        <input placeholder="To contains" value={to} onChange={(e) => setTo(e.target.value)} disabled={catchAll} />
        <input placeholder="Subject contains" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={catchAll} />
      </div>
      {action === "forward" ? <input placeholder="Forward to email" value={forwardTo} onChange={(e) => setForwardTo(e.target.value)} required /> : null}
      {action === "label" ? <input placeholder="Label name" value={label} onChange={(e) => setLabel(e.target.value)} required /> : null}
      <label className="check-row"><input type="checkbox" checked={catchAll} onChange={(e) => setCatchAll(e.target.checked)} /> Catch-all (apply when no other rule matches)</label>
      <button className="btn" type="submit">Add rule</button>
    </form>
  );
}

function AliasForm({
  mailboxes,
  onSave,
}: {
  mailboxes: Mailbox[];
  onSave: (body: { mailbox_id: string; local_part: string; label?: string; disposable?: boolean; expires_at?: number | null }) => Promise<void>;
}) {
  const [localPart, setLocalPart] = useState("");
  const [mailboxId, setMailboxId] = useState(mailboxes[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [disposable, setDisposable] = useState(false);
  useEffect(() => {
    if (!mailboxId && mailboxes[0]) setMailboxId(mailboxes[0].id);
  }, [mailboxId, mailboxes]);
  return (
    <form className="stack-form" onSubmit={(e) => {
      e.preventDefault();
      void onSave({
        mailbox_id: mailboxId,
        local_part: localPart,
        label,
        disposable,
        expires_at: disposable ? Date.now() + 7 * 24 * 60 * 60 * 1000 : null,
      }).then(() => {
        setLocalPart("");
        setLabel("");
        setDisposable(false);
      });
    }}>
      <div className="row-form">
        <input placeholder="local-part" value={localPart} onChange={(e) => setLocalPart(e.target.value)} required />
        <select value={mailboxId} onChange={(e) => setMailboxId(e.target.value)} required>
          {mailboxes.map((m) => <option key={m.id} value={m.id}>{m.address}</option>)}
        </select>
      </div>
      <div className="row-form">
        <input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <label className="check-row"><input type="checkbox" checked={disposable} onChange={(e) => setDisposable(e.target.checked)} /> Disposable (7 days)</label>
      </div>
      <button className="btn" type="submit" disabled={!mailboxId}>Add alias</button>
    </form>
  );
}
