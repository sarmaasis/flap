import { useEffect, useRef, useState, Fragment } from "react";
import { createPortal } from "react-dom";
import {
  api,
  type Alias,
  type ApiKey,
  type BillingSubscription,
  type BlockedSender,
  type Contact,
  type DnsRecords,
  type Domain,
  type Filter,
  type Label,
  type Mailbox,
  type PlanSummary,
  type Prefs,
  type Signature,
  type Suppression,
  type TeamInvite,
  type TeamMember,
  type TeamResponse,
  type Template,
  type Webhook,
  type WebhookDelivery,
} from "../lib/api";
import { ThemeToggle } from "../components/ThemeProvider";
import { go } from "../lib/nav";
import AppShell from "../components/AppShell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";

type Tab = "setup" | "compose" | "contacts" | "filters" | "aliases" | "delivery" | "developers" | "privacy" | "billing" | "team" | "referrals";

function initialTab(): Tab {
  if (window.location.pathname === "/settings/referrals") return "referrals";
  const q = new URLSearchParams(window.location.search).get("tab");
  const allowed: Tab[] = ["setup", "compose", "contacts", "filters", "aliases", "delivery", "developers", "privacy", "billing", "team", "referrals"];
  return allowed.includes(q as Tab) ? (q as Tab) : "setup";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Host/Name field for most DNS panels (@ = domain root). */
function dnsHostField(fqdn: string, domain: string): string {
  const d = domain.toLowerCase().replace(/\.$/, "");
  const n = fqdn.toLowerCase().replace(/\.$/, "");
  if (n === d) return "@";
  if (n.endsWith(`.${d}`)) return n.slice(0, -(d.length + 1));
  return fqdn;
}

function isPlaceholderDnsValue(value: string): boolean {
  return /appears here|replace with|provision|refresh Settings|copy the three/i.test(value);
}

function setupLifecycleLabel(lifecycle?: string): string {
  switch ((lifecycle || "").toUpperCase()) {
    case "ACTIVE":
      return "Ready";
    case "SENDING_READY":
      return "Sending ready";
    case "RECEIVING_READY":
      return "Receiving ready";
    case "IDENTITY_VERIFIED":
      return "Domain verified — finish MX & SPF";
    case "DNS_PENDING":
    default:
      return "Waiting on DNS";
  }
}

function dnsProviderGuideLabel(provider: string): string {
  if (provider === "cloudflare") return "Cloudflare";
  if (provider === "vercel") return "Vercel";
  if (provider === "route53" || provider === "aws") return "Route 53";
  if (provider === "namecheap") return "Namecheap";
  if (provider === "godaddy") return "GoDaddy";
  return "your DNS host";
}

const REGISTRAR_DNS_TIPS = [
  { name: "Cloudflare", tip: "DNS → select zone → DNS → Records" },
  { name: "Porkbun", tip: "Domain → DNS Records / Authoritative nameservers" },
  { name: "Namecheap", tip: "Domain List → Manage → Advanced DNS" },
  { name: "GoDaddy", tip: "My Products → DNS / Manage DNS" },
] as const;

type DnsTableRow = { type: string; host: string; value: string; hint?: string; copyable: boolean };

function buildDnsTableRows(dns: DnsRecords, domain: string): DnsTableRow[] {
  const dkimRows = dns.dkim_records?.length ? dns.dkim_records : [dns.dkim];
  const rows: DnsTableRow[] = [];
  for (const r of dns.verification || []) {
    rows.push({
      type: r.type,
      host: dnsHostField(r.name, domain),
      value: r.value,
      hint: "Proves you own the domain",
      copyable: !isPlaceholderDnsValue(r.value),
    });
  }
  for (const r of dkimRows) {
    rows.push({
      type: r.type,
      host: dnsHostField(r.name, domain),
      value: r.value,
      hint: "Signs outgoing mail",
      copyable: !isPlaceholderDnsValue(r.value),
    });
  }
  for (const r of dns.mx) {
    rows.push({
      type: r.type,
      host: dnsHostField(r.name, domain),
      value: `${r.priority} ${r.value}`,
      hint: "Receiving — do not proxy / keep DNS-only",
      copyable: true,
    });
  }
  rows.push({
    type: dns.spf.type,
    host: dnsHostField(dns.spf.name, domain),
    value: dns.spf.value,
    hint: "Merge into your existing SPF if you already have one (only one SPF TXT on @)",
    copyable: true,
  });
  if (dns.dmarc) {
    rows.push({
      type: dns.dmarc.type,
      host: dnsHostField(dns.dmarc.name, domain),
      value: dns.dmarc.value,
      hint: "Recommended",
      copyable: true,
    });
  }
  return rows;
}

function formatDnsRecordsBlock(rows: DnsTableRow[], domain: string): string {
  const lines = [
    `# Flap DNS for ${domain}`,
    `# Paste each row at your DNS host (Type / Host / Value).`,
    "",
  ];
  for (const r of rows) {
    lines.push(`${r.type}\t${r.host}\t${r.value}${r.hint ? `\t# ${r.hint}` : ""}`);
  }
  return lines.join("\n");
}

export default function Settings() {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [email, setEmail] = useState("");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [domainName, setDomainName] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [domainId, setDomainId] = useState("");
  const [dns, setDns] = useState<DnsRecords | null>(null);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const [privacyBusy, setPrivacyBusy] = useState<string | null>(null);
  const [aiOptIn, setAiOptIn] = useState(false);
  const [exportPolicy, setExportPolicy] = useState<string | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [blocked, setBlocked] = useState<BlockedSender[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teamInfo, setTeamInfo] = useState<Pick<TeamResponse, "teams_unlocked" | "plan_id" | "limits" | "workspace" | "shared_mailboxes"> | null>(null);
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteMailboxes, setInviteMailboxes] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({ vacation_enabled: 0, vacation_body: "", notify_browser: 0, undo_send_seconds: 10 });
  const [labels, setLabels] = useState<Label[]>([]);
  const [labelName, setLabelName] = useState("");
  const [suppressions, setSuppressions] = useState<Suppression[]>([]);
  const [deliveryInfo, setDeliveryInfo] = useState<Awaited<ReturnType<typeof api.deliverability>> | null>(null);
  const [newToken, setNewToken] = useState("");
  const [newWebhookSecret, setNewWebhookSecret] = useState("");
  const [webhookDeliveries, setWebhookDeliveries] = useState<Record<string, WebhookDelivery[]>>({});
  const [webhookExpanded, setWebhookExpanded] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingSubscription | null>(null);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [checkoutConfigured, setCheckoutConfigured] = useState(true);
  const [checkoutMissing, setCheckoutMissing] = useState<string[]>([]);
  const [dodoEnvironment, setDodoEnvironment] = useState<"test_mode" | "live_mode" | null>(null);
  const [supportEmail, setSupportEmail] = useState("support@useflap.online");
  const [onboardingBanner, setOnboardingBanner] = useState(
    () => new URLSearchParams(window.location.search).get("onboarding") === "1",
  );
  const [setupLoading, setSetupLoading] = useState(true);
  const [dnsStatus, setDnsStatus] = useState<{
    verified: boolean;
    issues: string[];
    provider: string;
    guide_path: string | null;
    mx_ok: boolean;
    spf_ok: boolean;
    receiving?: {
      identity_verified: boolean;
      mx_configured: boolean;
      inbound_rule_active: boolean;
      receiving_ready: boolean;
    };
    sending?: { ses_sending: boolean; sending_ready: boolean };
    lifecycle?: string;
    mail_provider?: string;
  } | null>(null);
  const [dnsChecking, setDnsChecking] = useState(false);
  const [dnsPolling, setDnsPolling] = useState(false);
  const [dnsPollNote, setDnsPollNote] = useState("");
  const [emailVerified, setEmailVerified] = useState(true);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const dnsPollRef = useRef<{ cancelled: boolean; timer: ReturnType<typeof setTimeout> | null }>({
    cancelled: false,
    timer: null,
  });
  const [referralInfo, setReferralInfo] = useState<Awaited<ReturnType<typeof api.referrals>> | null>(null);
  const [activation, setActivation] = useState<Awaited<ReturnType<typeof api.activation>> | null>(null);
  const loadedTabs = useRef(new Set<Tab>());

  async function refreshCore() {
    setSetupLoading(true);
    try {
      const me = await api.me();
      setEmail(me.user.email);
      setEmailVerified(me.user.email_verified !== false);
      const [d, m, p, act] = await Promise.all([
        api.domains(),
        api.mailboxes(),
        api.prefs(),
        api.activation().catch(() => null),
      ]);
      setDomains(d.domains);
      if (!domainId && d.domains[0]) setDomainId(d.domains[0].id);
      setMailboxes(m.mailboxes);
      setPrefs(p.settings);
      if (act) {
        setActivation(act);
        if (act.steps?.email_verified != null) setEmailVerified(Boolean(act.steps.email_verified));
      }
      const focus = d.domains.find((x) => x.id === domainId) ?? d.domains[0];
      if (focus) setDns((await api.dns(focus.name)).records);
    } finally {
      setSetupLoading(false);
    }
  }

  async function loadTabData(next: Tab, force = false) {
    if (!force && loadedTabs.current.has(next)) return;
    try {
      switch (next) {
        case "setup":
          await api.billingSubscription().then(setBilling).catch(() => undefined);
          break;
        case "compose": {
          const [s, t] = await Promise.all([api.signatures(), api.templates()]);
          setSignatures(s.signatures);
          setTemplates(t.templates);
          break;
        }
        case "contacts": {
          const c = await api.contacts();
          setContacts(c.contacts);
          break;
        }
        case "filters": {
          const f = await api.filters();
          setFilters(f.filters);
          break;
        }
        case "aliases": {
          const a = await api.aliases();
          setAliases(a.aliases);
          break;
        }
        case "delivery": {
          const [d, s, l] = await Promise.all([api.deliverability(), api.suppressions().catch(() => ({ suppressions: [] })), api.labels()]);
          setDeliveryInfo(d);
          setSuppressions(s.suppressions);
          setLabels(l.labels);
          break;
        }
        case "developers": {
          const [k, w] = await Promise.all([api.keys(), api.webhooks()]);
          setKeys(k.keys);
          setWebhooks(w.webhooks);
          break;
        }
        case "privacy": {
          const [b, p, extra] = await Promise.all([
            api.blocked(),
            api.prefs(),
            api.prefsExtra().catch(() => null),
          ]);
          setBlocked(b.blocked);
          setPrefs(p.settings);
          setAiOptIn(Boolean(extra?.prefs?.ai_opt_in));
          break;
        }
        case "billing": {
          const [bill, planList] = await Promise.all([
            api.billingSubscription().catch(() => null),
            api.billingPlans().catch(() => ({
              plans: [] as PlanSummary[],
              checkout_configured: false as boolean,
              checkout_missing: ["DODO_PAYMENTS_API_KEY", "DODO_PRODUCT_SOLO", "DODO_PRODUCT_BUILDER", "DODO_PRODUCT_STUDIO"] as string[],
              dodo_environment: undefined as "test_mode" | "live_mode" | undefined,
              support_email: "support@useflap.online",
            })),
          ]);
          setBilling(bill);
          setPlans(planList.plans);
          setCheckoutConfigured(bill?.checkout_configured ?? planList.checkout_configured ?? false);
          setCheckoutMissing(bill?.checkout_missing ?? planList.checkout_missing ?? []);
          setDodoEnvironment(bill?.dodo_environment ?? planList.dodo_environment ?? null);
          setSupportEmail(bill?.support_email || planList.support_email || "support@useflap.online");
          break;
        }
        case "team": {
          const team = await api.team();
          setInvites(team.invites);
          setMembers(team.members ?? []);
          setTeamInfo({
            teams_unlocked: team.teams_unlocked,
            plan_id: team.plan_id,
            limits: team.limits,
            workspace: team.workspace,
            shared_mailboxes: team.shared_mailboxes ?? [],
          });
          break;
        }
        case "referrals": {
          const refs = await api.referrals().catch(() => null);
          if (refs) setReferralInfo(refs);
          break;
        }
      }
      loadedTabs.current.add(next);
    } catch {
      /* tab data optional until interaction */
    }
  }

  async function refresh() {
    await refreshCore();
    loadedTabs.current.clear();
    await loadTabData(tab, true);
  }

  function flash(message: string, kind: "ok" | "err" = "ok") {
    if (kind === "err") {
      setErr(message);
      setNotice("");
      setToast({ title: "Something went wrong", body: message });
    } else {
      setNotice(message);
      setErr("");
      setToast({ title: "Done", body: message });
    }
    requestAnimationFrame(() => {
      bannerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  /** Catch sync throws (missing api method) and async failures the same way. */
  function runPrivacy(key: string, work: () => Promise<void>) {
    setPrivacyBusy(key);
    setErr("");
    void Promise.resolve()
      .then(work)
      .catch((ex) => flash(ex instanceof Error ? ex.message : "Request failed.", "err"))
      .finally(() => setPrivacyBusy(null));
  }

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    refreshCore()
      .then(() => loadTabData(initialTab()))
      .catch(() => go("/login"));
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "done") {
      setNotice("Checkout complete. Plan entitlements update when Dodo confirms the subscription webhook.");
      setTab("billing");
    }
    if (params.get("onboarding") === "1") {
      setOnboardingBanner(true);
      setTab("setup");
      setNotice("Welcome to Flap. Complete the checklist below to receive your first message.");
    }
    if (params.get("verify") === "ok") {
      setEmailVerified(true);
      setNotice("Email verified. You can finish domain setup below.");
      setTab("setup");
    }
    if (params.get("verify") === "sent") {
      setEmailVerified(false);
      setNotice("Check your inbox for a verification link from Flap (expires in 48 hours).");
      setTab("setup");
    }
    if (params.get("verify") === "failed") {
      setErr(params.get("reason") || "Email verification failed. Request a new link below.");
      setTab("setup");
    }
    if (params.get("joined") === "1") {
      setTab("team");
      setNotice("You joined the workspace. Shared mailboxes you were granted appear in the inbox.");
    }
    return () => {
      dnsPollRef.current.cancelled = true;
      if (dnsPollRef.current.timer) clearTimeout(dnsPollRef.current.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadTabData(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    const focus = domains.find((x) => x.id === domainId);
    if (!focus) return;
    api.dns(focus.name).then((r) => setDns(r.records)).catch(() => undefined);
  }, [domainId, domains]);

  function selectTab(id: Tab) {
    setTab(id);
    const url = new URL(window.location.href);
    if (id === "setup") url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }
  function stopDnsPoll() {
    dnsPollRef.current.cancelled = true;
    if (dnsPollRef.current.timer) {
      clearTimeout(dnsPollRef.current.timer);
      dnsPollRef.current.timer = null;
    }
    setDnsPolling(false);
  }

  async function runDnsCheck(id: string, opts?: { silent?: boolean }) {
    if (!opts?.silent) setDnsChecking(true);
    try {
      const { track } = await import("../lib/analytics");
      if (!opts?.silent) track("dns_verification_started");
      const status = await api.dnsStatus(id);
      setDnsStatus(status);
      if (status.verified) {
        track("dns_verified");
        setNotice("Receiving checks look good. Finish sending verification if needed, then send a test.");
        setDnsPollNote("");
        void refresh();
      } else if (status.issues.length) {
        setDnsPollNote(
          status.issues.length === 1
            ? `Still waiting: ${status.issues[0]}`
            : `Still waiting on ${status.issues.length} items`,
        );
      }
      return status;
    } catch (ex) {
      if (!opts?.silent) setErr(ex instanceof Error ? ex.message : "DNS check failed.");
      return null;
    } finally {
      if (!opts?.silent) setDnsChecking(false);
    }
  }

  /** Auto-poll DNS after domain add / manual setup: fast at first, then slower; stop on success or ~3 min. */
  function startDnsAutoPoll(id: string) {
    stopDnsPoll();
    dnsPollRef.current = { cancelled: false, timer: null };
    setDnsPolling(true);
    setDnsPollNote("Watching DNS… usually updates within a few minutes.");
    void (async () => {
      const { track } = await import("../lib/analytics");
      track("dns_verification_started", { auto: true });
      const delays = [0, 4_000, 8_000, 12_000, 20_000, 30_000, 45_000, 60_000];
      const started = Date.now();
      const deadline = started + 3 * 60_000;
      for (let i = 0; i < delays.length; i++) {
        if (dnsPollRef.current.cancelled) return;
        const wait = delays[i]!;
        if (wait > 0) {
          await new Promise<void>((resolve) => {
            dnsPollRef.current.timer = setTimeout(resolve, wait);
          });
        }
        if (dnsPollRef.current.cancelled) return;
        if (Date.now() > deadline) break;
        const status = await runDnsCheck(id, { silent: true });
        if (status?.verified) {
          setDnsPolling(false);
          setDnsPollNote("Looking good — DNS is ready.");
          return;
        }
      }
      if (!dnsPollRef.current.cancelled) {
        setDnsPolling(false);
        setDnsPollNote("Still propagating. Fix any issues below, then Check DNS again.");
      }
    })();
  }

  async function addDomain(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      const { track } = await import("../lib/analytics");
      track("domain_add_started");
      const created = await api.createDomain(domainName);
      track("domain_added");
      setDomainName("");
      await refresh();
      if (created.domain?.id) {
        setDomainId(created.domain.id);
        startDnsAutoPoll(created.domain.id);
      }
      setNotice("Domain added. We are watching DNS while you create an address.");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not add domain.");
    }
  }

  async function addMailbox(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      const created = await api.createMailbox(domainId, localPart);
      if (displayName.trim()) await api.updateMailbox(created.mailbox.id, displayName.trim());
      const { track } = await import("../lib/analytics");
      track("address_created");
      setLocalPart("");
      setDisplayName("");
      await refresh();
      setNotice("Mailbox added. Publish the DNS records below, then send a test from an external inbox.");
      if (domainId) startDnsAutoPoll(domainId);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not add mailbox.");
    }
  }

  async function checkDns() {
    if (!domainId) return;
    setErr("");
    stopDnsPoll();
    const status = await runDnsCheck(domainId);
    if (status && !status.verified) {
      startDnsAutoPoll(domainId);
    }
  }

  async function resendVerify() {
    setVerifyBusy(true);
    setErr("");
    try {
      const res = await api.resendVerification();
      setNotice(res.message || (res.sent ? "Verification email sent." : "Request recorded."));
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not resend verification.");
    } finally {
      setVerifyBusy(false);
    }
  }

  function copyText(value: string) {
    void navigator.clipboard.writeText(value).then(() => setNotice("Copied to clipboard."));
  }

  async function toggleWebhookDeliveries(id: string) {
    if (webhookExpanded === id) {
      setWebhookExpanded(null);
      return;
    }
    setWebhookExpanded(id);
    if (id in webhookDeliveries) return;
    try {
      const res = await api.webhookDeliveries(id);
      setWebhookDeliveries((prev) => ({ ...prev, [id]: res.deliveries }));
    } catch (ex) {
      setWebhookDeliveries((prev) => ({ ...prev, [id]: [] }));
      setErr(ex instanceof Error ? ex.message : "Could not load deliveries.");
    }
  }

  function openSendTest() {
    const addr = domainMailboxes[0]?.address || mailboxes[0]?.address;
    if (!addr) {
      setErr("Create a mailbox first, then send yourself a test.");
      return;
    }
    const q = new URLSearchParams({
      to: addr,
      subject: "Flap delivery test",
    });
    go(`/app/compose?${q.toString()}`);
  }

  async function logout() {
    await api.logout();
    go("/");
  }

  const selectedDomain = domains.find((d) => d.id === domainId);
  const selectedName = selectedDomain?.name ?? "your-domain.com";
  const hasDomain = domains.length > 0;
  const hasMailbox = mailboxes.length > 0;
  const domainMailboxes = mailboxes.filter((m) => m.domain_id === domainId);

  const tabs: Array<[Tab, string]> = [
    ["setup", "Setup"],
    ["compose", "Compose"],
    ["contacts", "Contacts"],
    ["filters", "Rules"],
    ["aliases", "Aliases"],
    ["delivery", "Delivery"],
    ["developers", "Developers"],
    ["privacy", "Privacy"],
    ["billing", "Billing"],
    ["team", "Team"],
    ["referrals", "Referrals"],
  ];

  async function startCheckout(planId: string) {
    setErr("");
    setCheckoutBusy(planId);
    try {
      const { track } = await import("../lib/analytics");
      track("checkout_started", { plan: planId });
      const session = await api.billingCheckout(planId, billingInterval);
      window.location.href = session.checkout_url;
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not start checkout.");
      setCheckoutBusy(null);
    }
  }

  async function openPortal() {
    setErr("");
    setPortalBusy(true);
    try {
      const session = await api.billingPortal();
      window.location.href = session.portal_url;
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not open billing portal.");
      setPortalBusy(false);
    }
  }

  return (
    <AppShell email={email} current="settings" onLogout={() => void logout()}>
      <main className="settings">
        <div className="settings-intro flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1>Settings</h1>
            <p className="lede">Wire your domain, route mail, automate delivery, and keep developer hooks under one roof.</p>
          </div>
          <div className="md:hidden">
            <ThemeToggle />
          </div>
        </div>
        {onboardingBanner || (activation && !activation.onboarding_dismissed && !activation.activated) ? (
          <div className="onboarding-banner" role="status">
            <div>
              <strong>Your Flap setup</strong>
              <ul className="setup-checklist mt-2 text-sm">
                <li className="complete">Create account</li>
                <li className={emailVerified ? "complete" : ""}>Verify account email</li>
                <li className={hasDomain ? "complete" : ""}>Add first domain</li>
                <li className={dnsStatus?.receiving?.identity_verified || dnsStatus?.verified ? "complete" : ""}>
                  Publish DNS records
                </li>
                <li className={dnsStatus?.receiving?.receiving_ready ? "complete" : ""}>Verify receiving</li>
                <li className={hasMailbox ? "complete" : ""}>Create an address</li>
                <li className={dnsStatus?.sending?.sending_ready ? "complete" : ""}>Verify sending</li>
                <li className={activation?.steps.first_email_sent || activation?.steps.first_email_received ? "complete" : ""}>
                  Send and receive a test email
                </li>
              </ul>
            </div>
            <Button
              type="button"
              onClick={() => {
                setOnboardingBanner(false);
                void api.dismissOnboarding().catch(() => undefined);
              }}
            >
              Dismiss
            </Button>
          </div>
        ) : null}
        <Tabs value={tab} onValueChange={(v) => selectTab(v as Tab)} className="mb-5">
          <TabsList className="h-auto w-full justify-start bg-[var(--surface-2)]">
            {tabs.map(([id, label]) => (
              <TabsTrigger key={id} value={id} className="text-xs uppercase tracking-wide">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div ref={bannerRef} className="sticky top-0 z-20 -mx-1 space-y-2 bg-[var(--bg)]/95 px-1 py-1 backdrop-blur-sm">
          {err ? <div className="err">{err}</div> : null}
          {notice ? <div className="notice" role="status">{notice}</div> : null}
        </div>

        {tab === "setup" ? (
          <>
            {!emailVerified ? (
              <div className="notice dns-issues" role="status">
                <p>
                  Confirm <strong>{email}</strong> via the verification link we sent. Referral rewards and some activation steps wait on this.
                </p>
                <p style={{ marginTop: 8 }}>
                  <Button type="button" disabled={verifyBusy} onClick={() => void resendVerify()}>
                    {verifyBusy ? "Sending…" : "Resend verification email"}
                  </Button>
                </p>
              </div>
            ) : null}
            <ol className="setup-steps" aria-label="Setup progress">
              <li className={hasDomain ? "complete" : "current"}>
                <span>1</span><div><strong>Add a domain</strong><small>{hasDomain ? `${domains.length} configured` : "Any domain you control"}</small></div>
              </li>
              <li className={dnsStatus?.receiving?.identity_verified || dnsStatus?.verified ? "complete" : hasDomain ? "current" : ""}>
                <span>2</span><div><strong>Publish DNS records</strong><small>Copy the table below into your DNS panel</small></div>
              </li>
              <li className={hasMailbox ? "complete" : hasDomain ? "current" : ""}>
                <span>3</span><div><strong>Create an address</strong><small>{hasMailbox ? `${mailboxes.length} mailbox${mailboxes.length === 1 ? "" : "es"}` : "hello@your-domain.com — no extra DNS"}</small></div>
              </li>
              <li className={activation?.steps.first_email_received || activation?.steps.first_email_sent ? "complete" : hasMailbox ? "current" : ""}>
                <span>4</span><div><strong>Send &amp; receive a test</strong><small>Prove end-to-end, then upgrade only for more capacity</small></div>
              </li>
            </ol>
            {setupLoading ? (
              <div className="skeleton-stack" aria-busy="true" aria-label="Loading setup">
                <div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" />
              </div>
            ) : null}
            <section className="settings-card" aria-labelledby="domains-title">
              <div className="section-heading"><div><h2 id="domains-title">Domains</h2><p>Add any domain you control. Publish the DNS records Flap shows at your registrar or DNS host — then create mailboxes here.</p></div></div>
              <form className="row-form" onSubmit={addDomain}>
                <label className="sr-only" htmlFor="domain-name">Domain name</label>
                <input id="domain-name" placeholder="example.com" value={domainName} onChange={(e) => setDomainName(e.target.value)} required />
                <Button type="submit">Add domain</Button>
              </form>
              {billing ? (
                <p className="muted" style={{ marginTop: 8 }}>
                  {billing.plan.name} · {billing.usage.domains} / {billing.limits.domains} domains used
                  {billing.plan_id === "free" && billing.usage.domains >= billing.limits.domains ? (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          void import("../lib/analytics").then(({ track }) => {
                            track("upgrade_prompt_seen");
                            track("upgrade_started");
                          });
                          selectTab("billing");
                        }}
                      >
                        Need another domain? Upgrade to Solo
                      </button>
                    </>
                  ) : null}
                  {" · "}Upgrades unlock capacity only — no DNS migration.
                </p>
              ) : (
                <p className="muted" style={{ marginTop: 8 }}>
                  All plans use the same mail setup. Upgrades unlock more domains/mailboxes/sends — never a DNS cutover.
                </p>
              )}
              {domains.length ? <table className="table"><thead><tr><th>Name</th><th>Color</th><th>Mute</th><th>Receiving</th><th>Sending</th><th>Catch-all</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
                {domains.map((d) => {
                  const receivingReady = Boolean(d.receiving_ready_at);
                  const sendingReady = Boolean(d.sending_ready_at);
                  const legacy = (d.mail_provider || "").toLowerCase() === "mailgun" || (d.mail_provider || "").toLowerCase() === "cloudflare";
                  const muted = Boolean(d.muted_until && d.muted_until > Date.now());
                  return (
                  <tr key={d.id}>
                    <td>
                      <button className={`text-button${domainId === d.id ? " selected" : ""}`} type="button" onClick={() => setDomainId(d.id)}>
                        <span className="domain-swatch" style={{ background: d.color || "#1c6e5c" }} aria-hidden />
                        {d.name}
                      </button>
                      {legacy ? (
                        <div className="muted" style={{ fontSize: 12 }}>
                          Legacy setup
                          {" · "}
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => {
                              void api.migrateDomainSes(d.id).then(() => refresh()).catch((ex) => setErr(ex instanceof Error ? ex.message : "Migration failed."));
                            }}
                          >
                            Switch to current mail path
                          </button>
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <input
                        type="color"
                        value={d.color && /^#/.test(d.color) ? d.color : "#1c6e5c"}
                        aria-label={`Color for ${d.name}`}
                        onChange={(e) => {
                          void api.updateDomain(d.id, { color: e.target.value }).then(refresh).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not update color."));
                        }}
                      />
                    </td>
                    <td>
                      <Button size="sm" variant="ghost"
                        type="button"
                        onClick={() => {
                          void api.updateDomain(d.id, { muted_days: muted ? 0 : 7 }).then(() => {
                            setNotice(muted ? `${d.name} unmuted.` : `${d.name} muted for 7 days — new mail goes to Archive.`);
                            return refresh();
                          }).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not update mute."));
                        }}
                      >
                        {muted ? "Unmute" : "Mute 7d"}
                      </Button>
                    </td>
                    <td>{receivingReady ? "✓ Ready" : "⚠ Setup required"}</td>
                    <td>{sendingReady ? "✓ Ready" : "⚠ Setup required"}</td>
                    <td>
                      <select
                        value={d.catch_all_mailbox_id ?? ""}
                        onChange={(e) => {
                          const value = e.target.value || null;
                          void api.updateDomain(d.id, { catch_all_mailbox_id: value }).then(refresh).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not update catch-all."));
                        }}
                        aria-label={`Catch-all for ${d.name}`}
                      >
                        <option value="">Off</option>
                        {mailboxes.filter((m) => m.domain_id === d.id).map((m) => (
                          <option key={m.id} value={m.id}>{m.address}</option>
                        ))}
                      </select>
                    </td>
                    <td><Button variant="danger" type="button" onClick={() => { if (window.confirm(`Remove ${d.name} and its mailboxes? Existing messages will remain.`)) void api.deleteDomain(d.id).then(refresh); }}>Remove</Button></td>
                  </tr>
                  );
                })}
              </tbody></table> : setupLoading ? null : <p className="empty-state">No domains yet. Add the domain you plan to receive mail on.</p>}
              <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
                Plus-addressing works automatically: mail to <code>hello+stripe@yourdomain.com</code> lands in <code>hello@</code>.
              </p>
            </section>
            <section className="settings-card" aria-labelledby="mailboxes-title">
              <div className="section-heading"><div><h2 id="mailboxes-title">Mailboxes</h2><p>Flap accepts mail for addresses listed here, plus aliases and catch-all when enabled.</p></div></div>
              <form className="row-form" onSubmit={addMailbox}>
                <label className="sr-only" htmlFor="local-part">Mailbox name</label>
                <input id="local-part" placeholder="hello" value={localPart} onChange={(e) => setLocalPart(e.target.value)} required />
                <input placeholder="Display name (optional)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                <label className="sr-only" htmlFor="mailbox-domain">Domain</label>
                <select id="mailbox-domain" value={domainId} onChange={(e) => setDomainId(e.target.value)} style={{ maxWidth: 220 }} disabled={!hasDomain}>
                  {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <Button type="submit" disabled={!domainId}>Add mailbox</Button>
              </form>
              {mailboxes.length ? <table className="table"><thead><tr><th>Address</th><th>Receiving</th><th>Sending</th><th>From name</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
                {mailboxes.map((m) => {
                  const d = domains.find((x) => x.id === m.domain_id);
                  const recv = d?.receiving_ready_at ? "✓ Ready" : "⚠ Setup required";
                  const send = d?.sending_ready_at ? "✓ Ready" : "⚠ Setup required";
                  return (
                    <tr key={m.id}>
                      <td>{m.address}</td>
                      <td>{recv}</td>
                      <td>{send}</td>
                      <td><input defaultValue={m.display_name ?? ""} aria-label={`Display name for ${m.address}`} onBlur={(e) => { const value = e.target.value.trim(); if (value !== (m.display_name ?? "")) void api.updateMailbox(m.id, value).then(refresh); }} /></td>
                      <td><Button variant="danger" type="button" onClick={() => { if (window.confirm(`Remove ${m.address}?`)) void api.deleteMailbox(m.id).then(refresh); }}>Remove</Button></td>
                    </tr>
                  );
                })}
              </tbody></table> : setupLoading ? null : <p className="empty-state">{hasDomain ? "Create your first address above." : "Add a domain before creating an address."}</p>}
            </section>
            <section className="settings-card" aria-labelledby="routing-title">
              <div className="section-heading">
                <div>
                  <h2 id="routing-title">DNS records</h2>
                  <p>
                    Open the DNS panel for <strong>{selectedName || "your domain"}</strong> (wherever the nameservers point).
                    Add one row per line below. Use the <strong>Host</strong> column in the Name/Host field —{" "}
                    <code>@</code> means the root of the domain.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {dnsPolling ? (
                    <Button type="button" onClick={() => stopDnsPoll()}>
                      Stop watching
                    </Button>
                  ) : null}
                  <Button type="button" disabled={!domainId || dnsChecking} onClick={() => void checkDns()}>
                    {dnsChecking ? "Checking…" : dnsPolling ? "Check now" : "Check setup"}
                  </Button>
                </div>
              </div>
              <div className="notice" style={{ marginBottom: 12, fontSize: 13 }} role="note">
                <strong>Where to find DNS</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {REGISTRAR_DNS_TIPS.map((t) => (
                    <li key={t.name}><strong>{t.name}:</strong> {t.tip}</li>
                  ))}
                </ul>
              </div>
              {selectedDomain?.receiving_ready_at ? (
                <div className="notice" role="status" style={{ marginBottom: 12 }}>
                  <p style={{ margin: 0 }}>
                    <strong>Receiving is ready for {selectedName}.</strong>{" "}
                    {domainMailboxes.length === 0 && !hasMailbox
                      ? "Create your first mailbox or alias to start using this domain."
                      : domainMailboxes.length === 0
                        ? "Add a mailbox on this domain, then send yourself a test."
                        : "Send yourself a test from Flap to confirm end-to-end delivery."}
                  </p>
                  <div className="row-form" style={{ marginTop: 10, flexWrap: "wrap" }}>
                    {domainMailboxes.length === 0 ? (
                      <Button
                        type="button"
                        onClick={() => {
                          document.getElementById("local-part")?.focus();
                          setNotice("Pick a local-part (e.g. hello) and add a mailbox.");
                        }}
                      >
                        Create first mailbox/alias
                      </Button>
                    ) : (
                      <Button type="button" onClick={() => openSendTest()}>
                        Send yourself a test
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}
              {dnsPolling || dnsPollNote ? (
                <p className="muted" role="status" style={{ marginBottom: 8 }}>
                  {dnsPolling ? "Auto-checking DNS with backoff…" : null}
                  {dnsPollNote ? ` ${dnsPollNote}` : null}
                </p>
              ) : null}
              {dnsStatus ? (
                <div className={`notice ${dnsStatus.verified ? "" : "dns-issues"}`} role="status">
                  <p style={{ marginBottom: 4 }}>
                    <strong>{selectedName}</strong>
                    <span className="muted"> · {setupLifecycleLabel(dnsStatus.lifecycle)}</span>
                  </p>
                  {dnsStatus.receiving ? (
                    <div className="dns-status-grid" aria-label="Setup checklist">
                      <div className={`dns-status-pill ${dnsStatus.receiving.identity_verified ? "ok" : "warn"}`}>
                        <strong>Domain ownership</strong>
                        <span>{dnsStatus.receiving.identity_verified ? "Verified" : "Add verification TXT"}</span>
                      </div>
                      <div className={`dns-status-pill ${dnsStatus.receiving.mx_configured ? "ok" : "warn"}`}>
                        <strong>Incoming mail (MX)</strong>
                        <span>{dnsStatus.receiving.mx_configured ? "Configured" : "Add MX record"}</span>
                      </div>
                      <div className={`dns-status-pill ${dnsStatus.sending?.sending_ready ? "ok" : "warn"}`}>
                        <strong>Outgoing mail (DKIM)</strong>
                        <span>{dnsStatus.sending?.sending_ready ? "Ready" : "Add DKIM CNAMEs"}</span>
                      </div>
                      <div className={`dns-status-pill ${dnsStatus.spf_ok ? "ok" : "warn"}`}>
                        <strong>SPF</strong>
                        <span>{dnsStatus.spf_ok ? "OK" : "Add or update SPF"}</span>
                      </div>
                    </div>
                  ) : null}
                  {dnsStatus.verified ? (
                    <p style={{ marginTop: 10 }}>Receiving looks good. Create an address and send a real test email to finish onboarding.</p>
                  ) : dnsStatus.issues.length ? (
                    <>
                      <p className="dns-step-title" style={{ marginTop: 12 }}>What to fix</p>
                      <ul style={{ margin: "0 0 4px", paddingLeft: 18 }}>
                        {dnsStatus.issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {dnsStatus.guide_path ? (
                    <p style={{ marginTop: 10 }}>
                      <a href={dnsStatus.guide_path} onClick={(e) => { e.preventDefault(); go(dnsStatus.guide_path!); }}>
                        Step-by-step guide for {dnsProviderGuideLabel(dnsStatus.provider)}
                      </a>
                    </p>
                  ) : null}
                </div>
              ) : null}
              {dns ? (
                <div className="dns">
                  <p>{dns.note}</p>
                  {(() => {
                    const domain = selectedName || "";
                    const rows = buildDnsTableRows(dns, domain);
                    const pendingValues = rows.some((r) => !r.copyable && isPlaceholderDnsValue(r.value));
                    return (
                      <>
                        {pendingValues ? (
                          <p className="notice dns-issues" style={{ marginTop: 12 }}>
                            Some values are still being prepared for this domain. Wait a minute, refresh this page, then copy the real tokens — do not publish the placeholder text.
                          </p>
                        ) : null}
                        <div className="row-form" style={{ marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <p className="dns-step-title" style={{ margin: 0, flex: 1 }}>Records to add</p>
                          <Button size="sm" variant="ghost"
                            type="button"
                            onClick={() => {
                              copyText(formatDnsRecordsBlock(rows, domain));
                              setNotice("All DNS records copied.");
                            }}
                          >
                            Copy all records
                          </Button>
                        </div>
                        <p className="dns-step-help">
                          In your DNS UI: set Type, set Host/Name to the Host column, paste Value. TTL can stay default.
                          After saving, click <strong>Check setup</strong> (propagation can take a few minutes).
                        </p>
                        <table className="dns-table">
                          <thead>
                            <tr>
                              <th scope="col">Type</th>
                              <th scope="col">Host</th>
                              <th scope="col">Value</th>
                              <th scope="col"><span className="sr-only">Copy</span></th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={`${r.type}-${r.host}-${r.value.slice(0, 24)}`}>
                                <td><strong>{r.type}</strong></td>
                                <td>
                                  <code>{r.host}</code>
                                  <button type="button" className="text-button" style={{ display: "block", marginTop: 4 }} onClick={() => copyText(r.host)}>
                                    Copy host
                                  </button>
                                </td>
                                <td>
                                  <code>{r.value}</code>
                                  {r.hint ? <p className="dns-step-help" style={{ marginTop: 4 }}>{r.hint}</p> : null}
                                </td>
                                <td>
                                  {r.copyable ? (
                                    <button type="button" className="text-button" onClick={() => copyText(r.value)}>
                                      Copy value
                                    </button>
                                  ) : (
                                    <span className="muted">Pending</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="muted" style={{ marginTop: 8 }}>
                          {dns.send_note} Extra addresses (support@, hello@) never need new DNS — create them under Mailboxes only.
                        </p>
                      </>
                    );
                  })()}
                </div>
              ) : hasDomain ? (
                <p className="empty-state">Select a domain above to see the exact DNS rows to add.</p>
              ) : (
                <p className="empty-state">Add a domain first — then Flap will show the exact DNS rows to paste.</p>
              )}
            </section>
          </>
        ) : null}

        {tab === "compose" ? (
          <>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Signatures</h2><p>A default signature is appended to new messages.</p></div></div>
              <SignatureForm onSave={async (body) => { await api.createSignature(body); await refresh(); setNotice("Signature saved."); }} />
              {signatures.length ? <table className="table"><thead><tr><th>Name</th><th>Default</th><th /></tr></thead><tbody>
                {signatures.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.is_default ? "Yes" : <button type="button" className="text-button" onClick={() => void api.updateSignature(s.id, { name: s.name, html_body: s.html_body, text_body: s.text_body, is_default: true }).then(refresh)}>Make default</button>}</td>
                    <td><Button variant="danger" type="button" onClick={() => void api.deleteSignature(s.id).then(refresh)}>Remove</Button></td>
                  </tr>
                ))}
              </tbody></table> : <p className="empty-state">No signatures yet.</p>}
            </section>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Templates</h2><p>Reusable messages you can insert while composing.</p></div></div>
              <TemplateForm onSave={async (body) => { await api.createTemplate(body); await refresh(); setNotice("Template saved."); }} />
              {templates.length ? <table className="table"><thead><tr><th>Name</th><th>Subject</th><th /></tr></thead><tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.subject || "—"}</td>
                    <td><Button variant="danger" type="button" onClick={() => void api.deleteTemplate(t.id).then(refresh)}>Remove</Button></td>
                  </tr>
                ))}
              </tbody></table> : <p className="empty-state">Save a reply you send often.</p>}
            </section>
          </>
        ) : null}

        {tab === "contacts" ? (
          <section className="settings-card">
            <div className="section-heading"><div><h2>Address book</h2><p>Contacts are remembered as you send, and you can add them by hand.</p></div></div>
            <ContactForm onSave={async (emailValue, name) => { await api.createContact(emailValue, name); await refresh(); }} />
            {contacts.length ? <table className="table"><thead><tr><th>Name</th><th>Email</th><th /></tr></thead><tbody>
              {contacts.map((c) => (
                <tr key={c.id}><td>{c.name || "—"}</td><td>{c.email}</td><td><Button variant="danger" type="button" onClick={() => void api.deleteContact(c.id).then(refresh)}>Remove</Button></td></tr>
              ))}
            </tbody></table> : <p className="empty-state">Your address book fills in as you write.</p>}
          </section>
        ) : null}

        {tab === "filters" ? (
          <section className="settings-card">
            <div className="section-heading"><div><h2>Email rules</h2><p>Catch-all, auto-label, archive, forward, or keep mail in inbox. Blocked senders still go to spam first.</p></div></div>
            <FilterForm onSave={async (body) => { await api.createFilter(body); await refresh(); setNotice("Filter added."); }} />
            {filters.length ? <table className="table"><thead><tr><th>Name</th><th>Match</th><th>Action</th><th /></tr></thead><tbody>
              {filters.map((f) => (
                <tr key={f.id}>
                  <td>{f.name}{f.is_catch_all ? " · catch-all" : ""}</td>
                  <td className="muted">{f.is_catch_all ? "All unmatched mail" : [f.match_from && `from ${f.match_from}`, f.match_to && `to ${f.match_to}`, f.match_subject && `subject ${f.match_subject}`].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{f.action}{f.label ? `:${f.label}` : ""}{f.forward_to ? ` → ${f.forward_to}` : ""}{f.enabled ? "" : " (off)"}</td>
                  <td className="row-actions">
                    <button type="button" className="text-button" onClick={() => void api.toggleFilter(f.id).then(refresh)}>{f.enabled ? "Disable" : "Enable"}</button>
                    <Button variant="danger" type="button" onClick={() => void api.deleteFilter(f.id).then(refresh)}>Remove</Button>
                  </td>
                </tr>
              ))}
            </tbody></table> : <p className="empty-state">No rules yet. Keep the inbox quiet on your terms.</p>}
          </section>
        ) : null}

        {tab === "aliases" ? (
          <section className="settings-card">
            <div className="section-heading"><div><h2>Aliases & disposable addresses</h2><p>Route extra local-parts to an existing mailbox. Disposable aliases can expire automatically.</p></div></div>
            <AliasForm
              mailboxes={mailboxes}
              onSave={async (body) => {
                await api.createAlias(body);
                await refresh();
                setNotice("Alias created. Mail for this address is accepted once DNS for the domain points at Flap (or catch-all is enabled).");
              }}
            />
            {aliases.length ? <table className="table"><thead><tr><th>Address</th><th>Delivers to</th><th>Type</th><th /></tr></thead><tbody>
              {aliases.map((a) => (
                <tr key={a.id}>
                  <td>{a.address}</td>
                  <td className="muted">{mailboxes.find((m) => m.id === a.mailbox_id)?.address ?? a.mailbox_id}</td>
                  <td>{a.disposable ? `Disposable${a.expires_at ? ` · ends ${new Date(a.expires_at).toLocaleDateString()}` : ""}` : a.label || "Alias"}</td>
                  <td><Button variant="danger" type="button" onClick={() => void api.deleteAlias(a.id).then(refresh)}>Remove</Button></td>
                </tr>
              ))}
            </tbody></table> : <p className="empty-state">No aliases yet. Handy for newsletters and one-off signups.</p>}
            {!domainMailboxes.length && hasDomain ? <p className="muted">Select a domain with at least one mailbox to create aliases.</p> : null}
          </section>
        ) : null}

        {tab === "delivery" ? (
          <>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Deliverability</h2><p>Domain sending readiness, bounces, and client access status.</p></div></div>
              {deliveryInfo ? (
                <>
                  <p className="muted">Active suppressions: {deliveryInfo.suppressions_active}
                    {Object.keys(deliveryInfo.suppressions_by_reason).length
                      ? ` (${Object.entries(deliveryInfo.suppressions_by_reason).map(([k, v]) => `${k}: ${v}`).join(", ")})`
                      : ""}
                  </p>
                  <table className="table" style={{ marginTop: 12 }}>
                    <thead><tr><th>Domain</th><th>Identity</th><th>MX</th><th>Receiving</th><th>Sending</th><th>Last error</th></tr></thead>
                    <tbody>
                      {(deliveryInfo.domains || []).map((d) => (
                        <tr key={d.id}>
                          <td><span className="domain-swatch" style={{ background: d.color || "#1c6e5c" }} aria-hidden />{d.name}</td>
                          <td>{d.identity_verified_at ? "✓" : "—"}</td>
                          <td>{d.mx_verified_at ? "✓" : "—"}</td>
                          <td>{d.receiving_ready_at ? "✓" : "—"}</td>
                          <td>{d.sending_ready_at ? "✓" : "—"}</td>
                          <td className="muted" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{d.last_provider_error || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : <p className="muted">Loading…</p>}
            </section>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Labels</h2><p>Organize mail with reusable labels. Apply them from the open message or Rules.</p></div></div>
              <form className="row-form" onSubmit={(e) => {
                e.preventDefault();
                void api.createLabel(labelName).then(() => { setLabelName(""); return api.labels(); }).then((r) => setLabels(r.labels)).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not create label."));
              }}>
                <input placeholder="Label name" value={labelName} onChange={(e) => setLabelName(e.target.value)} required />
                <Button type="submit">Add label</Button>
              </form>
              {labels.length ? (
                <ul className="mt-2" style={{ listStyle: "none", padding: 0 }}>
                  {labels.map((l) => (
                    <li key={l.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <span className="domain-swatch" style={{ background: l.color }} aria-hidden />
                      <span>{l.name}</span>
                      <Button variant="danger" type="button" style={{ marginLeft: "auto" }} onClick={() => void api.deleteLabel(l.id).then(() => api.labels()).then((r) => setLabels(r.labels))}>Remove</Button>
                    </li>
                  ))}
                </ul>
              ) : <p className="empty-state">No labels yet.</p>}
            </section>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Bounce &amp; complaint list</h2><p>Addresses suppressed after SES bounce/complaint events. Remove to allow sending again.</p></div></div>
              {suppressions.length ? (
                <table className="table">
                  <thead><tr><th>Email</th><th>Reason</th><th>Source</th><th>When</th><th /></tr></thead>
                  <tbody>
                    {suppressions.map((s) => (
                      <tr key={s.id}>
                        <td>{s.email}</td>
                        <td>{s.reason}</td>
                        <td>{s.source}</td>
                        <td className="muted">{new Date(s.created_at).toLocaleString()}</td>
                        <td><Button size="sm" variant="ghost" type="button" onClick={() => void api.deleteSuppression(s.id).then(() => api.suppressions()).then((r) => setSuppressions(r.suppressions))}>Remove</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="empty-state">No suppressions.</p>}
            </section>
          </>
        ) : null}

        {tab === "developers" ? (
          <>
            <section className="settings-card">
              <div className="section-heading"><div><h2>API keys</h2><p>Send transactional mail with <code>POST /api/v1/send</code> and a Bearer token. Full docs: <a href="/docs/api" onClick={(e) => { e.preventDefault(); go("/docs/api"); }}>API & webhooks</a>.</p></div></div>
              <form className="row-form" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const input = form.elements.namedItem("keyname") as HTMLInputElement; void api.createKey(input.value || "Transactional").then((res) => { setNewToken(res.key.token ?? ""); input.value = ""; return refresh(); }); }}>
                <input name="keyname" placeholder="Key name" />
                <Button type="submit">Create key</Button>
              </form>
              {newToken ? <div className="notice">Copy this key now. It will not be shown again: <code>{newToken}</code></div> : null}
              {keys.length ? <table className="table"><thead><tr><th>Name</th><th>Prefix</th><th /></tr></thead><tbody>
                {keys.map((k) => <tr key={k.id}><td>{k.name}</td><td><code>{k.key_prefix}…</code></td><td><Button variant="danger" type="button" onClick={() => void api.deleteKey(k.id).then(refresh)}>Revoke</Button></td></tr>)}
              </tbody></table> : <p className="empty-state">No API keys yet.</p>}
            </section>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Webhooks</h2><p>HTTPS POST on <code>mail.received</code>. Signature: <code>x-flap-signature</code> = SHA-256 hex of <code>secret</code> + <code>.</code> + raw JSON body. See <a href="/docs/api" onClick={(e) => { e.preventDefault(); go("/docs/api"); }}>docs</a>.</p></div></div>
              <form className="stack-form" onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const name = (form.elements.namedItem("whname") as HTMLInputElement).value;
                const url = (form.elements.namedItem("whurl") as HTMLInputElement).value;
                void api.createWebhook({ name, url, events: "mail.received" }).then((res) => {
                  setNewWebhookSecret(res.webhook.secret ?? "");
                  form.reset();
                  return refresh();
                }).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not create webhook."));
              }}>
                <div className="row-form">
                  <input name="whname" placeholder="Hook name" />
                  <input name="whurl" placeholder="https://example.com/hooks/flap" required />
                </div>
                <Button type="submit">Add webhook</Button>
              </form>
              {newWebhookSecret ? <div className="notice">Copy this signing secret now: <code>{newWebhookSecret}</code></div> : null}
              {webhooks.length ? <table className="table"><thead><tr><th>Name</th><th>URL</th><th>Last trigger</th><th>Status</th><th /></tr></thead><tbody>
                {webhooks.map((w) => (
                  <Fragment key={w.id}>
                    <tr>
                      <td>{w.name}</td>
                      <td className="muted">{w.url}</td>
                      <td className="muted">{w.last_triggered_at ? new Date(w.last_triggered_at).toLocaleString() : "Never"}</td>
                      <td>{w.enabled ? "On" : "Off"}</td>
                      <td className="row-actions">
                        <button type="button" className="text-button" onClick={() => void toggleWebhookDeliveries(w.id)}>
                          {webhookExpanded === w.id ? "Hide deliveries" : "Deliveries"}
                        </button>
                        <button type="button" className="text-button" onClick={() => void api.toggleWebhook(w.id).then(refresh)}>{w.enabled ? "Disable" : "Enable"}</button>
                        <Button variant="danger" type="button" onClick={() => void api.deleteWebhook(w.id).then(refresh)}>Remove</Button>
                      </td>
                    </tr>
                    {webhookExpanded === w.id ? (
                      <tr>
                        <td colSpan={5}>
                          {!(w.id in webhookDeliveries) ? (
                            <p className="muted" style={{ margin: 0 }}>Loading deliveries…</p>
                          ) : webhookDeliveries[w.id].length ? (
                            <table className="table" style={{ margin: 0 }}>
                              <thead><tr><th>When</th><th>Event</th><th>Status</th><th>Result</th></tr></thead>
                              <tbody>
                                {webhookDeliveries[w.id].map((d) => (
                                  <tr key={d.id}>
                                    <td className="muted">{new Date(d.created_at).toLocaleString()}</td>
                                    <td><code>{d.event}</code></td>
                                    <td>{d.status_code ?? "—"}</td>
                                    <td className="muted">{d.ok ? "OK" : (d.error || "Failed")}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="muted" style={{ margin: 0 }}>No deliveries logged yet. They appear after the next inbound event.</p>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody></table> : <p className="empty-state">No webhooks yet.</p>}
            </section>
          </>
        ) : null}

        {tab === "privacy" ? (
          <>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Browser notifications</h2><p>Desktop alerts while Flap is open in a tab. Press ? in the inbox for keyboard shortcuts.</p></div></div>
              <form className="stack-form" onSubmit={(e) => {
                e.preventDefault();
                void (async () => {
                  if (prefs.notify_browser && typeof Notification !== "undefined") {
                    if (Notification.permission === "denied") {
                      setErr("Notifications are blocked in this browser. Allow them for useflap.online in site settings, then try again.");
                      return;
                    }
                    if (Notification.permission !== "granted") {
                      const perm = await Notification.requestPermission();
                      if (perm !== "granted") {
                        setErr("Notification permission was not granted.");
                        return;
                      }
                    }
                  }
                  await api.savePrefs({
                    vacation_enabled: Boolean(prefs.vacation_enabled),
                    vacation_body: prefs.vacation_body,
                    notify_browser: Boolean(prefs.notify_browser),
                    undo_send_seconds: Number(prefs.undo_send_seconds ?? 10),
                  });
                  setErr("");
                  setNotice(prefs.notify_browser ? "Notifications on. Keep a Flap tab open to receive alerts." : "Notifications disabled.");
                })();
              }}>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={Boolean(prefs.notify_browser)}
                    onChange={(e) => setPrefs((p) => ({ ...p, notify_browser: e.target.checked ? 1 : 0 }))}
                  />
                  Enable browser notifications for new mail
                </label>
                <label>
                  Undo send window (seconds)
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={prefs.undo_send_seconds ?? 10}
                    onChange={(e) => setPrefs((p) => ({ ...p, undo_send_seconds: Number(e.target.value) }))}
                  />
                </label>
                <p className="muted" style={{ fontSize: 12 }}>0 disables undo. Default 10 — message sits in Scheduled until the timer fires.</p>
                <Button type="submit">Save notifications</Button>
              </form>
            </section>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Automatic replies</h2><p>Send one vacation reply per sender every seven days.</p></div></div>
              <form className="stack-form" onSubmit={(e) => { e.preventDefault(); void api.savePrefs({ vacation_enabled: Boolean(prefs.vacation_enabled), vacation_body: prefs.vacation_body, notify_browser: Boolean(prefs.notify_browser) }).then(() => setNotice("Automatic replies updated.")); }}>
                <label className="check-row"><input type="checkbox" checked={Boolean(prefs.vacation_enabled)} onChange={(e) => setPrefs((p) => ({ ...p, vacation_enabled: e.target.checked ? 1 : 0 }))} /> Enable automatic replies</label>
                <textarea value={prefs.vacation_body} onChange={(e) => setPrefs((p) => ({ ...p, vacation_body: e.target.value }))} placeholder="Thanks for writing — I’ll get back to you soon." />
                <Button type="submit">Save replies</Button>
              </form>
            </section>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Blocked senders</h2><p>Future mail from these addresses is filed to Spam.</p></div></div>
              <form className="row-form" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const input = form.elements.namedItem("block") as HTMLInputElement; void api.block(input.value).then(() => { input.value = ""; return refresh(); }).catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not block sender.")); }}>
                <input name="block" placeholder="sender@example.com" required />
                <Button type="submit">Block</Button>
              </form>
              {blocked.length ? <table className="table"><thead><tr><th>Address</th><th /></tr></thead><tbody>
                {blocked.map((b) => <tr key={b.id}><td>{b.address}</td><td><Button variant="danger" type="button" onClick={() => void api.unblock(b.id).then(refresh)}>Unblock</Button></td></tr>)}
              </tbody></table> : <p className="empty-state">Nobody is blocked.</p>}
            </section>
            <section className="settings-card">
              <div className="section-heading"><div><h2>Backup & restore</h2><p>Export messages and workspace data as JSON, or download a classic .mbox mailbox file. Restore merges contacts, templates, signatures, and rules (messages are export-only).</p></div></div>
              <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  className="h-10 w-full whitespace-nowrap"
                  disabled={Boolean(privacyBusy)}
                  onClick={() =>
                    runPrivacy("backup", async () => {
                      await api.exportBackup();
                      flash("Backup download started.");
                    })
                  }
                >
                  {privacyBusy === "backup" ? "Preparing…" : "Download backup"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full whitespace-nowrap"
                  disabled={Boolean(privacyBusy)}
                  onClick={() =>
                    runPrivacy("mbox", async () => {
                      await api.exportMbox();
                      flash("Mailbox (.mbox) download started.");
                    })
                  }
                >
                  {privacyBusy === "mbox" ? "Preparing…" : "Download .mbox"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full whitespace-nowrap"
                  disabled={Boolean(privacyBusy)}
                  onClick={() => restoreFileRef.current?.click()}
                >
                  {privacyBusy === "restore" ? "Restoring…" : "Restore JSON"}
                </Button>
                <input
                  ref={restoreFileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    const input = e.currentTarget;
                    const file = input.files?.[0];
                    input.value = "";
                    if (!file) return;
                    runPrivacy("restore", async () => {
                      const text = await file.text();
                      let payload: unknown;
                      try {
                        payload = JSON.parse(text);
                      } catch {
                        throw new Error("That file is not valid JSON.");
                      }
                      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
                        throw new Error("Upload a Flap backup JSON object (not an array).");
                      }
                      const res = await api.restoreBackup(payload);
                      flash(`Restored ${res.restored} items.`);
                      try {
                        await refresh();
                      } catch {
                        /* restore already succeeded */
                      }
                    });
                  }}
                />
              </div>
            </section>

            <section className="settings-card">
              <div className="section-heading">
                <div>
                  <h2>Appearance</h2>
                  <p>Theme follows your preference. Dark mode keeps Flap teal.</p>
                </div>
              </div>
              <ThemeToggle />
            </section>

            <section className="settings-card">
              <div className="section-heading">
                <div>
                  <h2>AI assist (confirm only)</h2>
                  <p>Optional summaries and draft replies from the reader. Never auto-send. {aiOptIn ? "Currently on." : "Currently off."}</p>
                </div>
                {aiOptIn ? <Badge>Enabled</Badge> : <Badge variant="secondary">Off</Badge>}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:max-w-md">
                <Button
                  type="button"
                  className="w-full"
                  disabled={Boolean(privacyBusy) || aiOptIn}
                  onClick={() =>
                    runPrivacy("ai-on", async () => {
                      await api.setAiOptIn(true);
                      setAiOptIn(true);
                      flash("AI opt-in enabled. Summaries still require confirm before use.");
                    })
                  }
                >
                  {privacyBusy === "ai-on" ? "Enabling…" : "Enable AI"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={Boolean(privacyBusy) || !aiOptIn}
                  onClick={() =>
                    runPrivacy("ai-off", async () => {
                      await api.setAiOptIn(false);
                      setAiOptIn(false);
                      flash("AI disabled.");
                    })
                  }
                >
                  {privacyBusy === "ai-off" ? "Disabling…" : "Disable"}
                </Button>
              </div>
            </section>

            <section className="settings-card">
              <div className="section-heading">
                <div>
                  <h2>Rule packs</h2>
                  <p>Install a starter filter pack (newsletters, receipts, and similar).</p>
                </div>
              </div>
              <Button
                type="button"
                disabled={Boolean(privacyBusy)}
                onClick={() =>
                  runPrivacy("rules", async () => {
                    const r = await api.ruleTemplates();
                    const first = r.templates[0];
                    if (!first) throw new Error("No rule packs available yet.");
                    await api.installRuleTemplate(first.id);
                    flash(`Installed “${first.name}”. Check Rules.`);
                  })
                }
              >
                {privacyBusy === "rules" ? "Installing…" : "Install starter pack"}
              </Button>
            </section>

            <section className="settings-card">
              <div className="section-heading">
                <div>
                  <h2>Compose starters</h2>
                  <p>Add Thanks, Pricing, Bug ack, and Waitlist templates to Compose.</p>
                </div>
              </div>
              <Button
                type="button"
                disabled={Boolean(privacyBusy)}
                onClick={() =>
                  runPrivacy("seed", async () => {
                    await api.seedTemplates("en");
                    flash("Added Thanks / Pricing / Bug ack / Waitlist templates. Open Compose to use them.");
                  })
                }
              >
                {privacyBusy === "seed" ? "Seeding…" : "Seed domain templates"}
              </Button>
            </section>

            <section className="settings-card">
              <div className="section-heading">
                <div>
                  <h2>Cancel / export policy</h2>
                  <p>30-day export window on cancel. Download .mbox anytime from Backup &amp; restore above.</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(privacyBusy)}
                onClick={() =>
                  runPrivacy("policy", async () => {
                    const p = await api.trustExportPolicy();
                    const text = [
                      typeof p.retention === "string" ? p.retention : "",
                      typeof p.ownership === "string" ? p.ownership : "",
                      Array.isArray(p.formats) ? `Formats: ${(p.formats as string[]).join(", ")}.` : "",
                      typeof p.cancel_export_window_days === "number"
                        ? `Cancel export window: ${p.cancel_export_window_days} days.`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    const msg = text || "You can export anytime from Settings.";
                    setExportPolicy(msg);
                    flash(msg);
                  })
                }
              >
                {privacyBusy === "policy" ? "Loading…" : "View policy"}
              </Button>
              {exportPolicy ? (
                <p className="notice mt-3" role="status" style={{ marginBottom: 0 }}>
                  {exportPolicy}
                </p>
              ) : null}
            </section>
          </>
        ) : null}

        

        {tab === "billing" ? (
          <>
          <section className="settings-card">
            <div className="section-heading">
              <div>
                <h2>Plan & usage</h2>
                <p>Flap billing runs through Dodo Payments. Limits apply after webhook confirmation.</p>
              </div>
              {billing ? <Badge>{billing.plan.name} · {billing.status}</Badge> : null}
            </div>
            <div className="mb-5 inline-flex rounded-lg border border-[var(--line-strong)] bg-[var(--surface-2)] p-1">
              <Button
                type="button"
                size="sm"
                variant={billingInterval === "month" ? "default" : "ghost"}
                className="min-w-[7rem]"
                onClick={() => setBillingInterval("month")}
              >
                Monthly
              </Button>
              <Button
                type="button"
                size="sm"
                variant={billingInterval === "year" ? "default" : "ghost"}
                className="min-w-[7rem]"
                onClick={() => setBillingInterval("year")}
              >
                Annual (−20%)
              </Button>
            </div>
            {!checkoutConfigured ? (
              <div className="deferred-banner" style={{ marginBottom: 16 }}>
                Self-serve checkout is not configured
                {dodoEnvironment ? ` (${dodoEnvironment})` : ""}.
                {checkoutMissing.length > 0 ? (
                  <>
                    {" "}Missing env: <code>{checkoutMissing.join(", ")}</code>.
                  </>
                ) : null}{" "}
                For local testing set test API key + product IDs in <code>.dev.vars</code> with{" "}
                <code>DODO_PAYMENTS_ENVIRONMENT=test_mode</code>. Or email{" "}
                <a href={`mailto:${supportEmail}`}>{supportEmail}</a> to upgrade.
              </div>
            ) : dodoEnvironment === "test_mode" ? (
              <div className="deferred-banner" style={{ marginBottom: 16 }}>
                Dodo is in <code>test_mode</code> — checkouts use test keys and{" "}
                <code>test.dodopayments.com</code> (no real charges).
              </div>
            ) : null}
            {billing ? (
              <div className="grid-2" style={{ marginBottom: 20 }}>
                <div>
                  <p className="muted" style={{ margin: 0 }}>Domains</p>
                  <strong>{billing.usage.domains} / {billing.limits.domains}</strong>
                </div>
                <div>
                  <p className="muted" style={{ margin: 0 }}>Mailboxes</p>
                  <strong>{billing.usage.mailboxes} / {billing.limits.mailboxes}</strong>
                </div>
                <div>
                  <p className="muted" style={{ margin: 0 }}>Aliases</p>
                  <strong>{billing.usage.aliases} / {billing.limits.aliases}</strong>
                </div>
                <div>
                  <p className="muted" style={{ margin: 0 }}>Storage</p>
                  <strong>{formatBytes(billing.usage.storage_bytes)} / {formatBytes(billing.limits.storage_bytes)}</strong>
                </div>
                <div>
                  <p className="muted" style={{ margin: 0 }}>Sends this month</p>
                  <strong>{billing.usage.send_per_month ?? 0} / {billing.limits.send_per_month ?? "—"}</strong>
                </div>
                <div>
                  <p className="muted" style={{ margin: 0 }}>API keys</p>
                  <strong>{billing.usage.api_keys} / {billing.limits.api_keys}</strong>
                </div>
                <div>
                  <p className="muted" style={{ margin: 0 }}>Webhooks</p>
                  <strong>{billing.usage.webhooks} / {billing.limits.webhooks}</strong>
                </div>
                <div>
                  <p className="muted" style={{ margin: 0 }}>Team seats</p>
                  <strong>{billing.usage.team_seats ?? 1} / {billing.limits.team_seats}</strong>
                </div>
              </div>
            ) : (
              <p className="empty-state">Billing data unavailable. Apply migration 0005_billing and reload.</p>
            )}
            {billing ? (
              <p className="muted" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>
                Storage counts message bodies and attachments. Outbound sends reset each UTC calendar month.
              </p>
            ) : null}
            <div className="row-form" style={{ marginBottom: 16, flexWrap: "wrap" }}>
              {billing?.portal_available ? (
                <Button variant="outline" disabled={portalBusy} onClick={() => void openPortal()}>
                  {portalBusy ? "Opening…" : "Manage subscription"}
                </Button>
              ) : billing && billing.plan_id !== "free" ? (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  To cancel or change payment methods, email{" "}
                  <a href={`mailto:${supportEmail}?subject=Flap%20subscription`}>{supportEmail}</a>
                  {" "}or complete a portal-linked checkout first.
                </p>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  Cancel anytime after upgrading via the customer portal, or contact{" "}
                  <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
                </p>
              )}
            </div>
            <div className="notice" style={{ marginBottom: 16 }} role="note">
              <strong>Cancel &amp; export</strong>
              <p style={{ margin: "6px 0 0" }}>
                You can export anytime. After cancel, keep access through the paid period; download your mailbox before it ends.
              </p>
            </div>
            <div className="grid-2">
              {plans.filter((p) => p.id !== "free").map((plan) => {
                const available = plan.checkout_available !== false && checkoutConfigured;
                const isCurrent = billing?.plan_id === plan.id;
                const yearly = plan.price_yearly ?? Math.round(plan.price_monthly * 12 * 0.8);
                const priceLabel =
                  billingInterval === "year"
                    ? `$${yearly}/yr`
                    : `$${plan.price_monthly}/mo`;
                const priceHint =
                  billingInterval === "year" && plan.price_monthly > 0
                    ? `≈ $${Math.round((yearly / 12) * 100) / 100}/mo billed annually`
                    : billingInterval === "month" && plan.price_monthly > 0
                      ? `or $${yearly}/yr (−20%)`
                      : null;
                return (
                  <div key={plan.id} className="settings-card" style={{ margin: 0, padding: 16 }}>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <strong>{plan.name}</strong>
                      <div className="text-right">
                        <span className="font-semibold tabular-nums">{priceLabel}</span>
                        {priceHint ? <div className="muted mt-0.5 text-[11px]">{priceHint}</div> : null}
                      </div>
                    </div>
                    <p className="muted" style={{ marginTop: 0 }}>{plan.blurb}</p>
                    <ul className="muted" style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 13 }}>
                      {plan.features.slice(0, 4).map((f) => <li key={f}>{f}</li>)}
                    </ul>
                    <Button
                      disabled={isCurrent || checkoutBusy === plan.id || !available}
                      onClick={() => void startCheckout(plan.id)}
                    >
                      {isCurrent
                        ? "Current plan"
                        : checkoutBusy === plan.id
                          ? "Redirecting…"
                          : !available
                            ? "Contact to upgrade"
                            : `Upgrade to ${plan.name}`}
                    </Button>
                    {!available && !isCurrent ? (
                      <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                        <a href={`mailto:${supportEmail}?subject=Upgrade%20to%20${plan.name}`}>{supportEmail}</a>
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>
              See <a href="/billing-terms" onClick={(e) => { e.preventDefault(); go("/billing-terms"); }}>Billing Terms</a> for renewals and cancellation.
            </p>
          </section>
          </>
        ) : null}

        {tab === "team" ? (
          <section className="settings-card">
            <div className="section-heading">
              <div>
                <h2>Team &amp; shared mailboxes</h2>
                <p>
                  {teamInfo?.teams_unlocked
                    ? `Invite teammates, assign roles, and share inboxes like support@ or hello@. ${members.length} / ${teamInfo.limits.team_seats} seats used.`
                    : "Upgrade to Studio to invite members and share mailboxes. Free, Solo, and Builder stay solo."}
                </p>
              </div>
              <Badge variant={teamInfo?.teams_unlocked ? "default" : "secondary"}>
                {teamInfo?.teams_unlocked ? "Studio plan" : "Solo"}
              </Badge>
            </div>

            {!teamInfo?.teams_unlocked ? (
              <div className="deferred-banner">
                Team seats unlock on the Studio plan ($39/mo). You can still manage your own mailboxes on Free, Solo, or Builder.
                <div style={{ marginTop: 12 }}>
                  <Button size="sm" onClick={() => setTab("billing")}>View Studio plan</Button>
                </div>
              </div>
            ) : null}

            {teamInfo?.workspace?.can_manage_team ? (
              <form
                className="stack-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const input = form.elements.namedItem("invite") as HTMLInputElement;
                  void api
                    .inviteTeam(input.value, inviteRole, inviteMailboxes)
                    .then((res) => {
                      const link = res.invite.accept_path
                        ? `${window.location.origin}${res.invite.accept_path}`
                        : "";
                      setNotice(link ? `Invite created. Share this link: ${link}` : "Invite created.");
                      input.value = "";
                      return refresh();
                    })
                    .catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not send invite."));
                }}
              >
                <div className="row-form">
                  <input name="invite" type="email" placeholder="teammate@example.com" required disabled={!teamInfo?.teams_unlocked} />
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} disabled={!teamInfo?.teams_unlocked}>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button type="submit" disabled={!teamInfo?.teams_unlocked}>Invite</Button>
                </div>
                {mailboxes.length ? (
                  <div className="mailbox-grant-list">
                    <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Grant mailbox access (optional — defaults to shared inboxes):</p>
                    {mailboxes.map((mb) => (
                      <label key={mb.id} className="check-row">
                        <input
                          type="checkbox"
                          checked={inviteMailboxes.includes(mb.id)}
                          disabled={!teamInfo?.teams_unlocked}
                          onChange={(e) => {
                            setInviteMailboxes((prev) =>
                              e.target.checked ? [...prev, mb.id] : prev.filter((id) => id !== mb.id),
                            );
                          }}
                        />
                        {mb.address}{mb.is_shared ? " · shared" : ""}
                      </label>
                    ))}
                  </div>
                ) : null}
              </form>
            ) : (
              <p className="muted">You are a {teamInfo?.workspace?.role || "member"} in this workspace.</p>
            )}

            <h3 style={{ marginTop: 28, marginBottom: 12 }}>Members</h3>
            {members.length ? (
              <table className="table">
                <thead><tr><th>Email</th><th>Role</th><th></th></tr></thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.user_id}>
                      <td>{m.email}{m.name ? ` (${m.name})` : ""}</td>
                      <td>{m.role}</td>
                      <td>
                        {teamInfo?.workspace?.can_manage_team && m.role !== "owner" ? (
                          <Button
                            className="ghost"
                            type="button"
                            onClick={() => {
                              void api.removeMember(m.user_id).then(refresh).catch((ex) =>
                                setErr(ex instanceof Error ? ex.message : "Could not remove member."),
                              );
                            }}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-state">No members yet.</p>
            )}

            <h3 style={{ marginTop: 28, marginBottom: 12 }}>Pending invites</h3>
            {invites.filter((i) => i.status === "pending").length ? (
              <table className="table">
                <thead><tr><th>Email</th><th>Role</th><th>Link</th><th></th></tr></thead>
                <tbody>
                  {invites.filter((i) => i.status === "pending").map((i) => (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td>{i.role}</td>
                      <td style={{ fontSize: 12 }}>
                        {i.accept_path ? (
                          <Button
                            type="button"
                            className="ghost"
                            onClick={() => {
                              void navigator.clipboard.writeText(`${window.location.origin}${i.accept_path}`);
                              setNotice("Invite link copied.");
                            }}
                          >
                            Copy link
                          </Button>
                        ) : "—"}
                      </td>
                      <td>
                        {teamInfo?.workspace?.can_manage_team ? (
                          <Button
                            className="ghost"
                            type="button"
                            onClick={() => {
                              void api.revokeInvite(i.id).then(refresh).catch((ex) =>
                                setErr(ex instanceof Error ? ex.message : "Could not revoke."),
                              );
                            }}
                          >
                            Revoke
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-state">No pending invites.</p>
            )}

            <h3 style={{ marginTop: 28, marginBottom: 12 }}>Shared mailboxes</h3>
            <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
              Mark support@ or hello@ as shared so invitees can access them. Requires Studio plan.
            </p>
            {mailboxes.length ? (
              <table className="table">
                <thead><tr><th>Address</th><th>Shared</th><th></th></tr></thead>
                <tbody>
                  {mailboxes.map((mb) => (
                    <tr key={mb.id}>
                      <td>{mb.address}</td>
                      <td>{mb.is_shared ? "Yes" : "No"}</td>
                      <td>
                        {teamInfo?.workspace?.can_manage_team ? (
                          <Button
                            className="ghost"
                            type="button"
                            disabled={!teamInfo.teams_unlocked && !mb.is_shared}
                            onClick={() => {
                              void api
                                .shareMailbox(mb.id, !mb.is_shared)
                                .then(refresh)
                                .catch((ex) => setErr(ex instanceof Error ? ex.message : "Could not update."));
                            }}
                          >
                            {mb.is_shared ? "Unshare" : "Make shared"}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-state">Create a mailbox in Setup first.</p>
            )}
          </section>
        ) : null}

        {tab === "referrals" ? (
          <section className="settings-card">
            <div className="section-heading">
              <div>
                <h2>Referrals</h2>
                <p>{referralInfo?.reward_rule || "Invite a founder → both accounts get +1 domain permanently after they connect a domain."}</p>
              </div>
            </div>
            {referralInfo ? (
              <>
                <label className="stack gap-1.5">
                  <span className="muted text-sm">Your referral link</span>
                  <div className="row-form">
                    <input readOnly value={referralInfo.link} aria-label="Referral link" />
                    <Button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(referralInfo.link).then(() => {
                          setNotice("Referral link copied.");
                          void import("../lib/analytics").then(({ track }) => track("referral_link_copied"));
                        });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </label>
                <div className="row-form" style={{ marginTop: 16, gap: 24 }}>
                  <div>
                    <strong>{referralInfo.successful_referrals}</strong>
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>Successful</p>
                  </div>
                  <div>
                    <strong>{referralInfo.pending_referrals}</strong>
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>Pending</p>
                  </div>
                  <div>
                    <strong>{referralInfo.domains_earned}</strong>
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>Domains earned</p>
                  </div>
                </div>
                {referralInfo.history.length ? (
                  <table className="table" style={{ marginTop: 20 }}>
                    <thead>
                      <tr>
                        <th>Invitee</th>
                        <th>Status</th>
                        <th>Reward</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referralInfo.history.map((h) => (
                        <tr key={h.id}>
                          <td>{h.referred_email}</td>
                          <td>{h.status}</td>
                          <td>+{h.reward_domains} domain</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="empty-state">No referrals yet. Share your link with another founder.</p>
                )}
              </>
            ) : (
              <p className="muted">Loading referral details…</p>
            )}
          </section>
        ) : null}
      </main>
      {toast
        ? createPortal(
            <div className="mail-toast" role="status" style={{ zIndex: 9999 }}>
              <div>
                <strong>{toast.title}</strong>
                <span>{toast.body}</span>
              </div>
              <button type="button" className="mail-toast-close" aria-label="Dismiss" onClick={() => setToast(null)}>
                ×
              </button>
            </div>,
            document.body,
          )
        : null}
    </AppShell>
  );
}

function SignatureForm({ onSave }: { onSave: (body: { name: string; html_body: string; text_body: string; is_default: boolean }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  return (
    <form className="stack-form" onSubmit={(e) => { e.preventDefault(); void onSave({ name, html_body: `<p>${body.replace(/\n/g, "<br/>")}</p>`, text_body: body, is_default: isDefault }).then(() => { setName(""); setBody(""); }); }}>
      <input placeholder="Signature name" value={name} onChange={(e) => setName(e.target.value)} required />
      <textarea placeholder="Best,\nAda" value={body} onChange={(e) => setBody(e.target.value)} required />
      <label className="check-row"><input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Default signature</label>
      <Button type="submit">Add signature</Button>
    </form>
  );
}

function TemplateForm({ onSave }: { onSave: (body: { name: string; subject: string; html_body: string; text_body: string }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  return (
    <form className="stack-form" onSubmit={(e) => { e.preventDefault(); void onSave({ name, subject, html_body: `<p>${body.replace(/\n/g, "<br/>")}</p>`, text_body: body }).then(() => { setName(""); setSubject(""); setBody(""); }); }}>
      <div className="row-form">
        <input placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <textarea placeholder="Message body" value={body} onChange={(e) => setBody(e.target.value)} required />
      <Button type="submit">Add template</Button>
    </form>
  );
}

function ContactForm({ onSave }: { onSave: (email: string, name: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  return (
    <form className="row-form" onSubmit={(e) => { e.preventDefault(); void onSave(email, name).then(() => { setEmail(""); setName(""); }); }}>
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Button type="submit">Add contact</Button>
    </form>
  );
}

function FilterForm({ onSave }: { onSave: (body: {
  name: string;
  match_from?: string;
  match_to?: string;
  match_subject?: string;
  action: string;
  forward_to?: string;
  label?: string;
  is_catch_all?: boolean;
}) => Promise<void> }) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [action, setAction] = useState("archive");
  const [forwardTo, setForwardTo] = useState("");
  const [label, setLabel] = useState("");
  const [catchAll, setCatchAll] = useState(false);
  const [sampleFrom, setSampleFrom] = useState("alice@example.com");
  const [sampleTo, setSampleTo] = useState("hello@yourdomain.com");
  const [sampleSubject, setSampleSubject] = useState("Hello from Flap");
  const [testResult, setTestResult] = useState("");

  function previewMatch() {
    if (catchAll) {
      setTestResult("Catch-all: matches any mail that no earlier rule claimed.");
      return;
    }
    const f = from.trim().toLowerCase();
    const t = to.trim().toLowerCase();
    const s = subject.trim().toLowerCase();
    if (!f && !t && !s) {
      setTestResult("Add at least one match condition (or mark catch-all).");
      return;
    }
    const okFrom = !f || sampleFrom.toLowerCase().includes(f);
    const okTo = !t || sampleTo.toLowerCase().includes(t);
    const okSubject = !s || sampleSubject.toLowerCase().includes(s);
    const matches = okFrom && okTo && okSubject;
    setTestResult(
      matches
        ? `Would match → action “${action}”${label ? ` (${label})` : ""}${forwardTo ? ` → ${forwardTo}` : ""}.`
        : "Would not match this sample (same rules as inbound: substring contains on from/to/subject).",
    );
  }

  return (
    <form className="stack-form" onSubmit={(e) => {
      e.preventDefault();
      void onSave({
        name,
        match_from: from,
        match_to: to,
        match_subject: subject,
        action,
        forward_to: forwardTo,
        label,
        is_catch_all: catchAll,
      }).then(() => {
        setName("");
        setFrom("");
        setTo("");
        setSubject("");
        setForwardTo("");
        setLabel("");
        setCatchAll(false);
        setTestResult("");
      });
    }}>
      <div className="row-form">
        <input placeholder="Rule name" value={name} onChange={(e) => setName(e.target.value)} required />
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="archive">Archive</option>
          <option value="spam">Spam</option>
          <option value="trash">Trash</option>
          <option value="star">Star</option>
          <option value="label">Auto-label</option>
          <option value="forward">Forward</option>
          <option value="inbox">Keep in inbox</option>
        </select>
      </div>
      <div className="row-form">
        <input placeholder="From contains" value={from} onChange={(e) => setFrom(e.target.value)} disabled={catchAll} />
        <input placeholder="To contains" value={to} onChange={(e) => setTo(e.target.value)} disabled={catchAll} />
        <input placeholder="Subject contains" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={catchAll} />
      </div>
      {action === "forward" ? <input placeholder="Forward to email" value={forwardTo} onChange={(e) => setForwardTo(e.target.value)} required /> : null}
      {action === "label" ? <input placeholder="Label name" value={label} onChange={(e) => setLabel(e.target.value)} required /> : null}
      <label className="check-row"><input type="checkbox" checked={catchAll} onChange={(e) => setCatchAll(e.target.checked)} /> Catch-all (apply when no other rule matches)</label>
      <div className="notice" style={{ marginTop: 4 }}>
        <p className="muted" style={{ margin: "0 0 8px", fontSize: 13 }}>
          Test rule — preview against sample headers (client-side; same contains matching as inbound).
        </p>
        <div className="row-form">
          <input aria-label="Sample from" placeholder="Sample from" value={sampleFrom} onChange={(e) => setSampleFrom(e.target.value)} />
          <input aria-label="Sample to" placeholder="Sample to" value={sampleTo} onChange={(e) => setSampleTo(e.target.value)} />
          <input aria-label="Sample subject" placeholder="Sample subject" value={sampleSubject} onChange={(e) => setSampleSubject(e.target.value)} />
        </div>
        <div className="row-form" style={{ marginTop: 8 }}>
          <Button size="sm" variant="ghost" type="button" onClick={() => previewMatch()}>Test rule</Button>
          {testResult ? <p className="muted" style={{ margin: 0, fontSize: 13 }}>{testResult}</p> : null}
        </div>
      </div>
      <Button type="submit">Add rule</Button>
    </form>
  );
}

function AliasForm({
  mailboxes,
  onSave,
}: {
  mailboxes: Mailbox[];
  onSave: (body: { mailbox_id: string; local_part: string; label?: string; disposable?: boolean; expires_at?: number | null }) => Promise<void>;
}) {
  const [localPart, setLocalPart] = useState("");
  const [mailboxId, setMailboxId] = useState(mailboxes[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [disposable, setDisposable] = useState(false);
  useEffect(() => {
    if (!mailboxId && mailboxes[0]) setMailboxId(mailboxes[0].id);
  }, [mailboxId, mailboxes]);
  return (
    <form className="stack-form" onSubmit={(e) => {
      e.preventDefault();
      void onSave({
        mailbox_id: mailboxId,
        local_part: localPart,
        label,
        disposable,
        expires_at: disposable ? Date.now() + 7 * 24 * 60 * 60 * 1000 : null,
      }).then(() => {
        setLocalPart("");
        setLabel("");
        setDisposable(false);
      });
    }}>
      <div className="row-form">
        <input placeholder="local-part" value={localPart} onChange={(e) => setLocalPart(e.target.value)} required />
        <select value={mailboxId} onChange={(e) => setMailboxId(e.target.value)} required>
          {mailboxes.map((m) => <option key={m.id} value={m.id}>{m.address}</option>)}
        </select>
      </div>
      <div className="row-form">
        <input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <label className="check-row"><input type="checkbox" checked={disposable} onChange={(e) => setDisposable(e.target.checked)} /> Disposable (7 days)</label>
      </div>
      <Button type="submit" disabled={!mailboxId}>Add alias</Button>
    </form>
  );
}
