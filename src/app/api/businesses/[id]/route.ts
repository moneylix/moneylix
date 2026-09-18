import { NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { toPgQuery } from '@/lib/db.postgres'
import { businessSchema } from '@/lib/schemas'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const validation = businessSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const { name } = validation.data
    const updated = await db.transaction(async (tx) => {
      await tx.query(toPgQuery('UPDATE businesses SET name = ? WHERE id = ?'), [name.trim(), params.id])
      const result = await tx.query(toPgQuery('SELECT * FROM businesses WHERE id = ?'), [params.id])
      return result.rows[0]
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update business:', error)
    return NextResponse.json({ error: 'Failed to update business' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    await db.transaction(async (tx) => {
      const countResult = await tx.query(toPgQuery('SELECT COUNT(*) as c FROM businesses'), [])
      const count = Number(countResult.rows[0]?.c ?? 0)
      if (count <= 1) {
        throw new Error('Cannot delete the last business')
      }
      await tx.query(toPgQuery('DELETE FROM transactions WHERE business_id = ?'), [id])
      await tx.query(toPgQuery('DELETE FROM businesses WHERE id = ?'), [id])
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete business:', error)
    if (error.message === 'Cannot delete the last business') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to delete business' }, { status: 500 })
  }
}
