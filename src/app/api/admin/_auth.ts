import { NextRequest } from 'next/server'
import dbQuery from '@/lib/db.async'

export interface AdminUser {
  id: number
  username: string
  email: string
}

export async function requireAdmin(request: NextRequest): Promise<AdminUser | null> {
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null

  return await dbQuery.get<AdminUser>(
    `SELECT u.id, u.username, u.email FROM users u
     JOIN sessions s ON s.user_id = u.id
     WHERE s.token = ? AND u.role = 'admin' AND s.expires_at > datetime('now')`,
    [token]
  )
}
