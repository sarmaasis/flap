-- SaaS billing + plan entitlements (Dodo Payments)
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  dodo_subscription_id TEXT,
  dodo_customer_id TEXT,
  dodo_product_id TEXT,
  current_period_end INTEGER,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_dodo ON subscriptions(dodo_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  user_id TEXT,
  payload TEXT NOT NULL,
  processed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_events_user ON billing_events(user_id, processed_at DESC);

-- Allow open signup for hosted SaaS (setup_state remains for first-boot ops)
ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN plan_id TEXT NOT NULL DEFAULT 'free';
