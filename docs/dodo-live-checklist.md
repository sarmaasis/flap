# Dodo live-mode checklist (distribution blocker)

Before Product Hunt / paid traffic:

- [ ] Worker secret `DODO_PAYMENTS_API_KEY` = **live** key
- [ ] `DODO_PAYMENTS_ENVIRONMENT=live_mode`
- [ ] `DODO_PAYMENTS_WEBHOOK_KEY` set; webhook URL `https://useflap.online/api/billing/webhook` verified
- [ ] Live product IDs: `DODO_PRODUCT_SOLO`, `DODO_PRODUCT_BUILDER`, `DODO_PRODUCT_STUDIO` (+ annual IDs if marketed)
- [ ] One real card checkout in live (or confirmed staging → live cutover checklist)
- [ ] `support@useflap.online` receives mail (SES / SEB path tested)
- [ ] Cancel + export copy visible from `/pricing` and Settings → Billing

Local/dev stays `DODO_PAYMENTS_ENVIRONMENT=test_mode` in `.dev.vars.example`.
