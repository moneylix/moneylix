-- 022: Payroll & staff expense tracking

CREATE TABLE IF NOT EXISTS staff_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role_title TEXT,
  email TEXT,
  phone TEXT,
  salary_amount REAL,
  salary_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (salary_frequency IN ('monthly', 'weekly', 'biweekly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  joined_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payroll_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_member_id INTEGER NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  base_salary REAL,
  allowances REAL NOT NULL DEFAULT 0,
  deductions REAL NOT NULL DEFAULT 0,
  net_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_date TEXT,
  transaction_id INTEGER REFERENCES transactions(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_staff_period ON payroll_entries(staff_member_id, period);
CREATE INDEX IF NOT EXISTS idx_staff_user        ON staff_members(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_business     ON staff_members(business_id);
CREATE INDEX IF NOT EXISTS idx_payroll_user       ON payroll_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_business   ON payroll_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_payroll_status     ON payroll_entries(status);
