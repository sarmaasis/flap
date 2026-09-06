export type User = { id: string; email: string; created_at?: number; email_verified?: boolean };
export type Mailbox = {
  id: string;
  domain_id?: string;
  local_part?: string;
  address: string;
  display_name?: string;
  created_at?: number;
  domain?: string;
  is_shared?: number;
  access_role?: string;
};
export type Domain = {
  id: string;
  name: string;
  catch_all_mailbox_id?: string | null;
  color?: string | null;
  muted_until?: number | null;
  created_at: number;
  mail_provider?: string | null;
  provider_state?: string | null;
  provider_region?: string | null;
  identity_verified_at?: number | null;
  mx_verified_at?: number | null;
  inbound_rule_ready_at?: number | null;
  receiving_ready_at?: number | null;
  sending_ready_at?: number | null;
  last_provider_error?: string | null;
  migration_from?: string | null;
  migration_state?: string | null;
};
export type FolderCounts = Record<string, { total: number; unread: number }>;
export type MailSummary = {
  id: string;
  mailbox_id: string | null;
  folder: string;
  from_addr: string;
  to_addr: string;
  cc_addr?: string;
  bcc_addr?: string;
  subject: string;
  date_ms: number;
  has_attachments: number;
  unread: number;
  starred?: number;
  snooze_until?: number | null;
  scheduled_at?: number | null;
  snippet?: string;
  label?: string;
  thread_id?: string | null;
  rfc_message_id?: string | null;
  assignee_user_id?: string | null;
  plus_tag?: string | null;
  created_at: number;
};
export type MailFull = MailSummary & {
  text_body: string;
  html_body: string;
  in_reply_to?: string | null;
  rfc_message_id?: string | null;
  references_header?: string | null;
};
export type Attachment = { id: string; filename: string; content_type: string; size: number };
export type Contact = { id: string; email: string; name: string; last_used_at: number; created_at?: number };
export type Template = { id: string; name: string; subject: string; html_body: string; text_body: string; created_at?: number; updated_at?: number };
export type Signature = { id: string; name: string; html_body: string; text_body: string; is_default: number; created_at?: number };
export type Filter = {
  id: string;
  name: string;
  match_from: string;
  match_to: string;
  match_subject: string;
  action: string;
  forward_to?: string;
  label?: string;
  is_catch_all?: number;
  enabled: number;
  created_at: number;
};
export type BlockedSender = { id: string; address: string; created_at: number };
export type ApiKey = { id: string; name: string; key_prefix: string; created_at: number; last_used_at: number | null; token?: string };
export type Alias = {
  id: string;
  mailbox_id: string;
  domain_id: string;
  local_part: string;
  address: string;
  label: string;
  disposable: number;
  expires_at: number | null;
  enabled: number;
  created_at: number;
};
export type Webhook = {
  id: string;
  name: string;
  url: string;
  events: string;
  enabled: number;
  created_at: number;
  last_triggered_at: number | null;
  secret?: string;
};
export type WebhookDelivery = {
  id: string;
  webhook_id: string;
  event: string;
  status_code: number | null;
  ok: number;
  error: string;
  created_at: number;
};
export type Prefs = {
  vacation_enabled: number;
  vacation_body: string;
  notify_browser?: number;
  undo_send_seconds?: number;
};
export type Label = { id: string; name: string; color: string; created_at: number };
export type MessageNote = { id: string; body: string; created_at: number; user_id: string; author_email?: string };
export type Suppression = {
  id: string;
  email: string;
  reason: string;
  source: string;
  provider_message_id?: string | null;
  created_at: number;
  expires_at?: number | null;
};
export type TeamInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: number;
  expires_at?: number | null;
  token?: string | null;
  accept_path?: string | null;
  mailbox_ids?: string;
};
export type TeamMember = {
  user_id: string;
  email: string;
  name?: string | null;
  role: string;
  created_at: number;
};
export type TeamResponse = {
  deferred: boolean;
  teams_unlocked: boolean;
  plan_id: string;
  limits: { team_seats: number };
  workspace: { id: string; role: string; can_manage_team: boolean };
  members: TeamMember[];
  invites: TeamInvite[];
  shared_mailboxes: { id: string; address: string; display_name?: string; is_shared: number; member_ids?: string | null }[];
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    credentials: "same-origin",
  });
  if (res.status === 204) return {} as T;
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export type SendPayload = {
  id?: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  draft?: boolean;
  scheduled_at?: number | null;
  in_reply_to?: string;
  attachments?: { filename: string; content_type: string; data: string }[];
};

