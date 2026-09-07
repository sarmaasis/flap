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

export function clerkAuthorizedParties(env: Env): string[] {
  const origin = appOrigin(env);
  const parties = new Set<string>([origin]);
  try {
    const host = new URL(origin).hostname;
    if (host === "127.0.0.1") parties.add(origin.replace("127.0.0.1", "localhost"));
    if (host === "localhost") parties.add(origin.replace("localhost", "127.0.0.1"));
  } catch {
    /* ignore */
  }
  return [...parties];
}

/** Prefer Authorization header; for WebSocket upgrades accept `?__clerk_token=`. */
export function requestWithClerkToken(request: Request): Request {
  if (request.headers.get("Authorization")) return request;
  const url = new URL(request.url);
  const token = (url.searchParams.get("__clerk_token") || "").trim();
  if (!token) return request;
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return new Request(request, { headers });
}

export function clerkConfigured(env: Env): boolean {
  return Boolean((env.CLERK_SECRET_KEY || "").trim() && (env.CLERK_PUBLISHABLE_KEY || "").trim());
}
