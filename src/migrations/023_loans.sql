-- 023: Loan & EMI Tracking

CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
  lender_name TEXT NOT NULL,
  loan_type TEXT NOT NULL DEFAULT 'other' CHECK (loan_type IN ('personal','home','vehicle','business','education','other')),
  principal_amount REAL NOT NULL CHECK (principal_amount > 0),
  interest_rate REAL NOT NULL CHECK (interest_rate >= 0),
  tenure_months INTEGER NOT NULL CHECK (tenure_months > 0),
  emi_amount REAL NOT NULL CHECK (emi_amount > 0),
  start_date TEXT NOT NULL,
  end_date TEXT,
  disbursement_date TEXT,
  outstanding_balance REAL,
  total_interest_paid REAL NOT NULL DEFAULT 0,
  total_principal_paid REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','defaulted')),
  next_emi_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS emi_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  payment_date TEXT NOT NULL,
  emi_number INTEGER,
  principal_component REAL,
  interest_component REAL,
  total_amount REAL NOT NULL CHECK (total_amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid','pending','overdue','skipped')),
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_business ON loans(business_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_emi_payments_loan ON emi_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_emi_payments_status ON emi_payments(status);
