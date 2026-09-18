-- 027: Add 'enterprise' as a valid subscription plan
-- SQLite can't ALTER a CHECK constraint in place, so recreate the table
-- (the standard SQLite pattern) and copy existing rows across untouched.

CREATE TABLE subscriptions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'premium', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  amount_paid REAL NOT NULL DEFAULT 0,
  payment_method TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO subscriptions_new SELECT * FROM subscriptions;
DROP TABLE subscriptions;
ALTER TABLE subscriptions_new RENAME TO subscriptions;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user   ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan   ON subscriptions(plan);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
