-- 021: Team roles & permissions — multi-user access per business

CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'accountant', 'staff', 'viewer')),
  invited_by INTEGER REFERENCES users(id),
  invited_email TEXT,
  invite_token TEXT UNIQUE,
  invite_status TEXT NOT NULL DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted', 'declined')),
  permissions TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_biz_user ON team_members(business_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_user         ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_business     ON team_members(business_id);
CREATE INDEX IF NOT EXISTS idx_team_invite_token ON team_members(invite_token);
