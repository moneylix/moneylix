import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { verifyPassword } from '@/lib/auth/password'
import { audit, AUDIT_ACTIONS } from '@/lib/audit'

/**
 * DELETE /api/user/delete-account
 * Permanently deletes the authenticated user's account and all associated data.
 * Requires password confirmation for security.
 * 
 * Body: { password: string }
 * 
 * DPDP Act compliance:
 * - Deletes all personal data (user, sessions, businesses, transactions, categories, subscriptions)
 * - Cascade delete handles all related records via foreign keys
 * - No residual personal data remains after deletion
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify session
    const session = await dbQuery.get<{ user_id: number }>(
      "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
      [token]
    )
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user_id

    // Get user to verify password
    const user = await dbQuery.get<{ id: number; password: string; role: string }>(
      'SELECT id, password, role FROM users WHERE id = ?',
      [userId]
    )
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent admin deletion via this endpoint
    if (user.role === 'admin') {
      return NextResponse.json(
        { error: 'Admin accounts cannot be deleted via this endpoint' },
        { status: 403 }
      )
    }

    // Parse body and verify password
    const body = await request.json()
    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required to confirm account deletion' },
        { status: 400 }
      )
    }

    const passwordValid = await verifyPassword(password, user.password)
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Incorrect password. Account deletion cancelled.' },
        { status: 403 }
      )
    }

    // Delete user — CASCADE will handle:
    // - sessions
    // - businesses (which cascades to transactions)
    // - subscriptions
    // - email_verifications
    // - password_resets
    // Also clean up user_settings and any orphaned categories
    await dbQuery.transaction((db) => {
      // Explicitly delete all user data in dependency order
      // (CASCADE should handle most of this, but explicit is safer for SQLite)
      const businesses = db.prepare('SELECT id FROM businesses WHERE user_id = ?').all(userId) as { id: number }[]
      const bizIds = businesses.map(b => b.id)
      
      if (bizIds.length > 0) {
        const placeholders = bizIds.map(() => '?').join(',')
        db.prepare(`DELETE FROM transactions WHERE business_id IN (${placeholders})`).run(...bizIds)
      }

      // Delete bank sync data
      db.prepare('DELETE FROM bank_transactions WHERE user_id = ?').run(userId)
      db.prepare('DELETE FROM bank_connections WHERE user_id = ?').run(userId)

      db.prepare('DELETE FROM businesses WHERE user_id = ?').run(userId)
      db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(userId)

      // Delete the user (CASCADE handles the rest)
      db.prepare('DELETE FROM users WHERE id = ?').run(userId)
    })

    audit({
      userId,
      action: AUDIT_ACTIONS.ACCOUNT_DELETED,
      category: 'auth',
      resourceType: 'user',
      resourceId: userId,
      description: 'User permanently deleted their account and all data',
      request,
    })

    return NextResponse.json({
      success: true,
      message: 'Your account and all associated data have been permanently deleted.',
    })
  } catch (err) {
    console.error('Delete account error:', err)
    return NextResponse.json(
      { error: 'Failed to delete account. Please try again.' },
      { status: 500 }
    )
  }
}
