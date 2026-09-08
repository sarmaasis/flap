/**
 * Phase B security unit tests (no network / D1).
 * Run: npx tsx shared/security-phase-b.test.ts
 */

import {
  inboundClaimIsFreshProcessing,
  inboundClaimIsTerminalDuplicate,
  isAllowedSnsSubscribeUrl,
  isAllowedSnsSigningCertUrl,
  isSnsEnvelope,
  buildSnsStringToSign,
  extractSpkiFromX509Der,
  pemToDer,
  resolveReplyFromAddress,
  softBounceExpiresAt,
  verifySnsSignatureWithPem,
  SOFT_BOUNCE_TTL_MS,
  INBOUND_CLAIM_STALE_MS,
} from "./security-guards.ts";
import { domainIsSendingReady, type ReadinessRow } from "./ses-dns.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function extractEmail(raw: string): string {
  const m = /<([^>]+)>/.exec(raw);
  const addr = (m?.[1] || raw).trim().toLowerCase();
  return addr.includes("@") ? addr : "";
}

// --- Reply-from identity ---
{
  const mboxes = [
    { id: "mb1", address: "support@product-a.com" },
    { id: "mb2", address: "hello@product-b.com" },
  ];
  const fromMailbox = resolveReplyFromAddress(
    { mailbox_id: "mb1", to_addr: "support@product-a.com" },
    mboxes,
    extractEmail,
  );
  assert(fromMailbox === "support@product-a.com", "reply-from uses receiving mailbox");

  const fromTo = resolveReplyFromAddress(
    { mailbox_id: "missing", to_addr: "Hello <hello@product-b.com>" },
    mboxes,
    extractEmail,
  );
  assert(fromTo === "hello@product-b.com", "reply-from falls back to owned To address");

  const external = resolveReplyFromAddress(
    { mailbox_id: "missing", to_addr: "customer@gmail.com" },
    mboxes,
    extractEmail,
  );
  assert(external === undefined, "reply-from never returns external address");
}

// --- Domain sending readiness (verification gate) ---
{
  const pending: ReadinessRow = {
    mail_provider: "ses",
    provider_state: "DNS_PENDING",
    identity_verified_at: null,
    mx_verified_at: null,
    inbound_rule_ready_at: null,
    receiving_ready_at: null,
    sending_ready_at: null,
  };
  assert(!domainIsSendingReady(pending), "SES domain without sending_ready_at cannot send");
  assert(
    domainIsSendingReady({ ...pending, sending_ready_at: 1 }),
    "SES domain with sending_ready_at can send",
  );
  assert(
    !domainIsSendingReady({
      ...pending,
      mail_provider: "mailgun",
      provider_state: "PENDING",
    }),
    "Mailgun without mx/verified state cannot send",
  );
  assert(
    domainIsSendingReady({
      ...pending,
      mail_provider: "mailgun",
      mx_verified_at: 1,
    }),
    "Mailgun with mx_verified_at can send",
  );
}

// --- SNS SubscribeURL SSRF guard ---
{
  assert(
    isAllowedSnsSubscribeUrl("https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&Token=abc"),
    "valid SNS URL allowed",
  );
  assert(!isAllowedSnsSubscribeUrl("https://evil.example/ssrf"), "non-SNS host rejected");
  assert(!isAllowedSnsSubscribeUrl("http://sns.us-east-1.amazonaws.com/"), "http rejected");
  assert(
    !isAllowedSnsSubscribeUrl("https://sns.us-east-1.amazonaws.com.evil.com/"),
    "suffix spoof rejected",
  );
  assert(!isAllowedSnsSubscribeUrl("https://user:pass@sns.us-east-1.amazonaws.com/"), "userinfo rejected");
  assert(!isAllowedSnsSubscribeUrl("not-a-url"), "garbage rejected");
}

// --- SNS SigningCertURL allowlist ---
{
  assert(
    isAllowedSnsSigningCertUrl(
      "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc.pem",
    ),
    "SigningCertURL on sns host allowed",
  );
  assert(
    !isAllowedSnsSigningCertUrl("https://sns.us-east-1.amazonaws.com/"),
    "origin-only SigningCertURL rejected",
  );
  assert(
    !isAllowedSnsSigningCertUrl("https://evil.example/cert.pem"),
    "non-SNS SigningCertURL rejected",
  );
}

// --- Soft bounce TTL ---
{
  const now = 1_700_000_000_000;
  assert(softBounceExpiresAt(now) === now + SOFT_BOUNCE_TTL_MS, "soft bounce expires in 72h");
}

// --- Inbound claim lifecycle ---
{
  const now = 1_000_000;
  assert(inboundClaimIsTerminalDuplicate("stored"), "stored is terminal");
  assert(inboundClaimIsTerminalDuplicate("duplicate"), "duplicate is terminal");
  assert(!inboundClaimIsTerminalDuplicate("processing"), "processing is not terminal");
  assert(
    inboundClaimIsFreshProcessing("processing", now - 60_000, now),
    "recent processing is fresh",
  );
  assert(
    !inboundClaimIsFreshProcessing("processing", now - INBOUND_CLAIM_STALE_MS - 1, now),
    "stale processing can be reclaimed",
  );
  assert(!inboundClaimIsFreshProcessing("stored", now, now), "stored is not fresh processing");
}

