import { nowMs } from "./ids";

/**
 * True when the address is suppressed for this workspace.
 * Product rule: suppressions are workspace-scoped (mail_suppressions.user_id), not SES-global.
 * Unattributed rows (empty user_id) never block sends.
 */
export async function isAddressSuppressed(
  db: D1Database,
  userId: string,
  email: string,
): Promise<boolean> {
  if (!userId) return false;
  const row = await db
    .prepare(
      `SELECT id FROM mail_suppressions
       WHERE user_id = ? AND email = ? AND (expires_at IS NULL OR expires_at > ?)`,
    )
    .bind(userId, email.toLowerCase(), nowMs())
    .first();
  return Boolean(row);
}
