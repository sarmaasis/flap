interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ATTACHMENTS?: R2Bucket;
  /** Optional: Cloudflare Email Sending for useflap.online system mail (legacy + dual-path). */
  SEB?: SendEmail;
  /** @deprecated Prefer BETTER_AUTH_SECRET — kept as fallback for local/dev. */
  SESSION_SECRET: string;
  /** Better Auth signing secret (min 32 chars). Falls back to SESSION_SECRET. */
  BETTER_AUTH_SECRET?: string;
  APP_URL: string;
  /** Public origin for Better Auth baseURL (defaults to APP_URL). */
  BETTER_AUTH_URL?: string;
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
  /** From address for account verification / magic-link mail. */
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
