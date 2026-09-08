import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_auth'
import { getAllSettings, setSettings } from '@/lib/settings'
import { audit } from '@/lib/audit'

/**
 * GET /api/admin/settings
 * Returns all app settings as a key/value map.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getAllSettings()
  return NextResponse.json({ settings })
}

/**
 * PUT /api/admin/settings
 * Body: { settings: { key: value, ... } }
 * Updates one or more settings. Used by both General Settings and Branding pages.
 */
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const incoming = body.settings
    if (!incoming || typeof incoming !== 'object') {
      return NextResponse.json({ error: 'Missing settings object' }, { status: 400 })
    }

    // Allow-list of editable keys (prevents arbitrary key injection)
    const ALLOWED = new Set([
      'app_name', 'currency_symbol', 'default_currency', 'rows_per_page',
      'scope_users_to_self', 'allow_registration', 'maintenance_mode',
      'primary_color', 'accent_color', 'default_theme', 'logo_url', 'favicon_url',
      'support_email', 'support_phone',
    ])

    const clean: Record<string, string> = {}
    for (const [k, v] of Object.entries(incoming)) {
      if (ALLOWED.has(k)) clean[k] = String(v)
    }

    // Clamp rows_per_page to a sane range
    if (clean.rows_per_page) {
      const n = Math.max(5, Math.min(100, parseInt(clean.rows_per_page, 10) || 20))
      clean.rows_per_page = String(n)
    }

    await setSettings(clean, admin.id)

    await audit({
      userId: admin.id,
      action: 'ADMIN_SETTINGS_UPDATED',
      category: 'admin',
      description: `Updated settings: ${Object.keys(clean).join(', ')}`,
      metadata: clean,
      request,
    })

    const settings = await getAllSettings()
    return NextResponse.json({ success: true, settings })
  } catch (err) {
    console.error('[admin/settings] PUT error:', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
