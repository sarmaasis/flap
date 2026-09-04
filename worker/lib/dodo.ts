/** Dodo Payments REST helpers for Cloudflare Workers (fetch + Web Crypto). */

export type DodoEnv = {
  DODO_PAYMENTS_API_KEY?: string;
  DODO_PAYMENTS_WEBHOOK_KEY?: string;
  DODO_PAYMENTS_ENVIRONMENT?: string;
  APP_URL?: string;
};

export type DodoMode = "test_mode" | "live_mode";

function trim(v: string | undefined): string {
  return (v || "").trim();
}

/**
 * Resolve Dodo API mode.
 * Docs: environment is `test_mode` | `live_mode` (SDK defaults to live_mode — we prefer
 * inferring from key prefix, then falling back to test_mode for local safety).
 * @see https://docs.dodopayments.com/miscellaneous/test-mode-vs-live-mode
 */
export function resolveDodoMode(env: DodoEnv): DodoMode {
  const raw = trim(env.DODO_PAYMENTS_ENVIRONMENT).toLowerCase();
  if (raw === "live_mode" || raw === "live") return "live_mode";
  if (raw === "test_mode" || raw === "test") return "test_mode";

  const key = trim(env.DODO_PAYMENTS_API_KEY);
  if (key.startsWith("dodo_live_")) return "live_mode";
  if (key.startsWith("dodo_test_")) return "test_mode";

  // Unset / unknown → test host so local .dev.vars never silently hit live.
  return "test_mode";
}

export function dodoBaseUrl(env: DodoEnv): string {
  return resolveDodoMode(env) === "live_mode"
    ? "https://live.dodopayments.com"
    : "https://test.dodopayments.com";
}

/** When key has a known prefix, refuse obvious test/live mismatches before calling Dodo. */
export function assertDodoKeyMatchesMode(env: DodoEnv): void {
  const key = trim(env.DODO_PAYMENTS_API_KEY);
  if (!key) throw new Error("DODO_PAYMENTS_API_KEY is not configured.");
  const mode = resolveDodoMode(env);
  if (key.startsWith("dodo_test_") && mode === "live_mode") {
    throw new Error(
      "DODO_PAYMENTS_API_KEY is a test key (dodo_test_…) but DODO_PAYMENTS_ENVIRONMENT=live_mode. Set DODO_PAYMENTS_ENVIRONMENT=test_mode, or use a live key (dodo_live_…).",
    );
  }
  if (key.startsWith("dodo_live_") && mode === "test_mode") {
    throw new Error(
      "DODO_PAYMENTS_API_KEY is a live key (dodo_live_…) but DODO_PAYMENTS_ENVIRONMENT=test_mode. Set DODO_PAYMENTS_ENVIRONMENT=live_mode, or use a test key (dodo_test_…).",
    );
  }
}

function unauthorizedHint(env: DodoEnv, status: number): string | null {
  if (status !== 401 && status !== 403) return null;
  const mode = resolveDodoMode(env);
  const host = dodoBaseUrl(env);
  return (
    `Dodo returned unauthorized (${status}) for ${mode} (${host}). ` +
    `API keys are environment-specific: use a test key with DODO_PAYMENTS_ENVIRONMENT=test_mode ` +
    `(https://test.dodopayments.com), or a live key with live_mode. Mixing them yields unauthorized.`
  );
}

export async function createCheckoutSession(
  env: DodoEnv,
  opts: {
    product_id: string;
    customer_email: string;
    customer_name?: string;
    return_url: string;
    metadata?: Record<string, string>;
  },
): Promise<{ session_id: string; checkout_url: string }> {
  assertDodoKeyMatchesMode(env);
  const key = trim(env.DODO_PAYMENTS_API_KEY);

  const res = await fetch(`${dodoBaseUrl(env)}/checkouts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      product_cart: [{ product_id: opts.product_id, quantity: 1 }],
      customer: {
        email: opts.customer_email,
        name: opts.customer_name || opts.customer_email.split("@")[0],
      },
      return_url: opts.return_url,
      metadata: opts.metadata ?? {},
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const hint = unauthorizedHint(env, res.status);
    throw new Error(hint || `Dodo checkout failed (${res.status}): ${text.slice(0, 240)}`);
  }
  return (await res.json()) as { session_id: string; checkout_url: string };
}

export async function createCustomerPortalSession(
  env: DodoEnv,
  customerId: string,
  returnUrl: string,
): Promise<{ link: string }> {
  assertDodoKeyMatchesMode(env);
  const key = trim(env.DODO_PAYMENTS_API_KEY);
  if (!customerId) throw new Error("No Dodo customer on this subscription yet.");

  const url = new URL(`${dodoBaseUrl(env)}/customers/${encodeURIComponent(customerId)}/customer-portal/session`);
  url.searchParams.set("return_url", returnUrl);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const hint = unauthorizedHint(env, res.status);
    throw new Error(hint || `Dodo portal failed (${res.status}): ${text.slice(0, 240)}`);
  }
  return (await res.json()) as { link: string };
}

/** Standard Webhooks verification (Dodo uses this spec). */
export async function verifyDodoWebhook(
  env: DodoEnv,
  rawBody: string,
  headers: { id: string; timestamp: string; signature: string },
): Promise<boolean> {
  const secret = trim(env.DODO_PAYMENTS_WEBHOOK_KEY);
  if (!secret) return false;
  if (!headers.id || !headers.timestamp || !headers.signature) return false;

  // Reject stale timestamps (>5 minutes)
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const keyBytes = decodeWebhookSecret(secret);
  const signed = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(signed));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  const candidates = headers.signature.split(" ").flatMap((part) => {
    const [, sig] = part.split(",");
    return sig ? [sig.trim()] : [part.replace(/^v1,/, "").trim()];
  });

  return candidates.some((sig) => timingSafeEqual(sig, expected));
}

function decodeWebhookSecret(secret: string): Uint8Array {
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  try {
    const bin = atob(raw);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new TextEncoder().encode(secret);
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
