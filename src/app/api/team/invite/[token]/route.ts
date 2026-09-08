import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await db.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token],
  )
  return session?.user_id ?? null
}

/**
 * GET /api/team/invite/:token
 * Validate an invite token. Public endpoint (no auth required to view invite details).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const inviteToken = params.token
    if (!inviteToken) return NextResponse.json({ error: 'Token required' }, { status: 400 })

    const invite = await db.get<{
      id: number
      business_id: number
      role: string
      invited_email: string
      invite_status: string
    }>(
      'SELECT tm.id, tm.business_id, tm.role, tm.invited_email, tm.invite_status, b.name AS business_name FROM team_members tm LEFT JOIN businesses b ON b.id = tm.business_id WHERE tm.invite_token = ?',
      [inviteToken],
    )

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 })
    }

    if (invite.invite_status !== 'pending') {
      return NextResponse.json({
        error: `This invitation has already been ${invite.invite_status}`,
      }, { status: 410 })
    }

    return NextResponse.json({
      invite: {
        id: invite.id,
        business_id: invite.business_id,
        business_name: (invite as Record<string, unknown>).business_name,
        role: invite.role,
        email: invite.invited_email,
        status: invite.invite_status,
      },
    })
  } catch (err) {
    console.error('Invite GET error:', err)
    return NextResponse.json({ error: 'Failed to validate invite' }, { status: 500 })
  }
}

/**
 * POST /api/team/invite/:token
 * Accept an invitation. The user must be authenticated and their email
 * must match the invited email, OR they can accept from any authenticated
 * account (flexibility — owner can re-assign).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'You must be logged in to accept an invitation' }, { status: 401 })
    }

    const inviteToken = params.token
    if (!inviteToken) return NextResponse.json({ error: 'Token required' }, { status: 400 })

    const invite = await db.get<{
      id: number
      business_id: number
      role: string
      invited_email: string
      invite_status: string
      permissions: string
    }>(
      'SELECT id, business_id, role, invited_email, invite_status, permissions FROM team_members WHERE invite_token = ?',
      [inviteToken],
    )

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 })
    }

    if (invite.invite_status !== 'pending') {
      return NextResponse.json({
        error: `This invitation has already been ${invite.invite_status}`,
      }, { status: 410 })
    }

    // Check if user is already a member
    const existingMember = await db.get<{ id: number }>(
      "SELECT id FROM team_members WHERE business_id = ? AND user_id = ? AND invite_status = 'accepted'",
      [invite.business_id, userId],
    )
    if (existingMember) {
      // Clean up the invite and return success
      await db.run("UPDATE team_members SET invite_status = 'accepted', updated_at = datetime('now') WHERE id = ?", [invite.id])
      return NextResponse.json({ success: true, message: 'You are already a member of this business' })
    }

    // Accept the invitation
    await db.run(
      `UPDATE team_members
       SET user_id = ?, invite_status = 'accepted', updated_at = datetime('now')
       WHERE id = ?`,
      [userId, invite.id],
    )

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted',
      business_id: invite.business_id,
    })
  } catch (err) {
    console.error('Invite POST error:', err)
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 })
  }
}