export type PlanSummary = {
  id: string;
  name: string;
  price_monthly: number;
  blurb: string;
  features: string[];
  limits: Record<string, number>;
  highlighted?: boolean;
  checkout_available?: boolean;
};

export type BillingPlansResponse = {
  plans: PlanSummary[];
  checkout_configured?: boolean;
  dodo_environment?: "test_mode" | "live_mode";
  checkout_missing?: string[];
  support_email?: string;
};

export type BillingSubscription = {
  plan_id: string;
  status: string;
  limits: Record<string, number>;
  usage: Record<string, number>;
  quota_reset?: "utc_calendar_month";
  checkout_configured?: boolean;
  dodo_environment?: "test_mode" | "live_mode";
  checkout_missing?: string[];
  portal_available?: boolean;
  support_email?: string;
  subscription: {
    id: string;
    dodo_subscription_id: string | null;
    dodo_customer_id?: string | null;
    current_period_end: number | null;
    cancel_at_period_end: boolean;
  };
  plan: PlanSummary;
};

export const api = {
  setupStatus: () => req<{ needs_setup: boolean; signup_open?: boolean }>("/api/setup/status"),
  setup: (email: string) =>
    req<{ ok: boolean; magic_sent?: boolean; email?: string; user?: User }>("/api/setup", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  signup: (email: string, _password?: string, name?: string, referral_code?: string) =>
    req<{ ok: boolean; user: User }>("/api/signup", {
      method: "POST",
      body: JSON.stringify({ email, name, referral_code }),
    }),
  login: (email: string, _password?: string) =>
    req<{ ok: boolean; user: User }>("/api/login", { method: "POST", body: JSON.stringify({ email }) }),
  logout: () => req<{ ok: boolean }>("/api/logout", { method: "POST" }),
  me: () => req<{ user: User; mailboxes: Mailbox[] }>("/api/me"),
  billingPlans: () => req<BillingPlansResponse>("/api/billing/plans"),
  billingSubscription: () => req<BillingSubscription>("/api/billing/subscription"),
  billingCheckout: (plan: string) =>
    req<{ checkout_url: string; session_id: string }>("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),
  billingPortal: () =>
    req<{ portal_url: string }>("/api/billing/portal", { method: "POST", body: "{}" }),
  bootstrap: () =>
    req<{
      user: User;
      mailboxes: Mailbox[];
      signatures: Signature[];
      templates: Template[];
      contacts: Contact[];
      settings: Prefs;
      counts: FolderCounts;
      domain_unread?: Record<string, number>;
      server_time: number;
    }>("/api/bootstrap"),
  counts: (signal?: AbortSignal) =>
    req<{ counts: FolderCounts; domain_unread?: Record<string, number>; server_time: number }>("/api/counts", { signal }),
  domains: () => req<{ domains: Domain[] }>("/api/domains"),
  createDomain: (name: string) =>
    req<{ domain: Domain; records?: DnsRecords }>("/api/domains", { method: "POST", body: JSON.stringify({ name }) }),
  migrateDomainSes: (id: string) =>
    req<{ ok: boolean; records?: DnsRecords; note?: string; already?: boolean }>(`/api/domains/${id}/migrate-ses`, {
      method: "POST",
      body: "{}",
    }),
  updateDomain: (
    id: string,
    patch: { catch_all_mailbox_id?: string | null; color?: string; muted_until?: number | null; muted_days?: number | null },
  ) => req<{ ok: boolean }>(`/api/domains/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteDomain: (id: string) => req<{ ok: boolean }>(`/api/domains/${id}`, { method: "DELETE" }),
  mailboxes: () => req<{ mailboxes: Mailbox[] }>("/api/mailboxes"),
  createMailbox: (domain_id: string, local_part: string) =>
    req<{ mailbox: Mailbox }>("/api/mailboxes", { method: "POST", body: JSON.stringify({ domain_id, local_part }) }),
  updateMailbox: (id: string, display_name: string) =>
    req<{ ok: boolean }>(`/api/mailboxes/${id}`, { method: "PATCH", body: JSON.stringify({ display_name }) }),
  deleteMailbox: (id: string) => req<{ ok: boolean }>(`/api/mailboxes/${id}`, { method: "DELETE" }),
  dns: (domain: string) => req<{ records: DnsRecords }>(`/api/dns?domain=${encodeURIComponent(domain)}`),
  mail: (folder: string, mailbox?: string, signal?: AbortSignal, domain?: string) =>
    req<{ folder: string; messages: MailSummary[] }>(
      `/api/mail?folder=${encodeURIComponent(folder)}${
        mailbox ? `&mailbox=${encodeURIComponent(mailbox)}`
          : domain ? `&domain=${encodeURIComponent(domain)}`
            : ""
      }`,
      { signal },
    ),
  message: (id: string, signal?: AbortSignal) => req<{ message: MailFull; attachments: Attachment[] }>(`/api/mail/${id}`, { signal }),
  thread: (id: string, signal?: AbortSignal) =>
    req<{ thread_id: string; messages: MailSummary[] }>(`/api/mail/${id}/thread`, { signal }),
  move: (id: string, folder: string) =>
    req<{ ok: boolean }>(`/api/mail/${id}/move`, { method: "POST", body: JSON.stringify({ folder }) }),
  flags: (id: string, flags: { unread?: boolean; starred?: boolean; snooze_until?: number | null }) =>
    req<{ ok: boolean }>(`/api/mail/${id}/flags`, { method: "POST", body: JSON.stringify(flags) }),
  markFolderRead: (folder: string, mailbox?: string) =>
    req<{ ok: boolean; updated: number }>("/api/mail/mark-read", {
      method: "POST",
      body: JSON.stringify({ folder, mailbox: mailbox || undefined }),
    }),
  remove: (id: string) => req<{ ok: boolean }>(`/api/mail/${id}`, { method: "DELETE" }),
  send: (body: SendPayload) =>
    req<{ ok: boolean; id: string; draft?: boolean; scheduled?: boolean; undo?: boolean; scheduled_at?: number; undo_seconds?: number }>(
      "/api/mail/send",
      { method: "POST", body: JSON.stringify(body) },
    ),
  undoSend: (id: string) =>
    req<{ ok: boolean; draft?: boolean; id: string }>(`/api/mail/${id}/undo-send`, { method: "POST", body: "{}" }),
  labels: () => req<{ labels: Label[] }>("/api/labels"),
  createLabel: (name: string, color?: string) =>
    req<{ label: Label }>("/api/labels", { method: "POST", body: JSON.stringify({ name, color }) }),
  deleteLabel: (id: string) => req<{ ok: boolean }>(`/api/labels/${id}`, { method: "DELETE" }),
  addMessageLabel: (messageId: string, body: { label_id?: string; name?: string }) =>
    req<{ ok: boolean; label_id: string; name: string }>(`/api/mail/${messageId}/labels`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  removeMessageLabel: (messageId: string, labelId: string) =>
    req<{ ok: boolean }>(`/api/mail/${messageId}/labels/${labelId}`, { method: "DELETE" }),
  clearMessageLabel: (messageId: string) =>
    req<{ ok: boolean }>(`/api/mail/${messageId}/label`, { method: "DELETE" }),
  messageNotes: (messageId: string) => req<{ notes: MessageNote[] }>(`/api/mail/${messageId}/notes`),
  addMessageNote: (messageId: string, body: string) =>
    req<{ note: MessageNote }>(`/api/mail/${messageId}/notes`, { method: "POST", body: JSON.stringify({ body }) }),
  assignMessage: (messageId: string, user_id: string | null) =>
    req<{ ok: boolean; assignee_user_id: string | null }>(`/api/mail/${messageId}/assign`, {
      method: "POST",
      body: JSON.stringify({ user_id }),
    }),
  suppressions: () => req<{ suppressions: Suppression[] }>("/api/suppressions"),
  deleteSuppression: (id: string) => req<{ ok: boolean }>(`/api/suppressions/${id}`, { method: "DELETE" }),
  deliverability: () =>
    req<{
      domains: Domain[];
      suppressions_active: number;
      suppressions_by_reason: Record<string, number>;
      imap: { status: string; note: string };
    }>("/api/deliverability"),
  search: (q: string, signal?: AbortSignal) => req<{ q: string; messages: MailSummary[] }>(`/api/search?q=${encodeURIComponent(q)}`, { signal }),
  contacts: () => req<{ contacts: Contact[] }>("/api/contacts"),
  createContact: (email: string, name?: string) =>
    req<{ contact: Contact }>("/api/contacts", { method: "POST", body: JSON.stringify({ email, name }) }),
  deleteContact: (id: string) => req<{ ok: boolean }>(`/api/contacts/${id}`, { method: "DELETE" }),
  templates: () => req<{ templates: Template[] }>("/api/templates"),
  createTemplate: (body: { name: string; subject?: string; html_body?: string; text_body?: string }) =>
    req<{ template: Template }>("/api/templates", { method: "POST", body: JSON.stringify(body) }),
  updateTemplate: (id: string, body: { name: string; subject?: string; html_body?: string; text_body?: string }) =>
    req<{ ok: boolean }>(`/api/templates/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTemplate: (id: string) => req<{ ok: boolean }>(`/api/templates/${id}`, { method: "DELETE" }),
  signatures: () => req<{ signatures: Signature[] }>("/api/signatures"),
  createSignature: (body: { name: string; html_body?: string; text_body?: string; is_default?: boolean }) =>
    req<{ signature: Signature }>("/api/signatures", { method: "POST", body: JSON.stringify(body) }),
  updateSignature: (id: string, body: { name: string; html_body?: string; text_body?: string; is_default?: boolean }) =>
    req<{ ok: boolean }>(`/api/signatures/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteSignature: (id: string) => req<{ ok: boolean }>(`/api/signatures/${id}`, { method: "DELETE" }),
  filters: () => req<{ filters: Filter[] }>("/api/filters"),
  createFilter: (body: {
    name: string;
    match_from?: string;
    match_to?: string;
    match_subject?: string;
    action: string;
    forward_to?: string;
    label?: string;
    is_catch_all?: boolean;
  }) => req<{ filter: Filter }>("/api/filters", { method: "POST", body: JSON.stringify(body) }),
  toggleFilter: (id: string) => req<{ ok: boolean; enabled: number }>(`/api/filters/${id}/toggle`, { method: "POST" }),
  deleteFilter: (id: string) => req<{ ok: boolean }>(`/api/filters/${id}`, { method: "DELETE" }),
  blocked: () => req<{ blocked: BlockedSender[] }>("/api/blocked"),
  block: (address: string) => req<{ blocked: BlockedSender }>("/api/blocked", { method: "POST", body: JSON.stringify({ address }) }),
  unblock: (id: string) => req<{ ok: boolean }>(`/api/blocked/${id}`, { method: "DELETE" }),
  keys: () => req<{ keys: ApiKey[] }>("/api/keys"),
  createKey: (name: string) => req<{ key: ApiKey }>("/api/keys", { method: "POST", body: JSON.stringify({ name }) }),
  deleteKey: (id: string) => req<{ ok: boolean }>(`/api/keys/${id}`, { method: "DELETE" }),
  aliases: () => req<{ aliases: Alias[] }>("/api/aliases"),
  createAlias: (body: { mailbox_id: string; local_part: string; label?: string; disposable?: boolean; expires_at?: number | null }) =>
    req<{ alias: Alias }>("/api/aliases", { method: "POST", body: JSON.stringify(body) }),
  deleteAlias: (id: string) => req<{ ok: boolean }>(`/api/aliases/${id}`, { method: "DELETE" }),
  webhooks: () => req<{ webhooks: Webhook[] }>("/api/webhooks"),
  createWebhook: (body: { name?: string; url: string; events?: string }) =>
    req<{ webhook: Webhook }>("/api/webhooks", { method: "POST", body: JSON.stringify(body) }),
  toggleWebhook: (id: string) => req<{ ok: boolean; enabled: number }>(`/api/webhooks/${id}/toggle`, { method: "POST" }),
  deleteWebhook: (id: string) => req<{ ok: boolean }>(`/api/webhooks/${id}`, { method: "DELETE" }),
  webhookDeliveries: (id: string) =>
    req<{ deliveries: WebhookDelivery[] }>(`/api/webhooks/${id}/deliveries`),
  team: () => req<TeamResponse>("/api/team"),
  inviteTeam: (email: string, role?: string, mailbox_ids?: string[]) =>
    req<{ invite: TeamInvite; deferred: boolean }>("/api/team/invites", {
      method: "POST",
      body: JSON.stringify({ email, role, mailbox_ids }),
    }),
  revokeInvite: (id: string) => req<{ ok: boolean }>(`/api/team/invites/${id}`, { method: "DELETE" }),
  removeMember: (userId: string) => req<{ ok: boolean }>(`/api/team/members/${userId}`, { method: "DELETE" }),
  acceptInvite: (token: string) =>
    req<{ ok: boolean; workspace_id: string }>(`/api/team/invites/${token}/accept`, { method: "POST" }),
  invitePreview: (token: string) =>
    req<{ invite: { email: string; role: string; status: string; inviter_email?: string; expires_at?: number } }>(
      `/api/team/invites/${token}`,
    ),
  shareMailbox: (id: string, is_shared = true) =>
    req<{ ok: boolean }>(`/api/team/mailboxes/${id}/share`, {
      method: "POST",
      body: JSON.stringify({ is_shared }),
    }),
  grantMailboxMember: (mailboxId: string, user_id: string, role?: string) =>
    req<{ ok: boolean }>(`/api/team/mailboxes/${mailboxId}/members`, {
      method: "POST",
      body: JSON.stringify({ user_id, role }),
    }),
  revokeMailboxMember: (mailboxId: string, userId: string) =>
    req<{ ok: boolean }>(`/api/team/mailboxes/${mailboxId}/members/${userId}`, { method: "DELETE" }),
  authProviders: () => req<{ google: boolean; github: boolean }>("/api/auth/providers"),
  prefs: () => req<{ settings: Prefs }>("/api/settings/prefs"),
  savePrefs: (body: {
    vacation_enabled?: boolean;
    vacation_body?: string;
    notify_browser?: boolean;
    undo_send_seconds?: number;
  }) =>
    req<{ ok: boolean }>("/api/settings/prefs", { method: "PUT", body: JSON.stringify(body) }),
  exportBackup: async () => {
    const res = await fetch("/api/export", { credentials: "same-origin" });
    if (!res.ok) throw new Error("Could not export mailbox data.");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flap-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  },
  exportMbox: async () => {
    const res = await fetch("/api/export?format=mbox", { credentials: "same-origin" });
    if (!res.ok) throw new Error("Could not export mailbox as .mbox.");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flap-mailbox.mbox";
    a.click();
    URL.revokeObjectURL(url);
  },
  restoreBackup: (payload: unknown) =>
    req<{ ok: boolean; restored: number }>("/api/restore", { method: "POST", body: JSON.stringify(payload) }),
  referrals: () =>
    req<{
      code: string;
      link: string;
      domains_earned: number;
      successful_referrals: number;
      pending_referrals: number;
      reward_rule: string;
      history: Array<{
        id: string;
        status: string;
        reward_domains: number;
        created_at: number;
        referred_email: string;
      }>;
    }>("/api/referrals"),
  activation: () =>
    req<{
      steps: Record<string, boolean>;
      activated: boolean;
      onboarding_dismissed: boolean;
    }>("/api/activation"),
  dismissOnboarding: () => req<{ ok: boolean }>("/api/activation/dismiss-onboarding", { method: "POST" }),
  resendVerification: () =>
    req<{ ok: boolean; sent: boolean; message?: string; reason?: string }>("/api/account/resend-verification", {
      method: "POST",
      body: "{}",
    }),
  dnsStatus: (domainId: string) =>
    req<{
      domain: string;
      provider: string;
      mail_provider?: string;
      region?: string;
      lifecycle?: string;
      receiving?: {
        identity_verified: boolean;
        mx_configured: boolean;
        inbound_rule_active: boolean;
        receiving_ready: boolean;
      };
      sending?: {
        ses_sending: boolean;
        sending_ready: boolean;
      };
      mx_ok: boolean;
      spf_ok: boolean;
      verified: boolean;
      issues: string[];
      guide_path: string | null;
      records: { mx: string[]; spf: string[] };
      identity_status?: string;
      dkim_status?: string;
      error?: string;
    }>(`/api/domains/${domainId}/dns-status`),
};

export type DnsRecords = {
  provider?: string;
  note: string;
  mx: { type: string; name: string; priority: number; value: string }[];
  spf: { type: string; name: string; value: string };
  dkim: { type: string; name: string; value: string };
  dkim_records?: { type: string; name: string; value: string }[];
  verification?: { type: string; name: string; value: string }[];
  dmarc?: { type: string; name: string; value: string };
  worker_rule: string;
  send_note: string;
  region?: string;
};
