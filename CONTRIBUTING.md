# Contributing to Inlet

Thanks for helping make Inlet more dependable.

## Before you start

- Search existing issues before opening a new one.
- Use the issue templates for bugs and feature ideas.
- Discuss substantial design changes in an issue before writing a large pull request.

## Development

```bash
npm install
npm run db:migrate:local
npm run check
npm run build
```

Never commit real Cloudflare account IDs, API tokens, mailbox contents, or production database data. Keep migrations forward-only and document any new binding or configuration requirement in the README.

## Pull requests

Keep each pull request focused. Include a clear description, testing notes, and screenshots for visual changes. Before requesting review, run:

```bash
npm run check
npm run build
```

## Reporting security issues

Do not open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md).
