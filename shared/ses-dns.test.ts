/**
 * SES DNS / readiness unit tests (no AWS network).
 * Run: npx tsx shared/ses-dns.test.ts
 */

import {
  defaultSesDnsRecords,
  dnsBundleFromSes,
  domainIsReceivingReady,
  domainIsSendingReady,
  isFlapMxForProvider,
  isFlapSpfForProvider,
  isSesMx,
  isSesSpf,
  lifecycleFromRow,
  sesInboundMxHost,
  type ReadinessRow,
} from "./ses-dns.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function baseRow(over: Partial<ReadinessRow> = {}): ReadinessRow {
  return {
    mail_provider: "ses",
    provider_state: "DNS_PENDING",
    identity_verified_at: null,
    mx_verified_at: null,
    inbound_rule_ready_at: null,
    receiving_ready_at: null,
    sending_ready_at: null,
    ...over,
  };
}

{
  const dns = defaultSesDnsRecords("example.com", "us-east-1");
  assert(dns.provider === "ses", "provider is ses");
  assert(dns.mx[0]?.value === "inbound-smtp.us-east-1.amazonaws.com", "SES MX host");
  assert(/amazonses\.com/.test(dns.spf.value), "SES SPF");
  assert(dns.verification?.length, "verification rows present");
}

{
  const dns = dnsBundleFromSes("acme.io", "eu-west-1", {
    verificationToken: "tok123",
    dkimTokens: ["aaa", "bbb", "ccc"],
  });
  assert(dns.verification?.[0]?.value === "tok123", "verification token");
  assert(dns.dkim.length === 3, "three Easy DKIM CNAMEs");
  assert(dns.dkim[0]?.value === "aaa.dkim.amazonses.com", "dkim cname target");
  assert(dns.mx[0]?.value === sesInboundMxHost("eu-west-1"), "eu mx");
}

assert(isSesMx("inbound-smtp.us-east-1.amazonaws.com"), "isSesMx");
assert(isSesMx("inbound-smtp.us-east-1.amazonaws.com.", "us-east-1"), "isSesMx with region");
assert(!isSesMx("mxa.mailgun.org", "us-east-1"), "Mailgun MX not SES for ses provider");
assert(isFlapMxForProvider("inbound-smtp.us-west-2.amazonaws.com", "ses", "us-west-2"), "isFlapMx ses");
assert(isFlapMxForProvider("mxa.mailgun.org", "mailgun"), "legacy mailgun");
assert(isFlapMxForProvider("route1.mx.cloudflare.net", "cloudflare"), "legacy cf");
assert(!isFlapMxForProvider("mxa.mailgun.org", "ses", "us-east-1"), "ses domain rejects mailgun mx");
assert(isSesSpf("v=spf1 include:amazonses.com ~all"), "ses spf");
assert(isFlapSpfForProvider("v=spf1 include:amazonses.com ~all", "ses"), "isFlapSpf ses");
assert(!isFlapSpfForProvider("v=spf1 include:mailgun.org ~all", "ses"), "ses rejects mailgun spf");

assert(!domainIsReceivingReady(baseRow()), "pending not receiving");
assert(
  domainIsReceivingReady(
    baseRow({
      identity_verified_at: 1,
      mx_verified_at: 1,
      inbound_rule_ready_at: 1,
    }),
  ),
  "infra triad = receiving ready",
);
assert(domainIsReceivingReady(baseRow({ receiving_ready_at: 99 })), "timestamp wins");
assert(!domainIsSendingReady(baseRow({ identity_verified_at: 1 })), "identity alone ≠ sending");
assert(domainIsSendingReady(baseRow({ sending_ready_at: 1 })), "sending_ready_at");
assert(lifecycleFromRow(baseRow()) === "DNS_PENDING", "lifecycle pending");
assert(lifecycleFromRow(baseRow({ receiving_ready_at: 1, sending_ready_at: 1 })) === "ACTIVE", "lifecycle active");
assert(
  domainIsReceivingReady(baseRow({ mail_provider: "mailgun", mx_verified_at: 1 })),
  "legacy mailgun receiving via mx",
);

console.log("ses-dns.test.ts: ok");
