import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { validateGSTIN } from '@/lib/gst'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await db.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token],
  )
  return session?.user_id ?? null
}

interface GSTSettingsRow {
  user_id: number
  business_id: number
  gstin: string | null
  gst_registered: number
  state_code: string | null
  default_tax_rate: number
  hsn_sac_code: string | null
  created_at: string
  updated_at: string
}

/**
 * GET /api/gst/settings?businessId=N
 * Returns GST settings for the given business.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    if (!businessId) return NextResponse.json({ error: 'businessId is required' }, { status: 400 })

    const settings = await db.get<GSTSettingsRow>(
      'SELECT * FROM gst_settings WHERE user_id = ? AND business_id = ?',
      [userId, parseInt(businessId, 10)],
    )

    if (!settings) {
      return NextResponse.json({
        user_id: userId,
        business_id: parseInt(businessId, 10),
        gstin: null,
        gst_registered: 0,
        state_code: null,
        default_tax_rate: 18,
        hsn_sac_code: null,
      })
    }

    return NextResponse.json(settings)
  } catch (err) {
    console.error('GST settings GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch GST settings' }, { status: 500 })
  }
}

/**
 * PUT /api/gst/settings
 * Create or update GST settings for a business.
 *
 * Body: { businessId, gstin?, gst_registered?, state_code?, default_tax_rate?, hsn_sac_code? }
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { businessId, gstin, gst_registered, state_code, default_tax_rate, hsn_sac_code } = body

    if (!businessId) return NextResponse.json({ error: 'businessId is required' }, { status: 400 })

    // Validate GSTIN if provided
    if (gstin) {
      const validation = validateGSTIN(gstin)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }
    }

    // Validate tax rate
    const rate = default_tax_rate ?? 18
    if (rate < 0 || rate > 100) {
      return NextResponse.json({ error: 'Tax rate must be between 0 and 100' }, { status: 400 })
    }

    // Upsert
    await db.run(
      `INSERT INTO gst_settings (user_id, business_id, gstin, gst_registered, state_code, default_tax_rate, hsn_sac_code, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (user_id, business_id) DO UPDATE SET
         gstin = excluded.gstin,
         gst_registered = excluded.gst_registered,
         state_code = excluded.state_code,
         default_tax_rate = excluded.default_tax_rate,
         hsn_sac_code = excluded.hsn_sac_code,
         updated_at = datetime('now')`,
      [
        userId,
        parseInt(businessId, 10),
        gstin ?? null,
        gst_registered ? 1 : 0,
        state_code ?? null,
        rate,
        hsn_sac_code ?? null,
      ],
    )

    const updated = await db.get<GSTSettingsRow>(
      'SELECT * FROM gst_settings WHERE user_id = ? AND business_id = ?',
      [userId, parseInt(businessId, 10)],
    )

    return NextResponse.json(updated)
  } catch (err) {
    console.error('GST settings PUT error:', err)
    return NextResponse.json({ error: 'Failed to update GST settings' }, { status: 500 })
  }
}
