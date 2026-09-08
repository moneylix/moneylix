import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { requireAdmin } from '../../_auth'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (admin.id === parseInt(params.id)) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })

  await dbQuery.run("DELETE FROM users WHERE id = ? AND role = 'admin'", [params.id])
  return NextResponse.json({ success: true })
}
