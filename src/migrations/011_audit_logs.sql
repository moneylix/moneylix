-- 011: Audit logs table for RBI bank sync compliance
-- Logs every data access, consent action, and sync event
-- Required for Account Aggregator (AA) regulatory compliance

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- Event classification
  action TEXT NOT NULL,          -- e.g., 'CONSENT_CREATED', 'DATA_FETCHED', 'CONSENT_REVOKED', 'ACCOUNT_DELETED'
  category TEXT NOT NULL DEFAULT 'general',  -- 'bank_sync' | 'auth' | 'data_access' | 'admin' | 'general'
  
  -- Event details
  resource_type TEXT,            -- 'bank_connection' | 'bank_transaction' | 'user' | 'consent'
  resource_id TEXT,              -- ID of the affected resource
  description TEXT,              -- Human-readable description
  metadata TEXT,                 -- JSON blob for extra context (IP, user-agent, request details)
  
  -- Outcome
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure', 'pending')),
  error_message TEXT,            -- If status = 'failure'
  
  -- Request context
  ip_address TEXT,
  user_agent TEXT,
  
  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
