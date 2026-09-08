/**
 * Agency workspace fixture for P0 security tests (in-memory D1).
 */
import { MemoryD1Database } from "./d1-memory.ts";

export type AgencyFixture = {
  db: MemoryD1Database;
  ownerA: string;
  adminA: string;
  memberA1: string;
  memberA2: string;
  removedA3: string;
  ownerB: string;
  wsA: string;
  wsB: string;
  domainAgency: string;
  domainClientA: string;
  domainClientB: string;
  domainForeign: string;
  mbAgency: string;
  mbClientA: string;
  mbClientB: string;
  mbForeign: string;
  msgClientA: string;
  msgClientB: string;
  msgForeign: string;
  attClientB: string;
  keyA: string;
  hookA: string;
  now: number;
};

export function applyAgencySchema(db: MemoryD1Database): void {
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      referral_bonus_domains INTEGER NOT NULL DEFAULT 0,
      clerk_user_id TEXT
    );
    CREATE TABLE workspace_members (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      invited_by TEXT,
      accepted_at INTEGER,
      removed_at INTEGER,
      PRIMARY KEY (workspace_id, user_id)
    );
    CREATE TABLE mailbox_members (
      mailbox_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (mailbox_id, user_id)
    );
    CREATE TABLE workspace_member_domains (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      domain_id TEXT NOT NULL,
      permission_level TEXT NOT NULL DEFAULT 'send',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (workspace_id, user_id, domain_id)
    );
    CREATE TABLE workspace_invites (
      id TEXT PRIMARY KEY,
      invited_by TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      token TEXT,
      token_hash TEXT,
      workspace_id TEXT,
      expires_at INTEGER,
      mailbox_ids TEXT NOT NULL DEFAULT '[]',
      domain_ids TEXT NOT NULL DEFAULT '[]',
      accepted_by TEXT,
      accepted_at INTEGER,
      revoked_at INTEGER
    );
    CREATE TABLE domains (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      client_id TEXT,
      sending_ready_at INTEGER,
      identity_verified_at INTEGER,
      mx_verified_at INTEGER,
      inbound_rule_ready_at INTEGER,
      receiving_ready_at INTEGER,
      provider_state TEXT
    );
    CREATE TABLE mailboxes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      domain_id TEXT NOT NULL,
      local_part TEXT NOT NULL,
      address TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL DEFAULT '',
      is_shared INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mailbox_id TEXT,
      folder TEXT NOT NULL DEFAULT 'inbox',
      from_addr TEXT NOT NULL DEFAULT '',
      to_addr TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      text_body TEXT NOT NULL DEFAULT '',
      html_body TEXT NOT NULL DEFAULT '',
      thread_id TEXT,
      date_ms INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      scheduled_at INTEGER,
      scheduled_by_user_id TEXT,
      snippet TEXT NOT NULL DEFAULT '',
      has_attachments INTEGER NOT NULL DEFAULT 0,
      unread INTEGER NOT NULL DEFAULT 0,
      starred INTEGER NOT NULL DEFAULT 0,
      label TEXT NOT NULL DEFAULT '',
      rfc_message_id TEXT NOT NULL DEFAULT '',
      cc_addr TEXT NOT NULL DEFAULT '',
      bcc_addr TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      r2_key TEXT NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      size INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      last_used_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX idx_contacts_user_email ON contacts (user_id, email);
    CREATE TABLE templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      html_body TEXT NOT NULL DEFAULT '',
      text_body TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE signatures (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      html_body TEXT NOT NULL DEFAULT '',
      text_body TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE filters (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      match_from TEXT NOT NULL DEFAULT '',
      match_to TEXT NOT NULL DEFAULT '',
      match_subject TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      forward_to TEXT NOT NULL DEFAULT '',
      label TEXT NOT NULL DEFAULT '',
      is_catch_all INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE aliases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      label TEXT NOT NULL DEFAULT '',
      disposable INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER
    );
    CREATE TABLE notify_channels (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      webhook_url TEXT NOT NULL,
      domain_id TEXT,
      mailbox_id TEXT,
      muted INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      created_by_user_id TEXT
    );
    CREATE TABLE webhooks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      secret TEXT NOT NULL DEFAULT '',
      events TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      created_by_user_id TEXT
    );
    CREATE TABLE audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT '',
      meta_json TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE thread_presence (
      thread_key TEXT NOT NULL,
      workspace_id TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      last_seen_at INTEGER NOT NULL,
      PRIMARY KEY (thread_key, user_id)
    );
    CREATE TABLE clients (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE mail_suppressions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE delivery_event_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '',
      domain_id TEXT NOT NULL DEFAULT '',
      recipient_email TEXT NOT NULL,
      kind TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
}

