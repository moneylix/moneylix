-- 010: Bank Sync tables for Setu Account Aggregator integration
-- Stores bank connections (AA consents) and synced transactions

-- Bank connections: one per user-bank consent
CREATE TABLE IF NOT EXISTS bank_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Setu AA fields
  consent_id TEXT UNIQUE,                -- Setu consent ID
  consent_handle TEXT,                   -- Setu consent handle (used before approval)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'revoked', 'expired')),
  
  -- Bank account info (populated after consent approval)
  fip_id TEXT,                           -- Financial Information Provider ID (e.g., 'SBIN')
  account_type TEXT,                     -- 'SAVINGS', 'CURRENT', etc.
  masked_account_number TEXT,            -- e.g., 'XXXX1234'
  bank_name TEXT,                        -- e.g., 'State Bank of India'
  
  -- Consent validity
  consent_start TEXT,                    -- ISO date: when consent starts
  consent_expiry TEXT,                   -- ISO date: when consent expires
  frequency_unit TEXT DEFAULT 'MONTH',   -- how often we can fetch
  frequency_value INTEGER DEFAULT 1,     -- fetch once per frequency_unit
  
  -- Sync tracking
  last_synced_at TEXT,                   -- ISO datetime of last successful sync
  last_sync_error TEXT,                  -- Error message if last sync failed
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Bank transactions: imported from AA, linked to user's businesses
CREATE TABLE IF NOT EXISTS bank_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bank_connection_id INTEGER NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Transaction details from bank
  txn_id TEXT,                           -- Bank's unique transaction reference
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  date TEXT NOT NULL,                    -- YYYY-MM-DD (transaction date)
  narration TEXT,                        -- Bank narration/description
  reference TEXT,                        -- Payment reference number
  balance_after REAL,                    -- Balance after this transaction
  
  -- Categorisation (AI-powered)
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  ai_category_suggestion TEXT,           -- Claude's suggested category name
  ai_confidence REAL,                    -- 0.0 to 1.0 confidence score
  is_categorised INTEGER NOT NULL DEFAULT 0,  -- 0=uncategorised, 1=user confirmed or high-confidence AI
  
  -- Link to manual transaction (if user imported it)
  linked_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
  
  -- Metadata
  is_duplicate INTEGER NOT NULL DEFAULT 0, -- flagged as potential duplicate of manual entry
  ignored INTEGER NOT NULL DEFAULT 0,      -- user chose to ignore/hide this
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bank_connections_user ON bank_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_connections_status ON bank_connections(status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_user ON bank_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_connection ON bank_transactions(bank_connection_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_txn_id ON bank_transactions(txn_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_uncategorised ON bank_transactions(is_categorised) WHERE is_categorised = 0;