// --- Native SNS signature verify (WebCrypto + X.509 SPKI extract, no npm deps) ---
{
  // Self-signed RSA fixture signed offline with openssl (SignatureVersion 2 / SHA-256).
  const fixturePem = `-----BEGIN CERTIFICATE-----
MIIDBzCCAe+gAwIBAgIUD9ahHntmdIpLr0ADDJ7LczHUGxswDQYJKoZIhvcNAQEL
BQAwEzERMA8GA1UEAwwIc25zLXRlc3QwHhcNMjYwOTA4MjAyMDMxWhcNMjcwOTA4
MjAyMDMxWjATMREwDwYDVQQDDAhzbnMtdGVzdDCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBAMirW40nEp8WEFVUjPlfGokNyIjP1Sr2ZK6qMS4yKrYwysF+
cuxQvYJP7f9utFgzzgcBdSvYYjJt/giwF6dvM21vYxgbsUP6ZHEwBGc1Zq7OmUII
lUq5VF7BHR0dN73jQgJ7XqaP+kNR7/Cerpj2q33v020uWJqux84NEID85+wQg3CF
j6EcOf92CkJKB+CVjCu7VAsZ6nOlSZQmS26BoueoO+E6IXRtXMxX+Dj5T74b2Oxo
MVq3sw+EKA5PzeUMMXNab42x74xNQ5IRYaueSSm5TuL3KPQeBmIxdZCFr+mh6oX8
KJjIIo4pq9PEfmjy+68KG4h93Wmk7HQzONhdwu0CAwEAAaNTMFEwHQYDVR0OBBYE
FEI9uHbDJ/r2SmHpDcdcnIyiyTSBMB8GA1UdIwQYMBaAFEI9uHbDJ/r2SmHpDcdc
nIyiyTSBMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAHLsQQHj
g6MXvm4oTztVB6PT/EXQMEA6TJkFN4OhivgnK+LUM0MnxnoQfxQxzVUQLWX65M7r
Plc/Di4/Sf5DStHM7AabIrTb/5VFcC2srrCkv5id7bE+u/YFXdBKEstemeCluSKM
PVp3s/Dk3LoBUbdnUIa9ykiMy5ohC1/hV8zKUhGfl7Sd54uzH1mkSzEoLDxXPjrz
k523AeNJqF8GofKk8P14vBaPl0ibm0UMvviENVFHbRLe4R36k+Y0ARsbnrBJCyx2
ZMIBix3GQ3SsXlOJP0b/OqsTH22vXePG/j51+s3z0tUFxn6/u0G5dn4PdcqqaNvx
xVpPYFSkPJExnyY=
-----END CERTIFICATE-----`;
  const fixtureSig =
    "g6d537kbhX9Mjwy6s5jxfrB79Hfk1Th48ot9QRdL4uu0l1Oiwe4BNsLks2G2LWoJFA6sboSj4Cyw5w0mP75tgy8YnNKkElGeb3h7ZEVxHk9c0pBpKdHxC7eK4RmWsbOdezCKrh8hGvH+9qhcbrkWsTJcNii25yK8afFanXyuxOF2J72+YM5g2l6ujHr5u6h5JLRcqYJXlS6+qHXmY8RciWksxF/w9g811E4nKT64v0kGcM5Tg94gFbu6l+uW0kAUNGDOTdwGR2+x6NgRGy6OhgrZwUxz9lbwXgoq5MGk+WzT6Rw2JrcJX0uD0Rz2MXembcv8Xh1r9Q1yCdVCT1+dCg==";

  const payload = {
    Type: "Notification",
    MessageId: "msg-1",
    TopicArn: "arn:aws:sns:us-east-1:123456789012:test",
    Message: "hello",
    Timestamp: "2024-01-01T00:00:00.000Z",
    Subject: "subj",
    SignatureVersion: "2",
    Signature: fixtureSig,
    SigningCertURL: "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-test.pem",
  };

  assert(isSnsEnvelope(payload), "fixture detected as SNS envelope");
  assert(!isSnsEnvelope({ notificationType: "Bounce" }), "bare SES event is not SNS envelope");

  const canonical = buildSnsStringToSign(payload);
  assert(
    canonical ===
      [
        "Message",
        "hello",
        "MessageId",
        "msg-1",
        "Subject",
        "subj",
        "Timestamp",
        "2024-01-01T00:00:00.000Z",
        "TopicArn",
        "arn:aws:sns:us-east-1:123456789012:test",
        "Type",
        "Notification",
        "",
      ].join("\n"),
    "canonical string exact",
  );

  const withoutSubject = { ...payload };
  delete (withoutSubject as { Subject?: string }).Subject;
  const canonNoSubj = buildSnsStringToSign(withoutSubject);
  assert(canonNoSubj !== null && !canonNoSubj.includes("Subject\n"), "Subject omitted when absent");

  const der = pemToDer(fixturePem);
  assert(der && der.length > 100, "PEM decodes to DER");
  const spki = extractSpkiFromX509Der(der!);
  assert(spki && spki[0] === 0x30, "SPKI extracted from X.509");

  const ok = await verifySnsSignatureWithPem(payload, fixturePem);
  assert(ok, "SNS SignatureVersion 2 verifies with fixture cert");

  const tampered = { ...payload, Message: "tampered" };
  assert(!(await verifySnsSignatureWithPem(tampered, fixturePem)), "tampered message fails verify");
}

console.log("shared/security-phase-b checks passed");