async function addUser(db: MemoryD1Database, id: string, email: string, now: number) {
  await db.prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)").bind(id, email, now).run();
}

export async function seedAgencyFixture(): Promise<AgencyFixture> {
  const db = new MemoryD1Database();
  applyAgencySchema(db);
  const now = Date.now();
  const f: AgencyFixture = {
    db,
    ownerA: "user_owner_a",
    adminA: "user_admin_a",
    memberA1: "user_a1",
    memberA2: "user_a2",
    removedA3: "user_a3",
    ownerB: "user_owner_b",
    wsA: "user_owner_a",
    wsB: "user_owner_b",
    domainAgency: "dom_agency",
    domainClientA: "dom_client_a",
    domainClientB: "dom_client_b",
    domainForeign: "dom_b",
    mbAgency: "mb_agency",
    mbClientA: "mb_client_a",
    mbClientB: "mb_client_b",
    mbForeign: "mb_b",
    msgClientA: "msg_client_a",
    msgClientB: "msg_client_b",
    msgForeign: "msg_b",
    attClientB: "att_client_b",
    keyA: "key_a",
    hookA: "hook_a",
    now,
  };

  for (const [id, email] of [
    [f.ownerA, "owner-a@agency.test"],
    [f.adminA, "admin-a@agency.test"],
    [f.memberA1, "a1@agency.test"],
    [f.memberA2, "a2@agency.test"],
    [f.removedA3, "a3@agency.test"],
    [f.ownerB, "owner-b@other.test"],
  ] as const) {
    await addUser(db, id, email, now);
  }

  await db.prepare("INSERT INTO subscriptions (id, user_id, plan_id, status, created_at, updated_at) VALUES ('sub_a', ?, 'team', 'active', ?, ?)").bind(f.wsA, now, now).run();
  await db.prepare("INSERT INTO subscriptions (id, user_id, plan_id, status, created_at, updated_at) VALUES ('sub_b', ?, 'team', 'active', ?, ?)").bind(f.wsB, now, now).run();

  const members: Array<[string, string, string]> = [
    [f.wsA, f.ownerA, "owner"],
    [f.wsA, f.adminA, "admin"],
    [f.wsA, f.memberA1, "member"],
    [f.wsA, f.memberA2, "member"],
    [f.wsB, f.ownerB, "owner"],
  ];
  for (const [ws, user, role] of members) {
    await db
      .prepare("INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)")
      .bind(ws, user, role, now)
      .run();
  }

  await db.prepare("INSERT INTO domains (id, user_id, name, created_at, sending_ready_at) VALUES (?, ?, 'agency.com', ?, ?)").bind(f.domainAgency, f.wsA, now, now).run();
  await db.prepare("INSERT INTO domains (id, user_id, name, created_at, sending_ready_at) VALUES (?, ?, 'client-a.com', ?, ?)").bind(f.domainClientA, f.wsA, now, now).run();
  await db.prepare("INSERT INTO domains (id, user_id, name, created_at, sending_ready_at) VALUES (?, ?, 'client-b.com', ?, ?)").bind(f.domainClientB, f.wsA, now, now).run();
  await db.prepare("INSERT INTO domains (id, user_id, name, created_at, sending_ready_at) VALUES (?, ?, 'b.example.com', ?, ?)").bind(f.domainForeign, f.wsB, now, now).run();

  await db.prepare("INSERT INTO mailboxes (id, user_id, domain_id, local_part, address, is_shared, created_at) VALUES (?, ?, ?, 'hello', 'hello@agency.com', 1, ?)").bind(f.mbAgency, f.wsA, f.domainAgency, now).run();
  await db.prepare("INSERT INTO mailboxes (id, user_id, domain_id, local_part, address, is_shared, created_at) VALUES (?, ?, ?, 'hello', 'hello@client-a.com', 1, ?)").bind(f.mbClientA, f.wsA, f.domainClientA, now).run();
  await db.prepare("INSERT INTO mailboxes (id, user_id, domain_id, local_part, address, is_shared, created_at) VALUES (?, ?, ?, 'support', 'support@client-b.com', 1, ?)").bind(f.mbClientB, f.wsA, f.domainClientB, now).run();
  await db.prepare("INSERT INTO mailboxes (id, user_id, domain_id, local_part, address, is_shared, created_at) VALUES (?, ?, ?, 'hello', 'hello@b.example.com', 0, ?)").bind(f.mbForeign, f.wsB, f.domainForeign, now).run();

  await db.prepare("INSERT INTO workspace_member_domains (workspace_id, user_id, domain_id, permission_level, created_at) VALUES (?, ?, ?, 'send', ?)").bind(f.wsA, f.memberA1, f.domainClientA, now).run();
  await db.prepare("INSERT INTO mailbox_members (mailbox_id, user_id, role, created_at) VALUES (?, ?, 'member', ?)").bind(f.mbClientB, f.memberA2, now).run();

  await db.prepare(
    `INSERT INTO messages (id, user_id, mailbox_id, folder, from_addr, to_addr, subject, text_body, thread_id, date_ms, created_at)
     VALUES (?, ?, ?, 'inbox', 'ext@example.com', 'hello@client-a.com', 'Secret A1', 'SECRET A1 BODY', ?, ?, ?)`,
  ).bind(f.msgClientA, f.wsA, f.mbClientA, f.msgClientA, now, now).run();
  await db.prepare(
    `INSERT INTO messages (id, user_id, mailbox_id, folder, from_addr, to_addr, subject, text_body, thread_id, date_ms, created_at)
     VALUES (?, ?, ?, 'inbox', 'ext@example.com', 'support@client-b.com', 'Secret A2', 'SECRET A2 BODY', ?, ?, ?)`,
  ).bind(f.msgClientB, f.wsA, f.mbClientB, f.msgClientB, now, now).run();
  await db.prepare(
    `INSERT INTO messages (id, user_id, mailbox_id, folder, from_addr, to_addr, subject, text_body, thread_id, date_ms, created_at)
     VALUES (?, ?, ?, 'inbox', 'ext@example.com', 'hello@b.example.com', 'Secret B', 'SECRET B BODY', ?, ?, ?)`,
  ).bind(f.msgForeign, f.wsB, f.mbForeign, f.msgForeign, now, now).run();
  await db.prepare("INSERT INTO attachments (id, message_id, r2_key, filename, size, created_at) VALUES (?, ?, 'r2/b', 'secret.pdf', 12, ?)").bind(f.attClientB, f.msgClientB, now).run();

  await db.prepare("INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, created_at, created_by_user_id) VALUES (?, ?, 'ws', 'hash_a', 'flap_xxxx', ?, ?)").bind(f.keyA, f.wsA, now, f.ownerA).run();
  await db.prepare("INSERT INTO webhooks (id, user_id, name, url, secret, events, created_at, created_by_user_id) VALUES (?, ?, 'hook', 'https://example.com/a', 'sec', '[]', ?, ?)").bind(f.hookA, f.wsA, now, f.ownerA).run();
  await db.prepare("INSERT INTO contacts (id, user_id, email, name, last_used_at, created_at) VALUES ('ct_a', ?, 'friend@client-a.com', 'Friend', ?, ?)").bind(f.wsA, now, now).run();
  await db.prepare("INSERT INTO delivery_event_log (id, user_id, domain_id, recipient_email, kind, created_at) VALUES ('del_a', ?, ?, 'x@client-a.com', 'bounce', ?)").bind(f.wsA, f.domainClientA, now).run();
  await db.prepare("INSERT INTO delivery_event_log (id, user_id, domain_id, recipient_email, kind, created_at) VALUES ('del_bdom', ?, ?, 'x@client-b.com', 'bounce', ?)").bind(f.wsA, f.domainClientB, now).run();

  return f;
}
