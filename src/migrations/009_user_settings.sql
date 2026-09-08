-- 009: Per-user settings table
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

-- Migrate any existing global defaultCurrency into user_settings for all users
INSERT OR IGNORE INTO user_settings (user_id, key, value)
SELECT u.id, 'defaultCurrency', COALESCE((SELECT value FROM settings WHERE key = 'defaultCurrency'), 'INR')
FROM users u;
