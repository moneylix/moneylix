-- 020: GST settings, tax entries, and GST columns on invoices
-- Depends on: 018_invoices.sql (invoices table must exist)

-- GST registration & settings per business
CREATE TABLE IF NOT EXISTS gst_settings (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  gstin       TEXT,
  gst_registered INTEGER NOT NULL DEFAULT 0,
  state_code  TEXT,
  default_tax_rate REAL NOT NULL DEFAULT 18,
  hsn_sac_code TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, business_id)
);

-- Tax entries — GST payable, TDS, advance tax tracking
CREATE TABLE IF NOT EXISTS tax_entries (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id      INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  financial_year   TEXT NOT NULL,
  quarter          TEXT,
  month            TEXT,
  type             TEXT NOT NULL CHECK (type IN ('gst_payable', 'tds_deducted', 'advance_tax', 'tds_receivable')),
  amount           REAL NOT NULL DEFAULT 0,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'filed')),
  due_date         TEXT,
  paid_date        TEXT,
  reference_number TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tax_entries_user     ON tax_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_entries_business ON tax_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_tax_entries_fy       ON tax_entries(financial_year);
CREATE INDEX IF NOT EXISTS idx_tax_entries_type     ON tax_entries(type);
CREATE INDEX IF NOT EXISTS idx_gst_settings_biz     ON gst_settings(business_id);
