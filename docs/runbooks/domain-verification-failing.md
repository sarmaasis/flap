# Runbook: Domain verification failing

1. Settings domain: identity / MX / DKIM records.
2. Trailing-dot and casing: names stored lowercase; duplicates blocked globally (`0031`).
3. If domain already belongs to another workspace — do not override; customer must remove it there first.
4. Transfer is **not implemented** — see `docs/rfc-domain-client-transfer.md`.
