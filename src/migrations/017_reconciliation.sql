-- 017: Bank Reconciliation tables
-- Auto-match bank statement lines to manual transactions, flag discrepancies

CREATE TABLE IF NOT EXISTS reconciliation_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
  bank_connection_id INTEGER REFERENCES bank_connections(id) ON DELETE SET NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  total_bank_txns INTEGER NOT NULL DEFAULT 0,
  matched_count INTEGER NOT NULL DEFAULT 0,
  unmatched_count INTEGER NOT NULL DEFAULT 0,
  discrepancy_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reconciliation_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES reconciliation_sessions(id) ON DELETE CASCADE,
  bank_transaction_id INTEGER NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
  manual_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  match_type TEXT NOT NULL DEFAULT 'auto' CHECK (match_type IN ('auto', 'manual', 'suggested')),
  confidence REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unmatched' CHECK (status IN ('matched', 'unmatched', 'disputed', 'ignored')),
  matched_by TEXT NOT NULL DEFAULT 'system',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recon_sessions_user ON reconciliation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_recon_sessions_business ON reconciliation_sessions(business_id);
CREATE INDEX IF NOT EXISTS idx_recon_sessions_status ON reconciliation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_recon_matches_session ON reconciliation_matches(session_id);
CREATE INDEX IF NOT EXISTS idx_recon_matches_bank_txn ON reconciliation_matches(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_recon_matches_manual_txn ON reconciliation_matches(manual_transaction_id);
CREATE INDEX IF NOT EXISTS idx_recon_matches_status ON reconciliation_matches(status);
