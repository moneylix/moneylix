-- 006: Broadcasts table for admin notifications
CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  plan_filter TEXT NOT NULL DEFAULT 'all',
  sent_by INTEGER REFERENCES users(id),
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  recipient_count INTEGER NOT NULL DEFAULT 0
);
