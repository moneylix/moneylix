-- 014: OTP verification for the Account Aggregator bank-connect flow
-- (used by the local mock flow when Setu credentials aren't configured)

CREATE TABLE IF NOT EXISTS bank_otp_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mobile_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bank_otp_user ON bank_otp_verifications(user_id);
