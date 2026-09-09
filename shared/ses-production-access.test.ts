/**
 * SES production-access wave: outbound policy, events, tenancy, unsubscribe.
 * Run: npx tsx shared/ses-production-access.test.ts
 */
import { MemoryD1Database } from "./d1-memory.ts";
import {
  evaluateOutboundDomainPolicy,
  evaluateOutboundSenderIdentity,
  evaluateOutboundWorkspacePolicy,
  publicDomainLifecycle,
} from "./outbound-send-policy.ts";
import {
  classifySesEventType,
  deliveryEventIdempotencyKey,
  humanDeliveryStatus,
  shouldUnsubscribeNewsletter,
} from "./ses-delivery-events.ts";
import { domainIsSendingReady } from "./ses-dns.ts";
import { processSesConfigurationEvent } from "../worker/lib/ses-delivery.ts";
import { isAddressSuppressed } from "../worker/lib/suppressions.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const readyRow = {
  mail_provider: "ses",
  provider_state: "ACTIVE",
  identity_verified_at: 1,
  mx_verified_at: 1,
  inbound_rule_ready_at: 1,
  receiving_ready_at: 1,
  sending_ready_at: 1,
};

{
  assert(!domainIsSendingReady({ ...readyRow, sending_ready_at: null, mail_provider: "ses" }), "domain cannot send before verification");
  assert(evaluateOutboundDomainPolicy("example.com", { ...readyRow, sending_ready_at: null })?.code === "not_sending_ready", "unverified domain blocked");
  assert(evaluateOutboundDomainPolicy("foreign.com", null)?.code === "missing_domain", "foreign domain sender rejected");
  assert(evaluateOutboundSenderIdentity("a@a.com", "b@a.com")?.code === "sender_not_authorized", "foreign mailbox sender rejected");
  assert(evaluateOutboundSenderIdentity("hello@a.com", "hello@a.com") === null, "own mailbox allowed");
  assert(evaluateOutboundWorkspacePolicy({ send_status: "SUSPENDED" })?.code === "workspace_suspended", "suspended workspace cannot send");
  assert(
    evaluateOutboundDomainPolicy("a.com", { ...readyRow, provider_state: "SUSPENDED" })?.code === "domain_suspended",
    "suspended domain cannot send",
  );
  assert(evaluateOutboundWorkspacePolicy({ outbound_access_status: "APPROVED", send_status: "ACTIVE" }) === null, "approved workspace can send");
  assert(evaluateOutboundWorkspacePolicy({ outbound_access_status: "PENDING" })?.code === "outbound_pending", "pending outbound blocked");
  assert(publicDomainLifecycle({ ...readyRow, sending_ready_at: null, receiving_ready_at: null, identity_verified_at: 1 }) === "VERIFIED", "verified lifecycle");
  assert(publicDomainLifecycle({ ...readyRow }) === "OUTBOUND_READY", "outbound ready lifecycle");
  assert(classifySesEventType("Bounce", "Permanent") === "bounce", "hard bounce kind");
  assert(classifySesEventType("Bounce", "Transient") === "soft_bounce", "soft bounce kind");
  assert(classifySesEventType("Complaint") === "complaint", "complaint kind");
  assert(classifySesEventType("Delivery") === "delivery", "delivery kind");
  assert(classifySesEventType("Send") === "send", "send kind");
  assert(classifySesEventType("Reject") === "reject", "reject kind");
  assert(humanDeliveryStatus("bounce") === "Bounced", "human bounce");
  assert(shouldUnsubscribeNewsletter("bounce"), "hard bounce unsubscribes newsletter");
  assert(!shouldUnsubscribeNewsletter("soft_bounce"), "soft bounce does not unsubscribe");
  assert(
    deliveryEventIdempotencyKey("m1", "A@B.com", "bounce") === "m1|a@b.com|bounce",
    "idempotency key",
  );
}

