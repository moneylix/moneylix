-- 026: App Settings (key/value) + Branding storage
-- One table backs every admin-configurable toggle. New settings need zero schema changes.

CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by  INTEGER REFERENCES users(id)
);

-- Seed sensible defaults (INSERT OR IGNORE so re-runs are safe)
INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('app_name',            'Moneylix'),
  ('currency_symbol',     '₹'),
  ('default_currency',    'INR'),
  ('rows_per_page',       '20'),
  ('scope_users_to_self', 'true'),
  ('allow_registration',  'true'),
  ('maintenance_mode',    'false'),
  ('primary_color',       '#10b981'),
  ('accent_color',        '#22d3ee'),
  ('default_theme',       'dark'),
  ('logo_url',            ''),
  ('favicon_url',         ''),
  ('support_email',       'support@moneylix.in'),
  ('support_phone',       '');
