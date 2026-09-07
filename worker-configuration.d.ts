interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ATTACHMENTS?: R2Bucket;
  /** Per-workspace inbox realtime (WebSocket hibernation Durable Object). */
  INBOX_HUB: DurableObjectNamespace;
  /** Optional: Cloudflare Email Sending for useflap.online system mail (legacy + dual-path). */
  SEB?: SendEmail;
  /** Clerk publishable key (also returned by GET /api/public-config for the SPA). */
  CLERK_PUBLISHABLE_KEY: string;
  /** Clerk secret key for Worker session verification / Backend API. */
  CLERK_SECRET_KEY: string;
  /** Optional PEM public key for networkless JWT verify (Dashboard → API Keys → JWT public key). */
  CLERK_JWT_KEY?: string;
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
  DODO_PRODUCT_SOLO_ANNUAL?: string;
  DODO_PRODUCT_BUILDER_ANNUAL?: string;
  DODO_PRODUCT_STUDIO_ANNUAL?: string;
  /** From address for system mail (non-auth). */
  SYSTEM_FROM_EMAIL?: string;
  /** Mailgun private API key — legacy customer domains only during SES migration. */
  MAILGUN_API_KEY?: string;
  /** Mailgun webhook signing key (Sending → Webhooks → HTTP webhook signing key). */
  MAILGUN_WEBHOOK_SIGNING_KEY?: string;
  /** Override API host, e.g. https://api.eu.mailgun.net for EU. */
  MAILGUN_API_BASE?: string;
  /** Dev only: allow unsigned inbound webhooks when signing key is unset. */
  MAILGUN_WEBHOOK_ALLOW_UNSIGNED?: string;
  /** Amazon SES / AWS credentials for customer-domain mail (all plans). */
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  /** SES region that supports inbound receiving (default us-east-1). */
  AWS_SES_REGION?: string;
  /** Optional SES configuration set for bounce/complaint events. */
  SES_CONFIGURATION_SET?: string;
  /** Active SES receipt rule set name (inbound). */
  SES_RECEIPT_RULE_SET?: string;
  /** S3 bucket for SES raw MIME (receipt rule action). */
  SES_INBOUND_BUCKET?: string;
  /** Shared secret: Lambda HMAC → POST /api/inbound/ses */
  SES_INBOUND_WEBHOOK_SECRET?: string;
  /** Dev only: allow unsigned SES inbound when secret unset. */
  SES_INBOUND_ALLOW_UNSIGNED?: string;
}
