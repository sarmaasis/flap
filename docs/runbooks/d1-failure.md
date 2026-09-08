# Runbook: D1 failure

1. Cloudflare D1 status + Worker 5xx.
2. Do not retry inbound in a way that creates duplicate visible messages.
3. Fail closed on writes (invites, sends).
4. Restore only from a reviewed snapshot (backup runbook).
