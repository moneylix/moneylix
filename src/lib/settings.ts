/**
 * App Settings — key/value store
 *
 * One table (app_settings) backs every admin-configurable toggle.
 * Adding a new setting is a form field, not a migration.
 *
 * Usage:
 *   const name = await getSetting('app_name', 'Moneylix')
 *   const rows = await getSettingNumber('rows_per_page', 20)
 *   const scoped = await getSettingBool('scope_users_to_self', true)
 *   await setSetting('app_name', 'Moneylix', adminUserId)
 *   const all = await getAllSettings()
 */
import dbQuery from '@/lib/db.async'

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const row = await dbQuery.get<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key]
  )
  return row?.value ?? fallback
}

export async function getSettingNumber(key: string, fallback = 0): Promise<number> {
  const raw = await getSetting(key, '')
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : fallback
}

export async function getSettingBool(key: string, fallback = false): Promise<boolean> {
  const raw = await getSetting(key, '')
  if (raw === '') return fallback
  return raw === 'true' || raw === '1'
}

export async function setSetting(key: string, value: string, updatedBy?: number): Promise<void> {
  await dbQuery.run(
    `INSERT INTO app_settings (key, value, updated_at, updated_by)
     VALUES (?, ?, datetime('now'), ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = datetime('now'),
       updated_by = excluded.updated_by`,
    [key, value, updatedBy ?? null]
  )
}

export async function setSettings(entries: Record<string, string>, updatedBy?: number): Promise<void> {
  for (const [key, value] of Object.entries(entries)) {
    await setSetting(key, value, updatedBy)
  }
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await dbQuery.all<{ key: string; value: string }>(
    'SELECT key, value FROM app_settings ORDER BY key'
  )
  const out: Record<string, string> = {}
  for (const r of rows) out[r.key] = r.value
  return out
}
