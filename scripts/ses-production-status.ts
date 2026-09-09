/**
 * Operator helper: print Flap SES env expectations and optional AWS CLI quota/sandbox checks.
 * Never prints secret values. Does not request production access.
 *
 *   npx tsx scripts/ses-production-status.ts
 *   npx tsx scripts/ses-production-status.ts --aws   # requires AWS CLI + credentials in the operator environment
 */
const PLACEHOLDER = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SES_REGION",
  "SES_INBOUND_WEBHOOK_SECRET",
  "SES_RECEIPT_RULE_SET",
  "SES_INBOUND_BUCKET",
  "SES_CONFIGURATION_SET",
  "FLAP_OPERATOR_TOKEN",
] as const;

function present(name: string): boolean {
  const v = (process.env[name] || "").trim();
  return v.length > 0;
}

function main() {
  const wantAws = process.argv.includes("--aws");
  console.log("Flap SES production-access — local/env checklist (values hidden)\n");
  for (const name of PLACEHOLDER) {
    const required = !["SES_CONFIGURATION_SET", "FLAP_OPERATOR_TOKEN"].includes(name);
    console.log(`  ${present(name) ? "SET" : "missing"}  ${name}${required ? "" : " (optional)"}`);
  }
  console.log("\nPlaceholders only. Put real keys in .dev.vars or `wrangler secret put` — never commit them.");
  console.log("Inbound:  https://useflap.online/api/inbound/ses");
  console.log("Events:   https://useflap.online/api/inbound/ses/events");
  console.log("Operator: POST /api/ops/workspace-send  (FLAP_OPERATOR_TOKEN)");
  console.log("\nOperator-required AWS console (not automated):");
  console.log("  - Request SES production access (Transactional, https://useflap.online)");
  console.log("  - Create configuration set + SNS → /api/inbound/ses/events if not already live");
  console.log("  - Activate receipt rule set; confirm RawMailRetentionDays on the inbound stack");

  if (!wantAws) {
    console.log("\nRe-run with --aws to call GetSendQuota / GetAccountSendingEnabled via AWS CLI.");
    return;
  }

  const region = process.env.AWS_SES_REGION || "us-east-1";
  console.log(`\nAWS CLI probes (region ${region}) — operator credentials only:\n`);
  console.log(`  aws ses get-send-quota --region ${region}`);
  console.log(`  aws ses get-account-sending-enabled --region ${region}`);
  console.log("If Max24HourSend is 200 and you can only mail verified identities, the account is still sandboxed.");
}

main();
