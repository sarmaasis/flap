# Inlet

Self-hosted custom-domain email inbox on your Cloudflare account.
Inlet is MIT licensed. Author: Ashish Sharma.
## Local
Visit /setup first, then Settings for domain and mailbox.
Install packages, copy the env example file, migrate the local database, then start the dev server.
## Deploy
Create the D1 database named inlet. R2 bucket is optional.
Put the database id in wrangler.jsonc. Keep binding name DB.
Sending needs a paid Workers plan and the SEB binding.
## Email Routing
Enable Email Routing. Create a rule that sends the mailbox to this Worker.
MX records: route1.mx.cloudflare.net (13), route2.mx.cloudflare.net (27), route3.mx.cloudflare.net (40).
SPF TXT: v=spf1 include:_spf.mx.cloudflare.net ~all
DKIM: copy cf2024-1._domainkey TXT from the Email Routing dashboard. Inlet does not write DNS.
## Bindings
DB (D1) required. INLET_ATTACHMENTS (R2) optional. SEB (send_email) required to send. ASSETS for the SPA. Secrets: SESSION_SECRET and APP_URL.
If R2 is missing, attachments are skipped with a clear error. If SEB is missing, send returns 501.
MIT. Copyright (c) 2026 Ashish Sharma.
