interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  INLET_ATTACHMENTS?: R2Bucket;
  SEB?: SendEmail;
  SESSION_SECRET: string;
  APP_URL: string;
}
