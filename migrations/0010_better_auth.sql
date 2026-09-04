-- Better Auth core tables (coexist with Flap `users` / `sessions`).
-- Strategy: Better Auth owns auth identity in `user`/`session`/`account`/`verification`.
-- Flap product `users.id` remains the workspace id. New auth users use the same id
-- (advanced.database.generateId → usr_…). Existing Flap users are copied into `user`
-- with id preserved. Password hashes are NOT migrated (PBKDF2 format ≠ Better Auth);
-- existing accounts sign in via magic link or password reset after this migration.

CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL DEFAULT 0,
  "image" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "issuer" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TEXT,
  "refreshTokenExpiresAt" TEXT,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "account_issuer_accountId_uidx" ON "account" ("issuer", "accountId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

-- Id-preserving backfill from Flap product users → Better Auth user rows.
-- Dates: Flap stores unix ms; Better Auth stores ISO timestamps as text.
INSERT OR IGNORE INTO "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt")
SELECT
  u.id,
  COALESCE(NULLIF(u.name, ''), lower(u.email)),
  lower(u.email),
  CASE WHEN u.email_verified_at IS NOT NULL AND u.email_verified_at > 0 THEN 1 ELSE 0 END,
  NULL,
  datetime(u.created_at / 1000, 'unixepoch'),
  datetime(u.created_at / 1000, 'unixepoch')
FROM users u;

-- Mark legacy flap_session rows as obsolete (Better Auth uses `session` + cookie token).
-- Keeping the table avoids breaking older migrations; app code no longer writes to it.
