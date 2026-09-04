interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  INLET_ATTACHMENTS?: R2Bucket;
  SEB?: SendEmail;
  SESSION_SECRET: string;
  APP_URL: string;
  SAAS_MODE?: string;
  DODO_PAYMENTS_API_KEY?: string;
  DODO_PAYMENTS_WEBHOOK_KEY?: string;
  DODO_PAYMENTS_ENVIRONMENT?: string;
  DODO_PRODUCT_SOLO?: string;
  DODO_PRODUCT_BUILDER?: string;
  DODO_PRODUCT_STUDIO?: string;
  /** @deprecated → DODO_PRODUCT_BUILDER */
  DODO_PRODUCT_PRO?: string;
  /** @deprecated → DODO_PRODUCT_STUDIO */
  DODO_PRODUCT_TEAM?: string;
  /** @deprecated → DODO_PRODUCT_SOLO */
  DODO_PRODUCT_STARTER?: string;
  /** @deprecated → DODO_PRODUCT_STUDIO */
  DODO_PRODUCT_BUSINESS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  /** From address for account verification mail (must be allowed by Cloudflare Email Routing / SEB). */
  SYSTEM_FROM_EMAIL?: string;
}
