-- 025: Time Tracking

CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  client_name TEXT,
  project_name TEXT,
  description TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration_minutes INTEGER,
  hourly_rate REAL,
  total_amount REAL,
  is_billable INTEGER NOT NULL DEFAULT 1,
  is_invoiced INTEGER NOT NULL DEFAULT 0,
  invoice_id INTEGER,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('running','completed','invoiced')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS time_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client_name TEXT,
  hourly_rate REAL,
  color TEXT NOT NULL DEFAULT '#10B981',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_business ON time_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(status);
CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_name);
CREATE INDEX IF NOT EXISTS idx_time_projects_user ON time_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_time_projects_business ON time_projects(business_id);