function schema(db: MemoryD1Database) {
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      send_status TEXT NOT NULL DEFAULT 'ACTIVE',
      outbound_access_status TEXT NOT NULL DEFAULT 'APPROVED',
      reputation_warning_at INTEGER
    );
    CREATE TABLE domains (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mail_provider TEXT,
      provider_state TEXT,
      identity_verified_at INTEGER,
      mx_verified_at INTEGER,
      inbound_rule_ready_at INTEGER,
      receiving_ready_at INTEGER,
      sending_ready_at INTEGER
    );
    CREATE TABLE mailboxes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      domain_id TEXT NOT NULL,
      address TEXT NOT NULL
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mailbox_id TEXT,
      provider_message_id TEXT,
      folder TEXT
    );
    CREATE TABLE mail_suppressions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      source TEXT,
      provider_message_id TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER
    );
    CREATE TABLE delivery_event_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '',
      domain_id TEXT NOT NULL DEFAULT '',
      recipient_email TEXT NOT NULL,
      kind TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT '',
      provider_message_id TEXT NOT NULL DEFAULT '',
      meta_json TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE deliverability_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      domain_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      count INTEGER NOT NULL,
      day TEXT NOT NULL,
      meta_json TEXT NOT NULL DEFAULT '',
      UNIQUE(domain_id, kind, day)
    );
    CREATE TABLE newsletter_subscribers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      unsubscribed_at INTEGER
    );
  `);
}

async function seedPair(db: MemoryD1Database) {
  const now = Date.now();
  await db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").bind("ws_a", "a@flap.test").run();
  await db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").bind("ws_b", "b@flap.test").run();
  await db.prepare(
    "INSERT INTO domains (id, user_id, name, mail_provider, provider_state, sending_ready_at) VALUES (?, ?, ?, 'ses', 'ACTIVE', ?)",
  )
    .bind("dom_a", "ws_a", "a.com", now)
    .run();
  await db.prepare(
    "INSERT INTO domains (id, user_id, name, mail_provider, provider_state, sending_ready_at) VALUES (?, ?, ?, 'ses', 'ACTIVE', ?)",
  )
    .bind("dom_b", "ws_b", "b.com", now)
    .run();
  await db.prepare("INSERT INTO mailboxes (id, user_id, domain_id, address) VALUES (?, ?, ?, ?)")
    .bind("mb_a", "ws_a", "dom_a", "hello@a.com")
    .run();
  await db.prepare("INSERT INTO messages (id, user_id, mailbox_id, provider_message_id, folder) VALUES (?, ?, ?, ?, 'sent')")
    .bind("msg_a", "ws_a", "mb_a", "ses-mid-a")
    .run();
  await db.prepare("INSERT INTO newsletter_subscribers (id, user_id, email, status) VALUES (?, ?, ?, 'active')")
    .bind("sub_a", "ws_a", "r@example.com")
    .run();
  await db.prepare("INSERT INTO newsletter_subscribers (id, user_id, email, status) VALUES (?, ?, ?, 'active')")
    .bind("sub_b", "ws_b", "r@example.com")
    .run();
}

async function main() {
  const db = new MemoryD1Database();
  schema(db);
  await seedPair(db);

  const bounce = await processSesConfigurationEvent(db as unknown as D1Database, {
    notificationType: "Bounce",
    mail: { messageId: "ses-mid-a", destination: ["r@example.com"] },
    bounce: { bounceType: "Permanent", bouncedRecipients: [{ emailAddress: "r@example.com" }] },
  });
  assert(bounce.processed === 1, "hard bounce creates expected state");
  assert(await isAddressSuppressed(db as unknown as D1Database, "ws_a", "r@example.com"), "suppressed recipient cannot send");
  assert(!(await isAddressSuppressed(db as unknown as D1Database, "ws_b", "r@example.com")), "unrelated workspace unaffected by bounce");

  const subA = await db.prepare("SELECT status FROM newsletter_subscribers WHERE id = 'sub_a'").first<{ status: string }>();
  const subB = await db.prepare("SELECT status FROM newsletter_subscribers WHERE id = 'sub_b'").first<{ status: string }>();
  assert(subA?.status === "unsubscribed", "newsletter unsubscribe enforced for attributed workspace");
  assert(subB?.status === "active", "foreign newsletter list unchanged");

  const dup = await processSesConfigurationEvent(db as unknown as D1Database, {
    notificationType: "Bounce",
    mail: { messageId: "ses-mid-a", destination: ["r@example.com"] },
    bounce: { bounceType: "Permanent", bouncedRecipients: [{ emailAddress: "r@example.com" }] },
  });
  assert(dup.skipped_duplicate === 1, "duplicate provider event idempotent");

  const complaint = await processSesConfigurationEvent(db as unknown as D1Database, {
    eventType: "Complaint",
    mail: { messageId: "ses-mid-a" },
    complaint: { complainedRecipients: [{ emailAddress: "hate@example.com" }] },
  });
  assert(complaint.processed === 1, "complaint creates expected state");
  assert(await isAddressSuppressed(db as unknown as D1Database, "ws_a", "hate@example.com"), "complaint suppresses owner only");
  assert(!(await isAddressSuppressed(db as unknown as D1Database, "ws_b", "hate@example.com")), "complaint does not leak");

  const delivery = await processSesConfigurationEvent(db as unknown as D1Database, {
    eventType: "Delivery",
    mail: { messageId: "ses-mid-a", destination: ["ok@example.com"] },
  });
  assert(delivery.processed === 1, "delivery event recorded");

  const orphan = await processSesConfigurationEvent(db as unknown as D1Database, {
    notificationType: "Bounce",
    mail: { messageId: "unknown-mid" },
    bounce: { bounceType: "Permanent", bouncedRecipients: [{ emailAddress: "ghost@example.com" }] },
  });
  assert(orphan.unattributed >= 1, "unattributed bounce skips workspace suppression");
  assert(!(await isAddressSuppressed(db as unknown as D1Database, "ws_a", "ghost@example.com")), "orphan bounce not workspace-suppressed");

  assert(
    evaluateOutboundDomainPolicy("a.com", { ...readyRow, provider_state: "SUSPENDED" })?.code === "domain_suspended",
    "scheduled send rechecks domain suspension",
  );
  assert(
    evaluateOutboundWorkspacePolicy({ send_status: "SUSPENDED" })?.code === "workspace_suspended",
    "scheduled send rechecks workspace suspension",
  );

  console.log("ses-production-access.test.ts ok");
}

await main();
