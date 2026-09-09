import { evaluateOutboundWorkspacePolicy } from "../../shared/outbound-send-policy";

export async function workspaceSendDenied(
  db: D1Database,
  workspaceId: string,
): Promise<string | null> {
  const row = await db
    .prepare("SELECT send_status, outbound_access_status FROM users WHERE id = ?")
    .bind(workspaceId)
    .first<{ send_status: string | null; outbound_access_status: string | null }>()
    .catch(() => null);
  return evaluateOutboundWorkspacePolicy(row)?.message ?? null;
}

export function parseOperatorToken(header: string | undefined, expected: string | undefined): boolean {
  const want = (expected || "").trim();
  if (!want) return false;
  const raw = (header || "").trim();
  const token = raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : raw;
  return token.length > 0 && token === want;
}

const ACCESS = new Set(["PENDING", "APPROVED", "RESTRICTED", "SUSPENDED"]);
const SEND = new Set(["ACTIVE", "SEND_RESTRICTED", "SUSPENDED"]);

export function normalizeOperatorSendPatch(body: {
  outbound_access_status?: string;
  send_status?: string;
}): { outbound_access_status?: string; send_status?: string } | { error: string } {
  const out: { outbound_access_status?: string; send_status?: string } = {};
  if (body.outbound_access_status != null) {
    const v = String(body.outbound_access_status).toUpperCase();
    if (!ACCESS.has(v)) return { error: "Invalid outbound_access_status." };
    out.outbound_access_status = v;
  }
  if (body.send_status != null) {
    const v = String(body.send_status).toUpperCase();
    if (!SEND.has(v)) return { error: "Invalid send_status." };
    out.send_status = v;
  }
  if (!out.outbound_access_status && !out.send_status) {
    return { error: "Provide outbound_access_status and/or send_status." };
  }
  return out;
}
