import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { requireAdmin } from '@/app/api/admin/_auth'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = new URL(request.url).searchParams.get('status') ?? 'open'

  const tickets = await dbQuery.all(
    `SELECT t.*, u.username FROM support_tickets t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.status = ? ORDER BY t.created_at DESC LIMIT 50`,
    [status]
  )
  return NextResponse.json({ tickets })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status, reply } = await request.json()
  await dbQuery.run(
    `UPDATE support_tickets SET status = ?, reply = ?, replied_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [status, reply ?? null, id]
  )
  return NextResponse.json({ success: true })
}
