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
  DODO_PRODUCT_STARTER?: string;
  DODO_PRODUCT_PRO?: string;
  DODO_PRODUCT_BUSINESS?: string;
}
