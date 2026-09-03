# Inlet

**A small, self-operated inbox for addresses on your own domain.**

Inlet runs on your Cloudflare account. Cloudflare Email Routing delivers mail to a Worker; Inlet stores messages in D1 and, when configured, attachments in R2. It is designed for a personal domain or a small, technically operated mailbox—not as a replacement for a hosted business-email suite.

> Inlet is self-operated, not infrastructure-independent: it relies on Cloudflare Workers, D1, R2, and Email Routing.

## What it includes

- Inbound mail for explicitly configured mailbox addresses
- Outbound plain-text email through Cloudflare's `send_email` binding
- Inbox, Sent, Drafts, Spam, and Trash folders
- Search, mailbox filtering, and attachment downloads
- A browser-based setup path and DNS checklist

## Before you start

You need:

1. A Cloudflare account and a domain whose DNS you control.
2. Cloudflare Email Routing enabled for that domain.
3. A D1 database. R2 is strongly recommended for attachments.
4. A Workers plan that supports the `send_email` binding if you need outbound mail.

Inlet intentionally accepts mail only for mailboxes you add in Settings. Configure a Cloudflare catch-all rule only if you understand that unmatched addresses will be rejected.

## Deploy to Cloudflare

### 1. Get the code and install dependencies

```bash
git clone https://github.com/<your-account>/inlet.git
cd inlet
npm install
```

### 2. Create Cloudflare resources

```bash
npx wrangler d1 create inlet
npx wrangler r2 bucket create inlet-attachments
```

Copy the D1 `database_id` returned by the first command into `wrangler.jsonc`. The included configuration uses the bindings `DB`, `INLET_ATTACHMENTS`, and `SEB`; do not rename them unless you update the source too.

### 3. Apply the database schema

```bash
npm run db:migrate:remote
```

### 4. Deploy

```bash
npm run deploy
```

Visit the `inlet` Worker URL and create the first administrator account. Then open **Settings**, add your domain, and add each address you want Inlet to accept. You can rename the Worker later in `wrangler.jsonc` if you prefer a different deployment name.

### 5. Route email to Inlet

In the Cloudflare dashboard for your domain:

1. Enable **Email Routing** and follow its DNS setup. Cloudflare will provide the MX, SPF, and DKIM records for your zone.
2. In **Email Routing → Routing rules**, create a rule for each Inlet address (for example `hello@example.com`).
3. Choose **Send to a Worker** and select your Inlet Worker.
4. Send a test message and confirm it appears in the Inbox.

For outbound mail, configure the `send_email` binding as shown in `wrangler.jsonc`, enable the required Email Routing settings, and use a Workers plan that supports sending. Cloudflare may require destination-address verification depending on your account configuration.

## Local development

```bash
npm install
npm run db:migrate:local
npm run dev
```

Open `http://localhost:5173/setup` to create the first local account. Local development does not receive real email unless you use Cloudflare's remote development tools and configure Email Routing.

## Quality checks

```bash
npm run check
npm run build
```

## Continuous deployment with GitHub Actions

The included [deployment workflow](.github/workflows/deploy.yml) validates every production deployment, then deploys the Worker when changes are pushed to `main`. It does not deploy documentation-only changes.

Before enabling it, create a GitHub Environment named `Deploy` and add these environment secrets:

- `CLOUDFLARE_API_TOKEN` — a scoped Cloudflare API token allowed to deploy this Worker and manage its bound resources.
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account ID that owns the Worker.

Create a custom token scoped to that single Cloudflare account. Grant **Workers Scripts: Edit** and **Account Settings: Read**. Also grant **D1: Edit** if you will use the workflow's manual migration option, and **Workers R2 Storage: Edit** because Inlet binds an R2 attachment bucket. Do not grant DNS, Email Routing, billing, or full-account access: this workflow does not manage them. **Workers Routes: Edit** is needed only if you later add Worker route configuration to `wrangler.jsonc`.

Keep `wrangler.jsonc` committed with the real D1 database ID before the first deployment. Protect the `main` branch and require the **Validate** job to pass before merging.

Database migrations are deliberately manual: open **Actions → Deploy Inlet → Run workflow**, enable **Apply pending D1 migrations**, and run it. The workflow applies migrations first and deploys only if they succeed. Normal pushes deploy code without changing the database schema.

## Operations and limits

- Incoming messages larger than 25 MB are rejected before storage.
- Attachment storage requires the `INLET_ATTACHMENTS` R2 binding. Without it, messages are stored but attachments are not retained.
- Back up your D1 database and R2 bucket. Inlet does not currently provide an export or backup scheduler.
- Inlet does not include virus scanning, advanced spam filtering, multi-user accounts, IMAP/SMTP, or a general-purpose catch-all mailbox. Put those controls in place before using it for sensitive or high-volume mail.

## Contributing

Bug reports and focused pull requests are welcome. Please run `npm run check` and `npm run build` before opening a PR, keep changes narrowly scoped, and document any new configuration or migration.

## Security

Do not report security vulnerabilities in a public issue. See [SECURITY.md](SECURITY.md) for the reporting policy.

## License

[MIT](LICENSE) © 2026 Ashish Sharma
