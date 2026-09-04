-- Growth: referrals, activation funnel columns, DNS verification cache

ALTER TABLE users ADD COLUMN referral_code TEXT;
ALTER TABLE users ADD COLUMN referred_by_user_id TEXT;
ALTER TABLE users ADD COLUMN referral_bonus_domains INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
ALTER TABLE users ADD COLUMN first_email_received_at INTEGER;
ALTER TABLE users ADD COLUMN first_email_sent_at INTEGER;
ALTER TABLE users ADD COLUMN activated_at INTEGER;
ALTER TABLE users ADD COLUMN onboarding_dismissed INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_user_id TEXT NOT NULL,
  referred_user_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  reward_domains INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  qualified_at INTEGER,
  rewarded_at INTEGER,
  FOREIGN KEY (referrer_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- Optional DNS check audit (rate-limit + debugging)
CREATE TABLE IF NOT EXISTS dns_check_log (
  id TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  tool TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dns_check_ip ON dns_check_log(ip_hash, created_at DESC);
