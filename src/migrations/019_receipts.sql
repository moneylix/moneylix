-- 019: Receipt capture — OCR-based receipt matching

CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  ocr_text TEXT,
  ocr_amount REAL,
  ocr_date TEXT,
  ocr_vendor TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'matched', 'unmatched')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_receipts_user ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_transaction ON receipts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_receipts_business ON receipts(business_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
