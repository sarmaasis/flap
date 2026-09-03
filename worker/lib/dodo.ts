/** Dodo Payments REST helpers for Cloudflare Workers (fetch + Web Crypto). */

export type DodoEnv = {
  DODO_PAYMENTS_API_KEY?: string;
  DODO_PAYMENTS_WEBHOOK_KEY?: string;
  DODO_PAYMENTS_ENVIRONMENT?: string;
  APP_URL?: string;
};

function baseUrl(env: DodoEnv): string {
  const mode = (env.DODO_PAYMENTS_ENVIRONMENT || "test_mode").toLowerCase();
  return mode === "live_mode" || mode === "live" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
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
  const key = env.DODO_PAYMENTS_API_KEY;
  if (!key) throw new Error("DODO_PAYMENTS_API_KEY is not configured.");

  const res = await fetch(`${baseUrl(env)}/checkouts`, {
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
    throw new Error(`Dodo checkout failed (${res.status}): ${text.slice(0, 240)}`);
  }
  return (await res.json()) as { session_id: string; checkout_url: string };
}

export async function createCustomerPortalSession(
  env: DodoEnv,
  customerId: string,
  returnUrl: string,
): Promise<{ link: string }> {
  const key = env.DODO_PAYMENTS_API_KEY;
  if (!key) throw new Error("DODO_PAYMENTS_API_KEY is not configured.");
  if (!customerId) throw new Error("No Dodo customer on this subscription yet.");

  const url = new URL(`${baseUrl(env)}/customers/${encodeURIComponent(customerId)}/customer-portal/session`);
  url.searchParams.set("return_url", returnUrl);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dodo portal failed (${res.status}): ${text.slice(0, 240)}`);
  }
  return (await res.json()) as { link: string };
}

/** Standard Webhooks verification (Dodo uses this spec). */
export async function verifyDodoWebhook(
  env: DodoEnv,
  rawBody: string,
  headers: { id: string; timestamp: string; signature: string },
): Promise<boolean> {
  const secret = env.DODO_PAYMENTS_WEBHOOK_KEY;
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
