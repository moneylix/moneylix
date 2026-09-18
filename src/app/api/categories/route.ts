import { NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { toPgQuery } from '@/lib/db.postgres'
import { categorySchema } from '@/lib/schemas'

export async function GET() {
  try {
    const categories = await db.all('SELECT * FROM categories ORDER BY type, name')
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Categories fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validation = categorySchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const { name, icon, color, type } = validation.data

    const insertResult = await db.transaction(async (tx) => {
      return tx.query(
        toPgQuery('INSERT INTO categories (name, icon, color, type, created_at) VALUES (?, ?, ?, ?, ?) RETURNING *'),
        [name, icon, color, type, new Date().toISOString()]
      )
    })
    const category = insertResult.rows[0]

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Category create error:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
