import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { parseQuery, TransactionFiltersSchema, parseBody, CreateTransactionSchema } from '@/lib/schemas'
import type { PaginatedTransactions } from '@/types'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await db.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token]
  )
  return session?.user_id ?? null
}

async function userOwnsBusinessId(userId: number, businessId: number): Promise<boolean> {
  const biz = await db.get('SELECT id FROM businesses WHERE id = ? AND user_id = ?', [businessId, userId])
  return !!biz
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const parsed = parseQuery(TransactionFiltersSchema, searchParams)
    if (parsed.error) return parsed.error

    const { businessId, startDate, endDate, type, categoryId, method, search, sortBy, sortOrder, page, limit } = parsed.data

    const conditions: string[] = []
    const params: unknown[] = []

    if (businessId) {
      if (!await userOwnsBusinessId(userId, businessId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      conditions.push('t.business_id = ?'); params.push(businessId)
    } else {
      // Restrict to user's own businesses when no specific businessId given
      conditions.push('t.business_id IN (SELECT id FROM businesses WHERE user_id = ?)')
      params.push(userId)
    }
    if (startDate)  { conditions.push('t.date >= ?');        params.push(startDate) }
    if (endDate)    { conditions.push('t.date <= ?');        params.push(endDate) }
    if (type === 'pending') { conditions.push("t.status = 'pending'") }
    else if (type)  { conditions.push('t.type = ?');         params.push(type) }
    if (categoryId) { conditions.push('t.category_id = ?'); params.push(categoryId) }
    if (method)     { conditions.push('t.method = ?');       params.push(method) }
    if (search) {
      conditions.push('(t.note LIKE ? OR t.tags LIKE ? OR t.client_name LIKE ?)')
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const orderCol = sortBy === 'amount' ? 't.amount' : 't.date'
    const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC'
    const offset = (page - 1) * limit

    const countRow = await db.get<{ n: number }>(
      `SELECT COUNT(*) as n FROM transactions t ${where}`,
      params
    )
    const total = countRow?.n ?? 0

    type Row = {
      id: number; type: string; amount: number; category_id: number
      business_id: number | null; currency: string; date: string
      due_date: string | null; reminder_days: number | null; note: string | null
      method: string | null; tags: string | null; status: string
      client_name: string | null; created_at: string; updated_at: string
      cat_id: number | null; cat_name: string | null; cat_icon: string | null
      cat_color: string | null; cat_type: string | null; cat_created_at: string | null
    }

    const rows = await db.all<Row>(
      `SELECT t.*,
              c.id as cat_id, c.name as cat_name, c.icon as cat_icon,
              c.color as cat_color, c.type as cat_type, c.created_at as cat_created_at
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       ${where}
       ORDER BY ${orderCol} ${orderDir}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const transactions = rows.map(t => ({
      id: t.id,
      type: t.type as 'credit' | 'debit',
      amount: t.amount,
      category_id: t.category_id ?? 0,
      business_id: t.business_id ?? undefined,
      currency: t.currency,
      date: t.date,
      due_date: t.due_date ?? undefined,
      reminder_days: t.reminder_days ?? undefined,
      note: t.note,
      method: t.method,
      tags: t.tags,
      status: t.status,
      client_name: t.client_name ?? undefined,
      created_at: t.created_at,
      updated_at: t.updated_at,
      category: t.cat_id ? {
        id: t.cat_id,
        name: t.cat_name ?? '',
        icon: t.cat_icon ?? '',
        color: t.cat_color ?? '',
        type: (t.cat_type ?? 'both') as 'credit' | 'debit' | 'both',
        created_at: t.cat_created_at ?? '',
      } : undefined,
    }))

    const result: PaginatedTransactions = { transactions, total, page, totalPages: Math.ceil(total / limit) }
    return NextResponse.json(result)
  } catch (error) {
    console.error('Transactions fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = parseBody(CreateTransactionSchema, await request.json())
    if (parsed.error) return parsed.error

    const d = parsed.data
    if (d.business_id && !await userOwnsBusinessId(userId, d.business_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date().toISOString()

    const result = await db.run(
      `INSERT INTO transactions
         (type, amount, category_id, business_id, currency, date, due_date, reminder_days,
          note, method, tags, status, client_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.type, d.amount, d.category_id, d.business_id ?? null, d.currency, d.date,
        d.due_date ?? null, d.reminder_days ?? 3, d.note ?? null, d.method ?? null,
        d.tags ?? null, d.status ?? 'completed', d.client_name ?? null, now, now,
      ]
    )

    const id = result.lastInsertRowid as number

    type TxRow = {
      id: number; type: string; amount: number; category_id: number
      business_id: number | null; currency: string; date: string
      due_date: string | null; reminder_days: number | null; note: string | null
      method: string | null; tags: string | null; status: string
      client_name: string | null; created_at: string; updated_at: string
      cat_id: number | null; cat_name: string | null; cat_icon: string | null
      cat_color: string | null; cat_type: string | null; cat_created_at: string | null
    }

    const row = (await db.get<TxRow>(
      `SELECT t.*,
              c.id as cat_id, c.name as cat_name, c.icon as cat_icon,
              c.color as cat_color, c.type as cat_type, c.created_at as cat_created_at
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.id = ?`,
      [id]
    ))!

    return NextResponse.json({
      id: row.id,
      type: row.type,
      amount: row.amount,
      category_id: row.category_id,
      business_id: row.business_id,
      currency: row.currency,
      date: row.date,
      due_date: row.due_date,
      reminder_days: row.reminder_days,
      note: row.note,
      method: row.method,
      tags: row.tags,
      status: row.status,
      client_name: row.client_name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      category: row.cat_id ? {
        id: row.cat_id,
        name: row.cat_name ?? '',
        icon: row.cat_icon ?? '',
        color: row.cat_color ?? '',
        type: row.cat_type ?? 'both',
      } : undefined,
    }, { status: 201 })
  } catch (error) {
    console.error('Transaction create error:', error)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}
