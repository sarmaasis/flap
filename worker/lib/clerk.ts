import { createClerkClient } from "@clerk/backend";
import { appOrigin } from "./system-email";

export function flapClerk(env: Env) {
  const secretKey = (env.CLERK_SECRET_KEY || "").trim();
  const publishableKey = (env.CLERK_PUBLISHABLE_KEY || "").trim();
  if (!secretKey || !publishableKey) {
    throw new Error("CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY are required.");
  }
  return createClerkClient({
    secretKey,
    publishableKey,
    jwtKey: (env.CLERK_JWT_KEY || "").trim() || undefined,
  });
}

function addOriginVariants(parties: Set<string>, origin: string) {
  const trimmed = origin.replace(/\/$/, "");
  if (!trimmed) return;
  parties.add(trimmed);
  try {
    const host = new URL(trimmed).hostname;
    if (host === "127.0.0.1") parties.add(trimmed.replace("127.0.0.1", "localhost"));
    if (host === "localhost") parties.add(trimmed.replace("localhost", "127.0.0.1"));
  } catch {
    /* ignore */
  }
}

/**
 * JWT `azp` must match an authorized party. Include APP_URL plus the request Origin
 * (localhost ↔ 127.0.0.1 variants) so Vite host flags do not break Bearer verification.
 */
export function clerkAuthorizedParties(env: Env, request?: Request): string[] {
  const parties = new Set<string>();
  addOriginVariants(parties, appOrigin(env));

  const headerOrigin = request?.headers.get("Origin")?.trim();
  if (headerOrigin) addOriginVariants(parties, headerOrigin);

  const referer = request?.headers.get("Referer")?.trim();
  if (referer) {
    try {
      addOriginVariants(parties, new URL(referer).origin);
    } catch {
      /* ignore */
    }
  }

  // Common local Vite ports when APP_URL drifts from the actual bind address.
  for (const host of ["http://127.0.0.1:5173", "http://localhost:5173"]) {
    parties.add(host);
  }

  return [...parties];
}

/**
 * Flap APIs authenticate via Bearer JWT (or `?__clerk_token=` for WebSockets).
 * Strip Cookie so Clerk's development handshake (`dev-browser-missing`) cannot
 * override a valid Authorization token when the SPA also sends Clerk cookies.
 *
 * Important: do not forward the original body. `new Request(request, { headers })`
 * can lock/consume the body stream in Workers, so later `c.req.json()` returns {}
 * and every POST (mail send, calendar, etc.) fails validation with empty fields.
 */
export function requestWithClerkToken(request: Request): Request {
  const headers = new Headers(request.headers);
  headers.delete("Cookie");

  if (!headers.get("Authorization")) {
    const url = new URL(request.url);
    const token = (url.searchParams.get("__clerk_token") || "").trim();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  return new Request(request.url, {
    method: request.method,
    headers,
  });
}

export function clerkConfigured(env: Env): boolean {
  return Boolean((env.CLERK_SECRET_KEY || "").trim() && (env.CLERK_PUBLISHABLE_KEY || "").trim());
}

export type ClerkSessionRevoker = {
  listActiveSessionIds: (clerkUserId: string) => Promise<string[]>;
  revokeSession: (sessionId: string) => Promise<void>;
};

/**
 * Kill Clerk sessions for a Flap user after workspace removal.
 * Fail-open: missing Clerk id or Admin API errors do not undo offboarding.
 */
export async function revokeClerkSessionsForFlapUser(
  env: Env,
  db: D1Database,
  flapUserId: string,
  client?: ClerkSessionRevoker,
): Promise<{ revoked: number; skipped: string }> {
  const row = await db
    .prepare("SELECT clerk_user_id FROM users WHERE id = ?")
    .bind(flapUserId)
    .first<{ clerk_user_id: string | null }>()
    .catch(() => null);
  const clerkUserId = (row?.clerk_user_id || "").trim();
  if (!clerkUserId) return { revoked: 0, skipped: "no_clerk_user" };

  const revoker =
    client ??
    (clerkConfigured(env)
      ? {
          listActiveSessionIds: async (id: string) => {
            const clerk = flapClerk(env);
            const list = await clerk.sessions.getSessionList({ userId: id, status: "active" });
            return (list.data ?? []).map((s) => s.id);
          },
          revokeSession: async (sessionId: string) => {
            await flapClerk(env).sessions.revokeSession(sessionId);
          },
        }
      : null);
  if (!revoker) return { revoked: 0, skipped: "clerk_unconfigured" };

  try {
    const ids = await revoker.listActiveSessionIds(clerkUserId);
    let revoked = 0;
    for (const sessionId of ids) {
      await revoker.revokeSession(sessionId);
      revoked += 1;
    }
    return { revoked, skipped: "" };
  } catch (err) {
    console.warn("Clerk session revoke failed", flapUserId, err);
    return { revoked: 0, skipped: "clerk_error" };
  }
}
