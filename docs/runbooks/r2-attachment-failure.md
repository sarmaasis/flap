# Runbook: R2 attachment failure

1. Confirm `ATTACHMENTS` binding.
2. Message row may exist without bytes — show error, do not invent content.
3. Cross-tenant download must remain 404 even during incidents.
4. After restore, reconcile `attachments.r2_key` vs bucket.
