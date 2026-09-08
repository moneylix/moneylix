-- 008: Add user_id to businesses for proper data isolation
ALTER TABLE businesses ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Assign existing businesses to admin user (id=1) so nothing breaks.
-- Guarded with EXISTS: on a fresh install, migrations run before the admin
-- user is seeded, so user_id=1 wouldn't exist yet and this would otherwise
-- violate the FOREIGN KEY constraint and abort every migration after this one.
UPDATE businesses SET user_id = 1 WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM users WHERE id = 1);

CREATE INDEX IF NOT EXISTS idx_businesses_user ON businesses(user_id);
