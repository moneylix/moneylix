import { NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { z } from 'zod'
import { CreateTransactionSchema } from '@/lib/schemas'

const BulkCreateSchema = z.object({
  transactions: z.array(CreateTransactionSchema)
})

const BulkUpdateSchema = z.object({
  ids: z.array(z.number()),
  updates: z.object({
    category_id: z.number().optional(),
    status: z.string().optional(),
    method: z.string().optional(),
  })
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = BulkCreateSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.format() }, { status: 400 })
    }

    const { transactions } = parsed.data

    const results = await db.transaction((tx) => {
      const stmt = tx.prepare(`
        INSERT INTO transactions (type, amount, category_id, business_id, currency, date, due_date, reminder_days, note, method, tags, status, client_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `)

      const ids: number[] = []
      for (const t of transactions) {
        const info = stmt.run(
          t.type, t.amount, t.category_id, t.business_id ?? null, t.currency, 
          t.date, t.due_date ?? null, t.reminder_days, t.note ?? null, 
          t.method ?? null, t.tags ?? null, t.status, t.client_name ?? null
        )
        ids.push(Number(info.lastInsertRowid))
      }
      return ids
    })

    return NextResponse.json({ success: true, count: results.length, ids: results }, { status: 201 })
  } catch (error) {
    console.error('Bulk transaction creation error:', error)
    return NextResponse.json({ error: 'Failed to create transactions' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const parsed = BulkUpdateSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.format() }, { status: 400 })
    }

    const { ids, updates } = parsed.data
    if (ids.length === 0) return NextResponse.json({ success: true, count: 0 })

    const setClauses: string[] = []
    const params: any[] = []

    if (updates.category_id !== undefined) { setClauses.push('category_id = ?'); params.push(updates.category_id) }
    if (updates.status !== undefined) { setClauses.push('status = ?'); params.push(updates.status) }
    if (updates.method !== undefined) { setClauses.push('method = ?'); params.push(updates.method) }

    if (setClauses.length === 0) return NextResponse.json({ error: 'No updates provided' }, { status: 400 })

    setClauses.push("updated_at = datetime('now')")

    const query = `UPDATE transactions SET ${setClauses.join(', ')} WHERE id IN (${ids.map(() => '?').join(',')})`
    
    await db.run(query, [...params, ...ids])

    return NextResponse.json({ success: true, count: ids.length })
  } catch (error) {
    console.error('Bulk update error:', error)
    return NextResponse.json({ error: 'Failed to update transactions' }, { status: 500 })
  }
}
