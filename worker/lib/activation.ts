import { nowMs } from "./ids";
import { maybeQualifyReferral } from "./referrals";
import { trackOncePerUser, trackServerEvent } from "./analytics";

export async function markFirstEmailReceived(db: D1Database, userId: string): Promise<void> {
  const before = await db
    .prepare("SELECT first_email_received_at, activated_at FROM users WHERE id = ?")
    .bind(userId)
    .first<{ first_email_received_at: number | null; activated_at: number | null }>();
  const now = nowMs();
  await db
    .prepare(
      `UPDATE users SET
         first_email_received_at = COALESCE(first_email_received_at, ?),
         activated_at = CASE
           WHEN activated_at IS NOT NULL THEN activated_at
           WHEN first_email_sent_at IS NOT NULL THEN ?
           ELSE activated_at
         END
       WHERE id = ?`,
    )
    .bind(now, now, userId)
    .run();

  if (!before?.first_email_received_at) {
    await trackOncePerUser(db, userId, "first_email_received");
    await trackOncePerUser(db, userId, "first_inbound_received");
  }
  await maybeEmitActivated(db, userId, before?.activated_at ?? null);
}

export async function markFirstEmailSent(db: D1Database, userId: string): Promise<void> {
  const before = await db
    .prepare("SELECT first_email_sent_at, activated_at FROM users WHERE id = ?")
    .bind(userId)
    .first<{ first_email_sent_at: number | null; activated_at: number | null }>();
  const now = nowMs();
  await db
    .prepare(
      `UPDATE users SET
         first_email_sent_at = COALESCE(first_email_sent_at, ?),
         activated_at = CASE
           WHEN activated_at IS NOT NULL THEN activated_at
           WHEN first_email_received_at IS NOT NULL THEN ?
           ELSE activated_at
         END
       WHERE id = ?`,
    )
    .bind(now, now, userId)
    .run();

  if (!before?.first_email_sent_at) {
    await trackOncePerUser(db, userId, "first_email_sent");
    await trackOncePerUser(db, userId, "first_outbound_sent");
  }
  await maybeEmitActivated(db, userId, before?.activated_at ?? null);
}

async function maybeEmitActivated(
  db: D1Database,
  userId: string,
  previousActivatedAt: number | null,
): Promise<void> {
  if (previousActivatedAt) return;
  const after = await db
    .prepare("SELECT activated_at FROM users WHERE id = ?")
    .bind(userId)
    .first<{ activated_at: number | null }>();
  if (after?.activated_at) {
    await trackOncePerUser(db, userId, "user_activated");
  }
}

export async function getActivationState(db: D1Database, userId: string) {
  const user = await db
    .prepare(
      `SELECT email_verified_at, first_email_received_at, first_email_sent_at, activated_at, onboarding_dismissed
       FROM users WHERE id = ?`,
    )
    .bind(userId)
    .first<{
      email_verified_at: number | null;
      first_email_received_at: number | null;
      first_email_sent_at: number | null;
      activated_at: number | null;
      onboarding_dismissed: number;
    }>();

  const [domains, mailboxes] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM domains WHERE user_id = ?").bind(userId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM mailboxes WHERE user_id = ?").bind(userId).first<{ n: number }>(),
  ]);

  const hasDomain = Number(domains?.n ?? 0) > 0;
  const hasMailbox = Number(mailboxes?.n ?? 0) > 0;
  const hasReceived = Boolean(user?.first_email_received_at);
  const hasSent = Boolean(user?.first_email_sent_at);
  const activated = Boolean(user?.activated_at) || (hasDomain && (hasReceived || hasSent));

  return {
    steps: {
      account_created: true,
      email_verified: Boolean(user?.email_verified_at),
      domain_added: hasDomain,
      address_created: hasMailbox,
      first_email_received: hasReceived,
      first_email_sent: hasSent,
      activated,
    },
    activated,
    onboarding_dismissed: Boolean(user?.onboarding_dismissed),
    first_email_received_at: user?.first_email_received_at ?? null,
    first_email_sent_at: user?.first_email_sent_at ?? null,
    activated_at: user?.activated_at ?? null,
  };
}

export async function afterDomainAdded(db: D1Database, userId: string): Promise<void> {
  await maybeQualifyReferral(db, userId);
  await trackServerEvent(db, "domain_added", { userId });
  const count = await db
    .prepare("SELECT COUNT(*) AS n FROM domains WHERE user_id = ?")
    .bind(userId)
    .first<{ n: number }>();
  if (Number(count?.n ?? 0) === 2) {
    await trackOncePerUser(db, userId, "second_domain_added");
  }
}

/** Called when authenticated DNS check reports MX+SPF ready. */
export async function afterDnsVerified(db: D1Database, userId: string, domain: string): Promise<void> {
  await trackOncePerUser(db, userId, "dns_verified", { domain });
  await trackOncePerUser(db, userId, "domain_verified", { domain });
  await maybeQualifyReferral(db, userId);
}
