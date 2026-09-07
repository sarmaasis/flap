/**
 * Expanded explanatory content for priority tool pages (prerender + React).
 * Keep answer-first; never claim DNS checks guarantee inbox placement.
 */
export type ToolExplainer = {
  path: string;
  answerFirst: string;
  whatItChecks: string;
  interpret: Array<{ state: string; meaning: string }>;
  examples: Array<{ label: string; body: string }>;
  commonErrors: Array<{ error: string; fix: string }>;
  references: Array<{ label: string; href: string }>;
  faqs: Array<{ q: string; a: string }>;
  nextLinks: Array<{ href: string; label: string }>;
  updated: string;
};

const UPDATED = "2026-09-07";

export const TOOL_EXPLAINERS: Record<string, ToolExplainer> = {
  "/tools/email-setup-checker": {
    path: "/tools/email-setup-checker",
    answerFirst:
      "The email setup checker looks up MX, SPF, and DMARC for a domain and summarizes whether inbound mail and basic authentication records are present. A “pass” here does not guarantee inbox placement - only that common DNS prerequisites exist.",
    whatItChecks:
      "MX (where inbound mail is routed), SPF (which servers may send as the domain), and DMARC (how receivers should treat authentication failures). It does not send mail, open SMTP sessions that deliver messages, or validate DKIM signatures on live messages.",
    interpret: [
      {
        state: "Looks good / valid_flap_ready",
        meaning:
          "MX, SPF, and DMARC responses look coherent for custom-domain email. If you use Flap, MX should point at Amazon SES inbound for your region and SPF should include amazonses.com.",
      },
      {
        state: "Partially configured",
        meaning:
          "Some records exist but others are missing, conflicting, or not Flap/SES-shaped. Fix the weakest row before cutover.",
      },
      {
        state: "Needs attention",
        meaning:
          "Missing MX, empty SPF, multiple SPF TXT records, or DMARC absent. Mail may bounce, soft-fail authentication, or land unpredictably.",
      },
    ],
    examples: [
      {
        label: "Correct Flap-oriented shape (illustrative)",
        body: "MX → inbound-smtp.<region>.amazonaws.com; SPF TXT includes include:amazonses.com; _dmarc TXT starts with v=DMARC1.",
      },
      {
        label: "Incorrect / conflicting",
        body: "Two SPF TXT records; MX still pointing at an old host while SPF authorizes SES; DMARC p=reject before SPF/DKIM are aligned.",
      },
    ],
    commonErrors: [
      {
        error: "Editing DNS at the registrar while nameservers point elsewhere",
        fix: "Confirm NS hosts first; edit records only at the authoritative DNS host.",
      },
      {
        error: "Leaving old MX alongside new MX",
        fix: "Most domains should have one clear inbound provider. Remove stale MX before cutover.",
      },
      {
        error: "Assuming a green check means Gmail will always inbox",
        fix: "DNS readiness ≠ reputation. Warm sending carefully; never treat this tool as a delivery guarantee.",
      },
    ],
    references: [
      { label: "RFC 7208 (SPF)", href: "https://datatracker.ietf.org/doc/html/rfc7208" },
      { label: "RFC 7489 (DMARC)", href: "https://datatracker.ietf.org/doc/html/rfc7489" },
      { label: "Amazon SES receiving", href: "https://docs.aws.amazon.com/ses/latest/dg/receiving-email.html" },
      { label: "Flap DNS guides", href: "/guides" },
    ],
    faqs: [
      {
        q: "Does a passing check mean mail will reach the inbox?",
        a: "No. It only reflects DNS presence and basic shape. Reputation, content, and recipient filters still apply.",
      },
      {
        q: "Does this replace Flap’s in-app Check setup?",
        a: "No. Flap’s Settings → Setup verifies identity, MX, inbound readiness, and sending readiness for your account. This public tool is a quick external DNS view.",
      },
    ],
    nextLinks: [
      { href: "/tools/spf-checker", label: "SPF checker" },
      { href: "/tools/dmarc-checker", label: "DMARC checker" },
      { href: "/tools/dkim-checker", label: "DKIM checker" },
      { href: "/blog/mx-spf-dmarc-setup-checklist", label: "MX/SPF/DMARC checklist" },
      { href: "/signup", label: "Start free with Flap" },
    ],
    updated: UPDATED,
  },
  "/tools/spf-checker": {
    path: "/tools/spf-checker",
    answerFirst:
      "An SPF checker fetches the domain’s SPF TXT record (v=spf1 …) and reports whether it exists and whether it includes Amazon SES (include:amazonses.com) when relevant. SPF alone does not guarantee delivery.",
    whatItChecks:
      "Public TXT records at the domain apex for SPF. It estimates whether Flap/SES is authorized to send. It does not flatten nested includes into IPs or prove every include resolves under the 10-lookup limit in production.",
    interpret: [
      {
        state: "Valid / includes amazonses.com",
        meaning: "Receivers that check SPF can see Amazon SES as an authorized sender for this domain (when Flap sends via SES).",
      },
      {
        state: "SPF present but missing SES include",
        meaning: "You may be authorizing another provider only. Flap outbound via SES will fail SPF until include:amazonses.com is added (merged into a single SPF record).",
      },
      {
        state: "Missing or multiple SPF records",
        meaning: "Publish exactly one SPF TXT. Multiple v=spf1 records are invalid per RFC practice.",
      },
    ],
    examples: [
      {
        label: "Correct (illustrative)",
        body: "v=spf1 include:amazonses.com ~all",
      },
      {
        label: "Incorrect",
        body: "Two TXT records both starting with v=spf1; or include:_spf.mx.cloudflare.net only when you intend SES for Flap.",
      },
    ],
    commonErrors: [
      {
        error: "Creating a second SPF TXT instead of merging includes",
        fix: "Edit the single existing SPF string to add include:amazonses.com.",
      },
      {
        error: "Ending with -all before all senders are listed",
        fix: "Use ~all while validating, then tighten once every sender is included.",
      },
    ],
    references: [
      { label: "RFC 7208", href: "https://datatracker.ietf.org/doc/html/rfc7208" },
      { label: "Amazon SES SPF", href: "https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-spf.html" },
      { label: "SPF flattener helper", href: "/tools/spf-flattener" },
    ],
    faqs: [
      {
        q: "Is SPF the same as DKIM?",
        a: "No. SPF authorizes sending IPs/includes via DNS. DKIM cryptographically signs messages. DMARC ties alignment of both to a policy.",
      },
      {
        q: "Will passing SPF put me in the inbox?",
        a: "No. SPF is necessary hygiene, not a delivery guarantee.",
      },
    ],
    nextLinks: [
      { href: "/tools/dkim-checker", label: "DKIM checker" },
      { href: "/tools/dmarc-checker", label: "DMARC checker" },
      { href: "/tools/email-setup-checker", label: "Full setup checker" },
      { href: "/guides", label: "DNS setup guides" },
    ],
    updated: UPDATED,
  },
  "/tools/dmarc-checker": {
    path: "/tools/dmarc-checker",
    answerFirst:
      "A DMARC checker looks up the TXT record at _dmarc.<domain> and summarizes the policy (p=none/quarantine/reject) and reporting addresses. DMARC does not by itself guarantee inbox placement.",
    whatItChecks:
      "Presence and parseable fields of a DMARC record (version, policy, rua/ruf). It does not validate that aggregate reports arrive or that every message aligns SPF/DKIM.",
    interpret: [
      {
        state: "p=none",
        meaning: "Monitor mode - useful while watching reports. Failures are not quarantined/rejected by policy alone.",
      },
      {
        state: "p=quarantine or p=reject",
        meaning: "Receivers that honor DMARC may spam-folder or reject unauthenticated mail. Only use after SPF/DKIM alignment looks clean.",
      },
      {
        state: "Missing DMARC",
        meaning: "No organizational policy published. Start with p=none and a rua mailbox you control.",
      },
    ],
    examples: [
      {
        label: "Starter monitor record",
        body: "v=DMARC1; p=none; rua=mailto:dmarc@example.com; adkim=r; aspf=r",
      },
      {
        label: "Risky early reject",
        body: "p=reject while SPF still missing SES include or DKIM CNAMEs unpublished - legitimate mail may fail.",
      },
    ],
    commonErrors: [
      {
        error: "Publishing DMARC at the apex instead of _dmarc",
        fix: "Host/name must be _dmarc.example.com (or _dmarc depending on DNS UI).",
      },
      {
        error: "Jumping to reject on day one",
        fix: "Start with p=none, review reports, then quarantine, then reject.",
      },
    ],
    references: [
      { label: "RFC 7489", href: "https://datatracker.ietf.org/doc/html/rfc7489" },
      { label: "DMARC.org", href: "https://dmarc.org/" },
      { label: "DMARC generator", href: "/tools/dmarc-generator" },
    ],
    faqs: [
      {
        q: "Does DMARC replace SPF and DKIM?",
        a: "No. DMARC tells receivers what to do when authentication fails. You still need SPF and/or DKIM with alignment.",
      },
      {
        q: "Does a published DMARC guarantee delivery?",
        a: "No. It is a policy signal, not an inbox promise.",
      },
    ],
    nextLinks: [
      { href: "/tools/spf-checker", label: "SPF checker" },
      { href: "/tools/dkim-checker", label: "DKIM checker" },
      { href: "/tools/email-setup-checker", label: "Email setup checker" },
      { href: "/blog/mx-spf-dmarc-setup-checklist", label: "Setup checklist article" },
    ],
    updated: UPDATED,
  },
  "/tools/dkim-checker": {
    path: "/tools/dkim-checker",
    answerFirst:
      "A DKIM checker verifies that a selector’s public key DNS record exists (TXT or CNAME) for your domain. Flap uses Amazon SES Easy DKIM CNAMEs - copy exact tokens from Settings → Setup. Presence of a record does not guarantee every message will authenticate or land in the inbox.",
    whatItChecks:
      "DNS for <selector>._domainkey.<domain> (or SES token CNAMEs). Enter the selector you actually publish. It does not sign a test message or verify ARC chains.",
    interpret: [
      {
        state: "Record found",
        meaning: "The selector publishes a key or CNAME target. SES Easy DKIM typically uses three CNAME tokens Flap shows after provisioning.",
      },
      {
        state: "Not found",
        meaning: "Wrong selector, DNS not propagated, or records never published. For Flap, refresh Setup and copy the live CNAME rows.",
      },
    ],
    examples: [
      {
        label: "SES Easy DKIM shape",
        body: "<token>._domainkey.example.com CNAME → <token>.dkim.amazonses.com",
      },
      {
        label: "Legacy misconception",
        body: "Expecting smtp._domainkey for SES Easy DKIM - Flap’s current path uses the SES-provided tokens, not a generic smtp selector.",
      },
    ],
    commonErrors: [
      {
        error: "Inventing a selector name",
        fix: "Use the exact hosts Flap displays after SES identity provisioning.",
      },
      {
        error: "Orange-cloud / proxied CNAMEs on Cloudflare",
        fix: "Mail-related CNAMEs must be DNS-only (grey cloud).",
      },
    ],
    references: [
      { label: "RFC 6376 (DKIM)", href: "https://datatracker.ietf.org/doc/html/rfc6376" },
      { label: "Amazon SES Easy DKIM", href: "https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dkim-easy.html" },
      { label: "DKIM generator assist", href: "/tools/dkim-generator" },
    ],
    faqs: [
      {
        q: "Why three CNAMEs for SES?",
        a: "Amazon SES Easy DKIM publishes multiple selector tokens. Publish all rows Flap shows.",
      },
      {
        q: "Does DKIM guarantee inbox?",
        a: "No. It helps authentication alignment; reputation and filters still decide placement.",
      },
    ],
    nextLinks: [
      { href: "/tools/spf-checker", label: "SPF checker" },
      { href: "/tools/dmarc-checker", label: "DMARC checker" },
      { href: "/tools/email-setup-checker", label: "Email setup checker" },
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare DNS guide" },
    ],
    updated: UPDATED,
  },
  "/tools/google-workspace-cost-calculator": {
    path: "/tools/google-workspace-cost-calculator",
    answerFirst:
      "This calculator estimates illustrative Google Workspace spend when you provision seats across multiple project domains, then compares it to the cheapest Flap plan that covers that domain count. Figures are educational - not invoices or delivery guarantees.",
    whatItChecks:
      "It multiplies domains × users-per-domain × an illustrative Workspace Business Starter list price ($7/user/month from shared config), then picks a Flap plan from shared/plans.ts by domain capacity.",
    interpret: [
      {
        state: "Large savings shown",
        meaning:
          "Your assumed model provisions Workspace-like seats per domain. If you already host many domains in one Google customer, real savings differ.",
      },
      {
        state: "Small or zero savings",
        meaning:
          "Few domains or Flap’s matching tier is close to the illustrative Workspace line. Compare features - Flap is email-only, not Docs/Drive/Meet.",
      },
    ],
    examples: [
      {
        label: "Example",
        body: "8 domains × 1 user × $7 ≈ $56/mo illustrative Workspace. Flap Pro covers 20 domains at $19/mo list - your habits may differ.",
      },
      {
        label: "Wrong interpretation",
        body: "Treating the output as “Google charges exactly this” or “Flap is always cheaper for every company.”",
      },
    ],
    commonErrors: [
      {
        error: "Using calculator output in contracts",
        fix: "Confirm current Google pricing for your region, taxes, and discounts. Flap prices are from the live plan catalog.",
      },
      {
        error: "Ignoring suite value",
        fix: "If you need Google collaboration apps, Workspace may still be the right spend even when mail-only is cheaper on Flap.",
      },
    ],
    references: [
      { label: "Flap vs Google Workspace", href: "/flap-vs-google-workspace" },
      { label: "Flap pricing", href: "/pricing" },
      { label: "Cost article", href: "/blog/cost-of-google-workspace-multiple-domains" },
    ],
    faqs: [
      {
        q: "Are Google prices official here?",
        a: "No. Flap uses a published illustrative list figure for education. Verify on Google’s site.",
      },
      {
        q: "Where do Flap plan numbers come from?",
        a: "The same shared/plans.ts catalog used by billing and the pricing page.",
      },
    ],
    nextLinks: [
      { href: "/flap-vs-google-workspace", label: "Flap vs Google Workspace" },
      { href: "/google-workspace-alternative", label: "Workspace alternative" },
      { href: "/pricing", label: "Flap pricing" },
      { href: "/signup", label: "Start free" },
    ],
    updated: UPDATED,
  },
};

export function getToolExplainer(path: string): ToolExplainer | null {
  return TOOL_EXPLAINERS[path] ?? null;
}
