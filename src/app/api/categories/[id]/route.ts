import { NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { categorySchema } from '@/lib/schemas'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const category = await db.get('SELECT * FROM categories WHERE id = ?', [params.id])
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }
    return NextResponse.json(category)
  } catch (error) {
    console.error('Category fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch category' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validation = categorySchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }
    
    const { name, icon, color, type } = validation.data

    const category = await db.transaction((tx) => {
      tx.prepare('UPDATE categories SET name = ?, icon = ?, color = ?, type = ? WHERE id = ?').run(name, icon, color, type, params.id)
      return tx.prepare('SELECT * FROM categories WHERE id = ?').get(params.id)
    })
    return NextResponse.json(category)
  } catch (error) {
    console.error('Category update error:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await db.transaction((tx) => {
      const count = tx.prepare('SELECT COUNT(*) as count FROM transactions WHERE category_id = ?').get(params.id) as any
      if (count && count.count > 0) {
        throw new Error('Cannot delete category with transactions')
      }
      tx.prepare('DELETE FROM categories WHERE id = ?').run(params.id)
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Category delete error:', error)
    if (error.message === 'Cannot delete category with transactions') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
