import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import bcrypt from 'bcryptjs'
import { requireAdmin } from '../_auth'

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentPassword, newPassword } = await request.json()
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Both fields are required' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
  }

  const row = await dbQuery.get<{ password: string }>('SELECT password FROM users WHERE id = ?', [admin.id])
  if (!row) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Support both bcrypt and legacy base64
  let valid = false
  if (row.password.startsWith('$2')) {
    valid = await bcrypt.compare(currentPassword, row.password)
  } else {
    valid = row.password === Buffer.from(currentPassword).toString('base64')
  }
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

  const newHash = await bcrypt.hash(newPassword, 12)
  await dbQuery.run('UPDATE users SET password = ? WHERE id = ?', [newHash, admin.id])

  return NextResponse.json({ success: true })
}
