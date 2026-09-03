export type User = { id: string; email: string; created_at?: number };
export type Mailbox = { id: string; domain_id?: string; local_part?: string; address: string; display_name?: string; created_at?: number; domain?: string };
export type Domain = { id: string; name: string; created_at: number };
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
  created_at: number;
};
export type MailFull = MailSummary & { text_body: string; html_body: string; in_reply_to?: string | null };
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
  enabled: number;
  created_at: number;
};
export type BlockedSender = { id: string; address: string; created_at: number };
export type ApiKey = { id: string; name: string; key_prefix: string; created_at: number; last_used_at: number | null; token?: string };
export type Prefs = { vacation_enabled: number; vacation_body: string };

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

export const api = {
  setupStatus: () => req<{ needs_setup: boolean }>("/api/setup/status"),
  setup: (email: string, password: string) =>
    req<{ ok: boolean; user: User }>("/api/setup", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    req<{ ok: boolean; user: User }>("/api/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => req<{ ok: boolean }>("/api/logout", { method: "POST" }),
  me: () => req<{ user: User; mailboxes: Mailbox[] }>("/api/me"),
  bootstrap: () =>
    req<{
      user: User;
      mailboxes: Mailbox[];
      signatures: Signature[];
      templates: Template[];
      contacts: Contact[];
      settings: Prefs;
      counts: FolderCounts;
      server_time: number;
    }>("/api/bootstrap"),
  counts: (signal?: AbortSignal) => req<{ counts: FolderCounts; server_time: number }>("/api/counts", { signal }),
  domains: () => req<{ domains: Domain[] }>("/api/domains"),
  createDomain: (name: string) =>
    req<{ domain: Domain }>("/api/domains", { method: "POST", body: JSON.stringify({ name }) }),
  deleteDomain: (id: string) => req<{ ok: boolean }>(`/api/domains/${id}`, { method: "DELETE" }),
  mailboxes: () => req<{ mailboxes: Mailbox[] }>("/api/mailboxes"),
  createMailbox: (domain_id: string, local_part: string) =>
    req<{ mailbox: Mailbox }>("/api/mailboxes", { method: "POST", body: JSON.stringify({ domain_id, local_part }) }),
  updateMailbox: (id: string, display_name: string) =>
    req<{ ok: boolean }>(`/api/mailboxes/${id}`, { method: "PATCH", body: JSON.stringify({ display_name }) }),
  deleteMailbox: (id: string) => req<{ ok: boolean }>(`/api/mailboxes/${id}`, { method: "DELETE" }),
  dns: (domain: string) => req<{ records: DnsRecords }>(`/api/dns?domain=${encodeURIComponent(domain)}`),
  mail: (folder: string, mailbox?: string, signal?: AbortSignal) =>
    req<{ folder: string; messages: MailSummary[] }>(
      `/api/mail?folder=${encodeURIComponent(folder)}${mailbox ? `&mailbox=${encodeURIComponent(mailbox)}` : ""}`,
      { signal },
    ),
  message: (id: string, signal?: AbortSignal) => req<{ message: MailFull; attachments: Attachment[] }>(`/api/mail/${id}`, { signal }),
  move: (id: string, folder: string) =>
    req<{ ok: boolean }>(`/api/mail/${id}/move`, { method: "POST", body: JSON.stringify({ folder }) }),
  flags: (id: string, flags: { unread?: boolean; starred?: boolean; snooze_until?: number | null }) =>
    req<{ ok: boolean }>(`/api/mail/${id}/flags`, { method: "POST", body: JSON.stringify(flags) }),
  remove: (id: string) => req<{ ok: boolean }>(`/api/mail/${id}`, { method: "DELETE" }),
  send: (body: SendPayload) =>
    req<{ ok: boolean; id: string; draft?: boolean; scheduled?: boolean }>(
      "/api/mail/send",
      { method: "POST", body: JSON.stringify(body) },
    ),
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
  createFilter: (body: { name: string; match_from?: string; match_to?: string; match_subject?: string; action: string }) =>
    req<{ filter: Filter }>("/api/filters", { method: "POST", body: JSON.stringify(body) }),
  toggleFilter: (id: string) => req<{ ok: boolean; enabled: number }>(`/api/filters/${id}/toggle`, { method: "POST" }),
  deleteFilter: (id: string) => req<{ ok: boolean }>(`/api/filters/${id}`, { method: "DELETE" }),
  blocked: () => req<{ blocked: BlockedSender[] }>("/api/blocked"),
  block: (address: string) => req<{ blocked: BlockedSender }>("/api/blocked", { method: "POST", body: JSON.stringify({ address }) }),
  unblock: (id: string) => req<{ ok: boolean }>(`/api/blocked/${id}`, { method: "DELETE" }),
  keys: () => req<{ keys: ApiKey[] }>("/api/keys"),
  createKey: (name: string) => req<{ key: ApiKey }>("/api/keys", { method: "POST", body: JSON.stringify({ name }) }),
  deleteKey: (id: string) => req<{ ok: boolean }>(`/api/keys/${id}`, { method: "DELETE" }),
  prefs: () => req<{ settings: Prefs }>("/api/settings/prefs"),
  savePrefs: (body: { vacation_enabled: boolean; vacation_body: string }) =>
    req<{ ok: boolean }>("/api/settings/prefs", { method: "PUT", body: JSON.stringify(body) }),
  exportBackup: async () => {
    const res = await fetch("/api/export", { credentials: "same-origin" });
    if (!res.ok) throw new Error("Could not export mailbox data.");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inlet-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  },
};

export type DnsRecords = {
  note: string;
  mx: { type: string; name: string; priority: number; value: string }[];
  spf: { type: string; name: string; value: string };
  dkim: { type: string; name: string; value: string };
  worker_rule: string;
  send_note: string;
};
