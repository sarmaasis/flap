export type User = { id: string; email: string; created_at?: number };
export type Mailbox = { id: string; domain_id?: string; local_part?: string; address: string; created_at?: number; domain?: string };
export type Domain = { id: string; name: string; created_at: number };
export type MailSummary = {
  id: string;
  mailbox_id: string | null;
  folder: string;
  from_addr: string;
  to_addr: string;
  subject: string;
  date_ms: number;
  has_attachments: number;
  unread: number;
  created_at: number;
};
export type MailFull = MailSummary & { text_body: string; html_body: string };
export type Attachment = { id: string; filename: string; content_type: string; size: number };

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  setupStatus: () => req<{ needs_setup: boolean }>("/api/setup/status"),
  setup: (email: string, password: string) =>
    req<{ ok: boolean; user: User }>("/api/setup", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    req<{ ok: boolean; user: User }>("/api/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => req<{ ok: boolean }>("/api/logout", { method: "POST" }),
  me: () => req<{ user: User; mailboxes: Mailbox[] }>("/api/me"),
  domains: () => req<{ domains: Domain[] }>("/api/domains"),
  createDomain: (name: string) =>
    req<{ domain: Domain }>("/api/domains", { method: "POST", body: JSON.stringify({ name }) }),
  deleteDomain: (id: string) => req<{ ok: boolean }>(`/api/domains/${id}`, { method: "DELETE" }),
  mailboxes: () => req<{ mailboxes: Mailbox[] }>("/api/mailboxes"),
  createMailbox: (domain_id: string, local_part: string) =>
    req<{ mailbox: Mailbox }>("/api/mailboxes", { method: "POST", body: JSON.stringify({ domain_id, local_part }) }),
  deleteMailbox: (id: string) => req<{ ok: boolean }>(`/api/mailboxes/${id}`, { method: "DELETE" }),
  dns: (domain: string) => req<{ records: DnsRecords }>(`/api/dns?domain=${encodeURIComponent(domain)}`),
  mail: (folder: string, mailbox?: string) =>
    req<{ folder: string; messages: MailSummary[] }>(
      `/api/mail?folder=${encodeURIComponent(folder)}${mailbox ? `&mailbox=${encodeURIComponent(mailbox)}` : ""}`,
    ),
  message: (id: string) => req<{ message: MailFull; attachments: Attachment[] }>(`/api/mail/${id}`),
  move: (id: string, folder: string) =>
    req<{ ok: boolean }>(`/api/mail/${id}/move`, { method: "POST", body: JSON.stringify({ folder }) }),
  send: (body: { to: string; subject: string; text: string; html?: string; from?: string; draft?: boolean }) =>
    req<{ ok: boolean; id: string; draft?: boolean }>("/api/mail/send", { method: "POST", body: JSON.stringify(body) }),
  search: (q: string) => req<{ q: string; messages: MailSummary[] }>(`/api/search?q=${encodeURIComponent(q)}`),
};

export type DnsRecords = {
  note: string;
  mx: { type: string; name: string; priority: number; value: string }[];
  spf: { type: string; name: string; value: string };
  dkim: { type: string; name: string; value: string };
  worker_rule: string;
  send_note: string;
};
