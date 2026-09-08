/**
 * Posts operator / security alerts to existing Slack/Discord notify_channels.
 * Does not add a new vendor. Workspace-wide channels (no mailbox/domain filter) receive ops events.
 */
export type OperatorAlertKind =
  | "member_removed"
  | "scheduled_denied"
  | "invite_flood"
  | "authz_denied";

export type NotifyPoster = (url: string, body: string, contentType: string) => Promise<void>;

export function formatOperatorAlert(kind: OperatorAlertKind, detail: string): string {
  return `[Flap] ${kind}: ${detail}`.slice(0, 500);
}

export function slackOrDiscordBody(kind: "slack" | "discord", text: string): { body: string; contentType: string } {
  if (kind === "discord") {
    return { body: JSON.stringify({ content: text }), contentType: "application/json" };
  }
  return { body: JSON.stringify({ text }), contentType: "application/json" };
}

export async function postWorkspaceOperatorAlert(
  db: D1Database,
  workspaceId: string,
  kind: OperatorAlertKind,
  detail: string,
  poster?: NotifyPoster,
): Promise<number> {
  const text = formatOperatorAlert(kind, detail);
  const rows = await db
    .prepare(
      `SELECT webhook_url, kind FROM notify_channels
       WHERE user_id = ? AND COALESCE(muted, 0) = 0
         AND (domain_id IS NULL OR domain_id = '')
         AND (mailbox_id IS NULL OR mailbox_id = '')`,
    )
    .bind(workspaceId)
    .all<{ webhook_url: string; kind: string }>()
    .catch(() => ({ results: [] as { webhook_url: string; kind: string }[] }));

  const post =
    poster ??
    (async (url: string, body: string, contentType: string) => {
      await fetch(url, { method: "POST", headers: { "content-type": contentType }, body });
    });

  let sent = 0;
  for (const row of rows.results ?? []) {
    const channel = row.kind === "discord" ? "discord" : "slack";
    const payload = slackOrDiscordBody(channel, text);
    try {
      await post(row.webhook_url, payload.body, payload.contentType);
      sent += 1;
    } catch (err) {
      console.warn("notify_channels operator alert failed", workspaceId, err);
    }
  }
  return sent;
}
