# Runbook: Inbound mail missing

1. Domain `last_inbound_error` / Settings Delivery.
2. `inbound_ingest_log` for provider message id (Phase B).
3. Confirm MX still points at Flap; mailbox not deleted.
4. Duplicate provider id → already stored (check existing message).
5. Retryable vs terminal — do not reprocess terminal `stored` as new mail.
6. SNS signature failures: see `docs/sns-webhook-trust-model.md`.
