import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../admin/_auth'
import dbQuery from '@/lib/db.async'

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const features = await dbQuery.all('SELECT * FROM feature_requests ORDER BY priority DESC, created_at DESC')
  return NextResponse.json({ features })
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, description, status, priority, category } = await request.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const result = await dbQuery.run(
    `INSERT INTO feature_requests (title, description, status, priority, category) VALUES (?, ?, ?, ?, ?)`,
    [title.trim(), description ?? null, status ?? 'pending', priority ?? 'medium', category ?? 'general']
  )

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, title, description, status, priority, category } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  await dbQuery.run(
    `UPDATE feature_requests SET title = ?, description = ?, status = ?, priority = ?, category = ?,
     updated_at = datetime('now') WHERE id = ?`,
    [title, description ?? null, status, priority, category ?? 'general', id]
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  await dbQuery.run('DELETE FROM feature_requests WHERE id = ?', [id])
  return NextResponse.json({ success: true })
}
