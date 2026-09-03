import { useEffect, useState } from "react";
import {
  api,
  type ApiKey,
  type BlockedSender,
  type Contact,
  type DnsRecords,
  type Domain,
  type Filter,
  type Mailbox,
  type Prefs,
  type Signature,
  type Template,
} from "../lib/api";
import { go } from "../lib/nav";
import AppShell from "../components/AppShell";

type Tab = "setup" | "compose" | "contacts" | "filters" | "privacy";

export default function Settings() {
  const [tab, setTab] = useState<Tab>("setup");
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
  const [prefs, setPrefs] = useState<Prefs>({ vacation_enabled: 0, vacation_body: "" });
  const [newToken, setNewToken] = useState("");

  async function refresh() {
    const me = await api.me();
    setEmail(me.user.email);
    const [d, m, s, t, c, f, b, k, p] = await Promise.all([
      api.domains(),
      api.mailboxes(),
      api.signatures(),
      api.templates(),
      api.contacts(),
      api.filters(),
      api.blocked(),
      api.keys(),
      api.prefs(),
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
    setPrefs(p.settings);
    const focus = d.domains.find((x) => x.id === domainId) ?? d.domains[0];
    if (focus) setDns((await api.dns(focus.name)).records);
  }

  useEffect(() => {
    refresh().catch(() => go("/login"));
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

  const selectedName = domains.find((d) => d.id === domainId)?.name ?? "your-domain.com";
  const hasDomain = domains.length > 0;
  const hasMailbox = mailboxes.length > 0;

  return (
    <AppShell email={email} current="settings" onLogout={() => void logout()}>
      <main className="settings">
        <div className="settings-intro">
          <p className="eyebrow">Workspace</p>
          <h1>Settings</h1>
          <p className="lede">Connect your domain, then polish how Inlet sends, files, and remembers people.</p>
        </div>
        <div className="settings-tabs" role="tablist">
          {([["setup", "Setup"], ["compose", "Compose"], ["contacts", "Contacts"], ["filters", "Filters"], ["privacy", "Privacy"]] as const).map(([id, label]) => (
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
                <span>3</span><div><strong>Route email in Cloudflare</strong><small>Create the matching Worker routing rule</small></div>
              </li>
            </ol>
            <section className="settings-card" aria-labelledby="domains-title">
              <div className="section-heading"><div><h2 id="domains-title">Domains</h2><p>Add the domain managed in your Cloudflare account.</p></div></div>
              <form className="row-form" onSubmit={addDomain}>
                <label className="sr-only" htmlFor="domain-name">Domain name</label>
                <input id="domain-name" placeholder="example.com" value={domainName} onChange={(e) => setDomainName(e.target.value)} required />
                <button className="btn" type="submit">Add domain</button>
              </form>
              {domains.length ? <table className="table"><thead><tr><th>Name</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
                {domains.map((d) => <tr key={d.id}><td><button className={`text-button${domainId === d.id ? " selected" : ""}`} type="button" onClick={() => setDomainId(d.id)}>{d.name}</button></td><td><button className="btn btn-danger" type="button" onClick={() => { if (window.confirm(`Remove ${d.name} and its mailboxes? Existing messages will remain.`)) void api.deleteDomain(d.id).then(refresh); }}>Remove</button></td></tr>)}
              </tbody></table> : <p className="empty-state">No domains yet. Add the domain you plan to receive mail on.</p>}
            </section>
            <section className="settings-card" aria-labelledby="mailboxes-title">
              <div className="section-heading"><div><h2 id="mailboxes-title">Mailboxes</h2><p>Inlet accepts mail only for addresses listed here.</p></div></div>
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
            <div className="section-heading"><div><h2>Smart rules</h2><p>Route incoming mail to archive, spam, trash, or star it automatically.</p></div></div>
            <FilterForm onSave={async (body) => { await api.createFilter(body); await refresh(); setNotice("Filter added."); }} />
            {filters.length ? <table className="table"><thead><tr><th>Name</th><th>Match</th><th>Action</th><th /></tr></thead><tbody>
              {filters.map((f) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td className="muted">{[f.match_from && `from ${f.match_from}`, f.match_to && `to ${f.match_to}`, f.match_subject && `subject ${f.match_subject}`].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{f.action}{f.enabled ? "" : " (off)"}</td>
                  <td className="row-actions">
                    <button type="button" className="text-button" onClick={() => void api.toggleFilter(f.id).then(refresh)}>{f.enabled ? "Disable" : "Enable"}</button>
                    <button type="button" className="btn btn-danger" onClick={() => void api.deleteFilter(f.id).then(refresh)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody></table> : <p className="empty-state">No rules yet. Keep the inbox quiet on your terms.</p>}
          </section>
        ) : null}

        {tab === "privacy" ? (
          <>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Automatic replies</h2><p>Send one vacation reply per sender every seven days.</p></div></div>
              <form className="stack-form" onSubmit={(e) => { e.preventDefault(); void api.savePrefs({ vacation_enabled: Boolean(prefs.vacation_enabled), vacation_body: prefs.vacation_body }).then(() => setNotice("Automatic replies updated.")); }}>
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
              <div className="section-heading"><div><h2>Backup</h2><p>Download messages, contacts, templates, and signatures as JSON.</p></div></div>
              <button type="button" className="btn" onClick={() => void api.exportBackup().catch((ex) => setErr(ex instanceof Error ? ex.message : "Export failed."))}>Download backup</button>
            </section>
          </>
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

function FilterForm({ onSave }: { onSave: (body: { name: string; match_from?: string; match_to?: string; match_subject?: string; action: string }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [action, setAction] = useState("archive");
  return (
    <form className="stack-form" onSubmit={(e) => { e.preventDefault(); void onSave({ name, match_from: from, match_subject: subject, action }).then(() => { setName(""); setFrom(""); setSubject(""); }); }}>
      <div className="row-form">
        <input placeholder="Rule name" value={name} onChange={(e) => setName(e.target.value)} required />
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="archive">Archive</option>
          <option value="spam">Spam</option>
          <option value="trash">Trash</option>
          <option value="star">Star</option>
          <option value="inbox">Keep in inbox</option>
        </select>
      </div>
      <div className="row-form">
        <input placeholder="From contains" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input placeholder="Subject contains" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <button className="btn" type="submit">Add rule</button>
    </form>
  );
}
