# Runbook: SES bounce / complaint spike

1. Delivery events + suppressions for the workspace (not another tenant).
2. Pause large newsletters / API send if complaint rate spikes.
3. Confirm Flap vs SES account-level suppressions (SES may block addresses Flap does not list).
4. No automatic account suspend is implemented — operator decision.
