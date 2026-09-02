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
            <a href="/login" onClick={(e) => { e.preventDefault(); go("/login"); }}>Sign in</a>
            <a className="btn" href={setup ? "/setup" : "/app"} onClick={(e) => { e.preventDefault(); go(setup ? "/setup" : "/app"); }}>
              {setup ? "Create admin" : "Open inbox"}
            </a>
          </nav>
        </header>

        <section className="hero">
          <h1>Mail for your domain, kept on your account.</h1>
          <p className="lede">
            Inlet is a self-hosted inbox that runs as a Cloudflare Worker. Receive and send on addresses you own.
            Messages live in your D1 database. Attachments go to your R2 bucket.
          </p>
          <div className="hero-actions">
            <a className="btn" href={setup ? "/setup" : "/login"} onClick={(e) => { e.preventDefault(); go(setup ? "/setup" : "/login"); }}>
              {setup ? "Start first-run setup" : "Sign in to Inlet"}
            </a>
            <a className="btn btn-ghost" href="#how">Read the operator path</a>
          </div>
        </section>

        <section className="grid-3" id="how">
          <article className="card">
            <h3>Your Cloudflare, your store</h3>
            <p>Inlet does not hold tenant mail on a shared product account. Deploy the worker, bind D1 and optional R2, and the data stays with the operator.</p>
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
          <span>Deploy on Workers. Keep the keys.</span>
        </footer>
      </div>
    </div>
  );
}
