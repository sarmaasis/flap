import { useEffect, useState } from "react";
import { api, type DnsRecords, type Domain, type Mailbox } from "../lib/api";
import { go } from "../lib/nav";

export default function Settings() {
  const [email, setEmail] = useState("");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [domainName, setDomainName] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [domainId, setDomainId] = useState("");
  const [dns, setDns] = useState<DnsRecords | null>(null);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const me = await api.me();
    setEmail(me.user.email);
    const d = await api.domains();
    setDomains(d.domains);
    if (!domainId && d.domains[0]) setDomainId(d.domains[0].id);
    const m = await api.mailboxes();
    setMailboxes(m.mailboxes);
    const focus = d.domains.find((x) => x.id === domainId) ?? d.domains[0];
    if (focus) {
      const rec = await api.dns(focus.name);
      setDns(rec.records);
    }
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
      await api.createMailbox(domainId, localPart);
      setLocalPart("");
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
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/app" onClick={(e) => { e.preventDefault(); go("/app"); }}>Inlet</a>
        <button className="side-btn" onClick={() => go("/app")}>Inbox</button>
        <button className="side-btn active">Settings</button>
        <div className="side-foot">
          <button className="side-btn" onClick={() => void logout()}>Sign out</button>
          <div className="muted" style={{ padding: "6px 10px", color: "#a1a1aa" }}>{email}</div>
        </div>
      </aside>
      <main className="settings">
        <div className="settings-intro">
          <p className="eyebrow">Workspace setup</p>
          <h1>Connect your mail</h1>
          <p className="lede">Add an address here, then tell Cloudflare Email Routing to send that address to this Worker.</p>
        </div>
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
        {err ? <div className="err">{err}</div> : null}
        {notice ? <div className="notice" role="status">{notice}</div> : null}

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
            <label className="sr-only" htmlFor="mailbox-domain">Domain</label>
            <select id="mailbox-domain" value={domainId} onChange={(e) => setDomainId(e.target.value)} style={{ maxWidth: 220 }} disabled={!hasDomain}>
            {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button className="btn" type="submit" disabled={!domainId}>Add mailbox</button>
          </form>
          {mailboxes.length ? <table className="table"><thead><tr><th>Address</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
            {mailboxes.map((m) => <tr key={m.id}><td>{m.address}</td><td><button className="btn btn-danger" type="button" onClick={() => { if (window.confirm(`Remove ${m.address}?`)) void api.deleteMailbox(m.id).then(refresh); }}>Remove</button></td></tr>)}
          </tbody></table> : <p className="empty-state">{hasDomain ? "Create your first address above." : "Add a domain before creating an address."}</p>}
        </section>

        <section className="settings-card" aria-labelledby="routing-title">
        <div className="section-heading"><div><h2 id="routing-title">Cloudflare routing checklist</h2><p>Finish these steps in the Cloudflare dashboard for {selectedName}.</p></div></div>
        {dns ? (
          <div className="dns">
            <p>{dns.note}</p>
            <p><strong>MX</strong></p>
            {dns.mx.map((r) => (
              <div key={r.value}>
                <code>{r.type} {r.name} {r.priority} {r.value}</code>
              </div>
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
      </main>
    </div>
  );
}
