/** Lightweight first-party analytics — persists via POST /api/analytics. No third-party SDK. */

export type AnalyticsEvent =
  | "landing_view"
  | "homepage_view"
  | "organic_landing"
  | "pricing_view"
  | "signup_clicked"
  | "signup_cta_clicked"
  | "cta_connect_domain"
  | "comparison_page_view"
  | "calculator_started"
  | "calculator_completed"
  | "calculator_share_copied"
  | "seo_tool_used"
  | "tool_started"
  | "tool_completed"
  | "tool_error"
  | "guide_to_tool"
  | "content_to_pricing"
  | "signup_started"
  | "signup_completed"
  | "email_verified"
  | "domain_add_started"
  | "domain_added"
  | "second_domain_added"
  | "domain_dns_records_viewed"
  | "domain_check_started"
  | "domain_identity_verified"
  | "domain_mx_verified"
  | "domain_receiving_ready"
  | "dns_verification_started"
  | "dns_verified"
  | "mailbox_created"
  | "address_created"
  | "first_inbound_received"
  | "first_outbound_attempted"
  | "first_outbound_accepted"
  | "first_email_received"
  | "first_email_sent"
  | "activation_completed"
  | "user_activated"
  | "plan_limit_reached"
  | "upgrade_prompt_seen"
  | "upgrade_started"
  | "checkout_started"
  | "subscription_started"
  | "subscription_upgraded"
  | "subscription_cancelled"
  | "referral_link_copied"
  | "referral_signup"
  | "referral_qualified"
  | "referral_reward_granted"
  | "guide_view"
  | "seo_page_view"
  | "migration_page_view"
  | "migration_started"
  | "migration_completed"
  | "migration_help_requested"
  | "domain_verified"
  | "first_outbound_sent";

type Props = Record<string, string | number | boolean | null | undefined>;

const QUEUE_KEY = "flap_analytics_q";
const SESSION_KEY = "flap_analytics_sid";

function sessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = `s_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "anon";
  }
}

function queue(): Array<{ e: string; p?: Props; t: number; s?: string; path?: string }> {
  try {
    return JSON.parse(sessionStorage.getItem(QUEUE_KEY) || "[]") as Array<{
      e: string;
      p?: Props;
      t: number;
      s?: string;
      path?: string;
    }>;
  } catch {
    return [];
  }
}

function persist(items: Array<{ e: string; p?: Props; t: number; s?: string; path?: string }>) {
  try {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-80)));
  } catch {
    /* ignore */
  }
}

function postPayload(payload: { e: string; p?: Props; t: number; s: string; path?: string }) {
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const ok = navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
      if (ok) return;
    }
  } catch {
    /* fall through to fetch */
  }
  try {
    void (async () => {
      const headers: Record<string, string> = { "content-type": "application/json" };
      try {
        const { getClerkToken } = await import("./api");
        const token = await getClerkToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {
        /* ignore */
      }
      void fetch("/api/analytics", {
        method: "POST",
        headers,
        body,
        credentials: "same-origin",
        keepalive: true,
      });
    })();
  } catch {
    /* ignore */
  }
}

export function track(event: AnalyticsEvent, props?: Props) {
  const utm = (() => {
    try {
      const raw = sessionStorage.getItem("flap_utm");
      return raw ? (JSON.parse(raw) as Record<string, string>) : null;
    } catch {
      return null;
    }
  })();
  const safeProps: Props = { ...(props || {}) };
  // Never send sensitive DNS/email payloads
  delete safeProps.domain;
  delete safeProps.email;
  delete safeProps.headers;
  delete safeProps.records;
  delete safeProps.raw;
  if (utm) {
    for (const [k, v] of Object.entries(utm)) {
      if (safeProps[k] === undefined) safeProps[k] = v;
    }
  }
  const payload = {
    e: event,
    p: Object.keys(safeProps).length ? safeProps : undefined,
    t: Date.now(),
    s: sessionId(),
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
  };
  const items = queue();
  items.push(payload);
  persist(items);

  if (typeof window !== "undefined") {
    (window as unknown as { __flapEvents?: unknown[] }).__flapEvents = [
      ...(((window as unknown as { __flapEvents?: unknown[] }).__flapEvents) || []),
      payload,
    ].slice(-100);
  }

  postPayload(payload);

  if (import.meta.env.DEV) {
    console.debug("[flap:analytics]", event, props || {});
  }
}

export function trackOnce(key: string, event: AnalyticsEvent, props?: Props) {
  const flag = `flap_once_${key}`;
  try {
    if (sessionStorage.getItem(flag)) return;
    sessionStorage.setItem(flag, "1");
  } catch {
    /* ignore */
  }
  track(event, props);
}
