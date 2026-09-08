# SNS / inbound webhook trust model

**Date:** 2026-09-09  
**Code:** `worker/lib/sns-verify.ts`, `worker/lib/inbound-webhook.ts`, `worker/lib/mail-provider.ts`, `shared/security-guards.ts`

## Layers

1. **Flap HMAC (`X-Flap-Signature` + `X-Flap-Timestamp`)**  
   Shared secret (`SES_INBOUND_WEBHOOK_SECRET`). Timestamp required with ≤15 minute skew when secret is configured. Prevents unsigned Lambda/relay bodies and unlimited replay of captured payloads.

2. **Native AWS SNS signature (when body is an SNS envelope)**  
   - Detect envelope via `Type` + `Signature` + `SigningCertURL`.  
   - `SigningCertURL` must be HTTPS on `sns.<region>.amazonaws.com` with a non-empty path.  
   - Fetch PEM (short TTL cache), verify RSASSA-PKCS1-v1_5 (SHA-256 for SignatureVersion 2).  
   - Fail closed if envelope present but verify fails.

3. **SubscribeURL SSRF guard**  
   SubscriptionConfirmation fetches SubscribeURL only when host matches the same SNS HTTPS allowlist.

4. **Dev escape hatch**  
   `SES_INBOUND_ALLOW_UNSIGNED` (and Mailgun equivalent) must never be set in production.

## Explicitly not done

- Full Amazon CA pin / certificate transparency pinning (fragile operationally; host allowlist + signature verify is the chosen trust model).
- Trusting bare SES event JSON without HMAC when secret is configured.

## Replay / idempotency

- HMAC timestamp skew bounds replay window.  
- Inbound provider message ids use claim lifecycle (`processing` → `stored` / failure); duplicates ACK only when terminal `stored`/`duplicate`.

## Tests

Covered in `shared/security-phase-b.test.ts` (allowlists, canonical string-to-sign, fixture SignatureVersion 2 verify, tamper reject, envelope detection).
