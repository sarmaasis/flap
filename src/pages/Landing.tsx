import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { go } from "../lib/nav";

function Mark() {
  return (
    <span className="brand-mark" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2.5 5.2L8 8.8l5.5-3.6V11a1.2 1.2 0 0 1-1.2 1.2H3.7A1.2 1.2 0 0 1 2.5 11V5.2z" fill="#fafafa" />
        <path d="M2.5 5.2L8 8.8l5.5-3.6L8 3 2.5 5.2z" fill="#a1a1aa" />
      </svg>
    </span>
  );
}

export default function Landing() {
  const [setup, setSetup] = useState<boolean | null>(null);
  useEffect(() => {
    api.setupStatus().then((s) => setSetup(s.needs_setup)).catch(() => setSetup(null));
  }, []);

  return (
    <div className="page">
      <div className="wrap">
        <header className="nav">
          <a className="brand" href="/" onClick={(e) => { e.preventDefault(); go("/"); }}>
            <Mark /> Inlet
          </a>
          <nav className="nav-links">
            <a href="#how">How it works</a>
            <a href="https://github.com/sarmaasis/inlet" target="_blank" rel="noreferrer">GitHub</a>
            <a href="/login" onClick={(e) => { e.preventDefault(); go("/login"); }}>Sign in</a>
            <a className="btn" href={setup ? "/setup" : "/app"} onClick={(e) => { e.preventDefault(); go(setup ? "/setup" : "/app"); }}>
              {setup ? "Create admin" : "Open inbox"}
            </a>
          </nav>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Your address. Your infrastructure.</p>
            <h1>Email that feels like it belongs to you.</h1>
            <p className="lede">
              Inlet is a focused inbox for your own domain, running inside your Cloudflare account.
              Receive, reply, and keep control of every message.
            </p>
            <div className="hero-actions">
              <a className="btn" href={setup ? "/setup" : "/login"} onClick={(e) => { e.preventDefault(); go(setup ? "/setup" : "/login"); }}>
                {setup ? "Start first-run setup" : "Open your inbox"}
              </a>
              <a className="btn btn-ghost" href="#how">See how it works</a>
            </div>
          </div>
          <div className="hero-preview" aria-label="Example inbox preview">
            <div className="preview-top"><span className="preview-dot" /><strong>Inbox</strong><span className="preview-count">3 new</span></div>
            <div className="preview-message highlight"><span className="avatar coral">A</span><div><strong>Ava at Northstar</strong><small>Welcome to your new address</small></div><time>9:41</time></div>
            <div className="preview-message"><span className="avatar violet">C</span><div><strong>Cloudflare</strong><small>Your routing rule is active</small></div><time>Yesterday</time></div>
            <div className="preview-message"><span className="avatar mint">M</span><div><strong>Mom</strong><small>Call me when you can</small></div><time>Mon</time></div>
            <div className="preview-footer">hello@yourdomain.com <span>•</span> yours to keep</div>
          </div>
        </section>

        <section className="grid-3" id="how">
          <article className="card">
            <h3>Your Cloudflare, your store</h3>
            <p>Inlet does not hold mail in a shared product account. Deploy the Worker, bind D1 and R2, and keep control with the operator.</p>
          </article>
          <article className="card">
            <h3>Inbound on Email Routing</h3>
            <p>Point MX at Cloudflare, then send matching addresses to this Worker. Inlet parses the message and files it under Inbox.</p>
          </article>
          <article className="card">
            <h3>Outbound you control</h3>
            <p>Compose from a mailbox you added. Sending uses the send_email binding. A paid Workers plan is required to send.</p>
          </article>
        </section>

        <section className="grid-3">
          <article className="card">
            <h3>Folders that stay boring</h3>
            <p>Inbox, Sent, Drafts, Spam, and Trash. Search subject, parties, and body text. Move a message when it no longer belongs.</p>
          </article>
          <article className="card">
            <h3>DNS you can check</h3>
            <p>Settings lists MX, SPF, and DKIM as documented records. Inlet does not pretend to write DNS through a hidden API.</p>
          </article>
          <article className="card">
            <h3>Quiet to operate</h3>
            <p>One admin on first run. Session cookie after sign-in. MIT licensed. Built to sit on a domain you already pay for.</p>
          </article>
        </section>

        <footer className="foot">
          <span>Inlet. MIT License. Ashish Sharma.</span>
          <span><a href="https://github.com/sarmaasis/inlet" target="_blank" rel="noreferrer">View source</a> · <a href="https://github.com/sarmaasis/inlet/fork" target="_blank" rel="noreferrer">Fork on GitHub</a></span>
        </footer>
      </div>
    </div>
  );
}
