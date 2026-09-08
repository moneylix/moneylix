import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await db.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token]
  )
  return session?.user_id ?? null
}

/**
 * GET /api/invoices/settings
 * Return invoice settings for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let settings = await db.get<Record<string, unknown>>(
      'SELECT * FROM invoice_settings WHERE user_id = ?',
      [userId]
    )

    if (!settings) {
      // Return sensible defaults
      settings = {
        user_id: userId,
        business_name: null,
        logo_url: null,
        address: null,
        email: null,
        phone: null,
        bank_details: null,
        default_terms: 'Payment is due within 30 days of the invoice date.',
        default_notes: 'Thank you for your business!',
        invoice_prefix: 'INV',
        next_invoice_number: 1,
      }
    }

    return NextResponse.json({ settings })
  } catch (err) {
    console.error('Invoice settings GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

/**
 * PUT /api/invoices/settings
 * Create or update invoice settings (upsert).
 * Body: { business_name?, logo_url?, address?, email?, phone?, bank_details?,
 *         default_terms?, default_notes?, invoice_prefix? }
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      business_name,
      logo_url,
      address,
      email,
      phone,
      bank_details,
      default_terms,
      default_notes,
      invoice_prefix,
    } = body

    const existing = await db.get<{ user_id: number }>(
      'SELECT user_id FROM invoice_settings WHERE user_id = ?',
      [userId]
    )

    if (existing) {
      await db.run(
        `UPDATE invoice_settings SET
          business_name = COALESCE(?, business_name),
          logo_url = COALESCE(?, logo_url),
          address = COALESCE(?, address),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          bank_details = COALESCE(?, bank_details),
          default_terms = COALESCE(?, default_terms),
          default_notes = COALESCE(?, default_notes),
          invoice_prefix = COALESCE(?, invoice_prefix)
        WHERE user_id = ?`,
        [
          business_name !== undefined ? business_name : null,
          logo_url !== undefined ? logo_url : null,
          address !== undefined ? address : null,
          email !== undefined ? email : null,
          phone !== undefined ? phone : null,
          bank_details !== undefined ? bank_details : null,
          default_terms !== undefined ? default_terms : null,
          default_notes !== undefined ? default_notes : null,
          invoice_prefix !== undefined ? invoice_prefix : null,
          userId,
        ]
      )
    } else {
      await db.run(
        `INSERT INTO invoice_settings (user_id, business_name, logo_url, address, email, phone, bank_details, default_terms, default_notes, invoice_prefix, next_invoice_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          userId,
          business_name || null,
          logo_url || null,
          address || null,
          email || null,
          phone || null,
          bank_details || null,
          default_terms || 'Payment is due within 30 days of the invoice date.',
          default_notes || 'Thank you for your business!',
          invoice_prefix || 'INV',
        ]
      )
    }

    const settings = await db.get<Record<string, unknown>>(
      'SELECT * FROM invoice_settings WHERE user_id = ?',
      [userId]
    )

    return NextResponse.json({ settings })
  } catch (err) {
    console.error('Invoice settings PUT error:', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
