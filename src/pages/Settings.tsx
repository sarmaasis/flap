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
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not add mailbox.");
    }
  }

  async function logout() {
    await api.logout();
    go("/");
  }

  const selectedName = domains.find((d) => d.id === domainId)?.name ?? "your-domain.com";

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
      <div className="settings">
        <h1>Domain and mailbox</h1>
        <p className="lede">
          Add the domain you receive on, then a local part. After DNS is live, create an Email Routing rule
          that sends that address to this Worker.
        </p>
        {err ? <div className="err">{err}</div> : null}

        <h3>Domains</h3>
        <form className="row-form" onSubmit={addDomain}>
          <input placeholder="example.com" value={domainName} onChange={(e) => setDomainName(e.target.value)} />
          <button className="btn" type="submit">Add domain</button>
        </form>
        <table className="table">
          <thead><tr><th>Name</th><th /></tr></thead>
          <tbody>
            {domains.map((d) => (
              <tr key={d.id}>
                <td>
                  <button className="btn btn-ghost" type="button" onClick={() => setDomainId(d.id)}>{d.name}</button>
                </td>
                <td>
                  <button className="btn btn-danger" type="button" onClick={() => void api.deleteDomain(d.id).then(refresh)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 style={{ marginTop: 28 }}>Mailboxes</h3>
        <form className="row-form" onSubmit={addMailbox}>
          <input placeholder="hello" value={localPart} onChange={(e) => setLocalPart(e.target.value)} />
          <select value={domainId} onChange={(e) => setDomainId(e.target.value)} style={{ maxWidth: 220 }}>
            {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button className="btn" type="submit" disabled={!domainId}>Add mailbox</button>
        </form>
        <table className="table">
          <thead><tr><th>Address</th><th /></tr></thead>
          <tbody>
            {mailboxes.map((m) => (
              <tr key={m.id}>
                <td>{m.address}</td>
                <td>
                  <button className="btn btn-danger" type="button" onClick={() => void api.deleteMailbox(m.id).then(refresh)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 style={{ marginTop: 32 }}>DNS checklist for {selectedName}</h3>
        <p className="muted">
          Documented Cloudflare Email Routing records. You add these at the DNS host. Inlet does not call
          a DNS write API.
        </p>
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
      </div>
    </div>
  );
}
