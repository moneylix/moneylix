-- 012: Recurring transactions — schedule repeat income/expense entries
-- Supports daily, weekly, monthly, yearly frequencies

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Transaction template
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount REAL NOT NULL CHECK (amount > 0),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  note TEXT,
  method TEXT DEFAULT 'bank',
  tags TEXT,
  
  -- Schedule
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  interval_value INTEGER NOT NULL DEFAULT 1,       -- every N days/weeks/months/years
  day_of_week INTEGER,                             -- 0=Sun..6=Sat (for weekly)
  day_of_month INTEGER,                            -- 1-31 (for monthly/yearly)
  month_of_year INTEGER,                           -- 1-12 (for yearly)
  
  -- Tracking
  start_date TEXT NOT NULL,                        -- YYYY-MM-DD: when to start generating
  end_date TEXT,                                   -- YYYY-MM-DD: optional stop date (null = forever)
  next_run_date TEXT NOT NULL,                     -- YYYY-MM-DD: next date to create transaction
  last_run_date TEXT,                              -- YYYY-MM-DD: last time a transaction was generated
  total_generated INTEGER NOT NULL DEFAULT 0,      -- count of transactions created
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next_run ON recurring_transactions(next_run_date, status);
CREATE INDEX IF NOT EXISTS idx_recurring_status ON recurring_transactions(status);
