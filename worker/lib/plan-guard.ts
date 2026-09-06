import type { PlanId } from "./plans";
import { nowMs, randomId } from "./ids";

const PLAN_ORDER: PlanId[] = ["free", "solo", "pro", "team", "scale"];

export function planAtLeast(plan: PlanId, min: PlanId): boolean {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(min);
}

export async function writeAuditLog(
  db: D1Database,
  workspaceId: string,
  actorId: string,
  action: string,
  target = "",
  meta: Record<string, unknown> = {},
) {
  await db
    .prepare(
      "INSERT INTO audit_log (id, user_id, actor_user_id, action, target, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(randomId("aud"), workspaceId, actorId, action, target.slice(0, 200), JSON.stringify(meta).slice(0, 2000), nowMs())
    .run()
    .catch(() => undefined);
}

export type AppEnv = { Bindings: Env };
