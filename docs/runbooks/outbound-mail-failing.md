# Runbook: Outbound mail failing

1. Domain sending_ready / provider_state SUSPENDED.
2. Suppression list for recipient (workspace-scoped).
3. Monthly send room.
4. Scheduled drafts with snippet `Send cancelled` or `Send failed` — permission or SES error.
5. Newsletter path must use the same domain policy helper.
6. Do not disable SNS/HMAC verification to “fix” delivery.
