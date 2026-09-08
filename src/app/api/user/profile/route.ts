import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { hashPassword, verifyPassword } from '@/lib/auth/password'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await dbQuery.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token]
  )
  return session?.user_id ?? null
}

/**
 * GET /api/user/profile
 * Returns the user's profile info (username, email, created_at, plan)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await dbQuery.get<{
      id: number
      username: string
      email: string
      created_at: string
    }>(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [userId]
    )

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Get active plan
    const sub = await dbQuery.get<{ plan: string; status: string; expires_at: string | null }>(
      "SELECT plan, status, expires_at FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [userId]
    )

    return NextResponse.json({
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.created_at,
      plan: sub?.plan || 'free',
      planStatus: sub?.status || 'active',
      planExpires: sub?.expires_at || null,
    })
  } catch (err) {
    console.error('Profile GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

/**
 * PATCH /api/user/profile
 * Update profile fields. Supports:
 *   - { username: "newname" }
 *   - { email: "new@email.com" }
 *   - { currentPassword: "...", newPassword: "..." }
 * 
 * Each field is updated independently.
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { username, email, currentPassword, newPassword } = body

    const user = await dbQuery.get<{ id: number; username: string; email: string; password: string }>(
      'SELECT id, username, email, password FROM users WHERE id = ?',
      [userId]
    )
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const updates: string[] = []
    const params: unknown[] = []

    // Update username
    if (username && username !== user.username) {
      if (username.length < 3 || username.length > 30) {
        return NextResponse.json({ error: 'Username must be 3-30 characters' }, { status: 400 })
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return NextResponse.json({ error: 'Username can only contain letters, numbers, and underscores' }, { status: 400 })
      }
      // Check uniqueness
      const existing = await dbQuery.get<{ id: number }>(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, userId]
      )
      if (existing) {
        return NextResponse.json({ error: 'Username is already taken' }, { status: 409 })
      }
      updates.push('username = ?')
      params.push(username)
    }

    // Update email
    if (email && email !== user.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
      }
      // Check uniqueness
      const existing = await dbQuery.get<{ id: number }>(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      )
      if (existing) {
        return NextResponse.json({ error: 'Email is already in use' }, { status: 409 })
      }
      updates.push('email = ?')
      params.push(email)
    }

    // Change password
    if (currentPassword && newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
      }

      // Verify current password
      const passwordOk = await verifyPassword(currentPassword, user.password)
      if (!passwordOk) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 })
      }

      const hashed = await hashPassword(newPassword)
      updates.push('password = ?')
      params.push(hashed)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }

    // Apply updates
    params.push(userId)
    await dbQuery.run(
      `UPDATE users SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      params
    )

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
    })
  } catch (err) {
    console.error('Profile PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
