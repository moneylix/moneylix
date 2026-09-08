import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import crypto from 'crypto'
import { checkPermission, ROLE_DEFAULTS } from '@/lib/permissions'
import { resend } from '@/lib/email/resend'

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
 * GET /api/team?businessId=N
 * List all team members for a business.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const businessId = parseInt(searchParams.get('businessId') ?? '', 10)
    if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

    // Must be at least a member to list the team
    const biz = await db.get<{ user_id: number }>(
      'SELECT user_id FROM businesses WHERE id = ?',
      [businessId],
    )
    if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    const isOwner = biz.user_id === userId
    if (!isOwner) {
      const isMember = await db.get<{ id: number }>(
        "SELECT id FROM team_members WHERE business_id = ? AND user_id = ? AND invite_status = 'accepted'",
        [businessId, userId],
      )
      if (!isMember) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch members
    const members = await db.all<Record<string, unknown>>(
      `SELECT tm.id, tm.business_id, tm.user_id, tm.role, tm.invited_email,
              tm.invite_status, tm.permissions, tm.created_at, tm.updated_at,
              u.username, u.email AS user_email
       FROM team_members tm
       LEFT JOIN users u ON u.id = tm.user_id
       WHERE tm.business_id = ?
       ORDER BY tm.created_at ASC`,
      [businessId],
    )

    // Prepend owner as virtual row
    const owner = await db.get<{ id: number; username: string; email: string }>(
      'SELECT id, username, email FROM users WHERE id = ?',
      [biz.user_id],
    )

    const ownerRow = owner
      ? {
          id: 0,
          business_id: businessId,
          user_id: owner.id,
          role: 'owner',
          invited_email: null,
          invite_status: 'accepted',
          permissions: JSON.stringify(ROLE_DEFAULTS.owner),
          username: owner.username,
          user_email: owner.email,
          created_at: null,
          updated_at: null,
          is_owner: true,
        }
      : null

    return NextResponse.json({
      members: ownerRow ? [ownerRow, ...members] : members,
    })
  } catch (err) {
    console.error('Team GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 })
  }
}

/**
 * POST /api/team
 * Invite a team member.
 * Body: { businessId, email, role }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { businessId, email, role } = body

    if (!businessId || !email || !role) {
      return NextResponse.json({ error: 'businessId, email, and role are required' }, { status: 400 })
    }

    const validRoles = ['admin', 'accountant', 'staff', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be one of: ' + validRoles.join(', ') }, { status: 400 })
    }

    // Must have manage_team permission
    const canManage = await checkPermission(userId, businessId, 'can_manage_team')
    if (!canManage) {
      return NextResponse.json({ error: 'You do not have permission to manage team members' }, { status: 403 })
    }

    // Check if already invited
    const existing = await db.get<{ id: number }>(
      'SELECT id FROM team_members WHERE business_id = ? AND invited_email = ?',
      [businessId, email.toLowerCase()],
    )
    if (existing) {
      return NextResponse.json({ error: 'This email has already been invited to this business' }, { status: 409 })
    }

    // Check if user exists — if so, link directly
    const existingUser = await db.get<{ id: number }>(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()],
    )

    const inviteToken = crypto.randomBytes(32).toString('hex')
    const defaultPerms = JSON.stringify(ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.viewer)

    await db.run(
      `INSERT INTO team_members (business_id, user_id, role, invited_by, invited_email, invite_token, invite_status, permissions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        businessId,
        existingUser?.id ?? null,
        role,
        userId,
        email.toLowerCase(),
        inviteToken,
        'pending',
        defaultPerms,
      ],
    )

    // Get business name for email
    const biz = await db.get<{ name: string }>('SELECT name FROM businesses WHERE id = ?', [businessId])
    const inviter = await db.get<{ username: string }>('SELECT username FROM users WHERE id = ?', [userId])
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const inviteLink = `${appUrl}/api/team/invite/${inviteToken}`

    try {
      await resend.emails.send({
        from: 'Moneylix <noreply@moneylix.in>',
        to: email.toLowerCase(),
        subject: `You've been invited to ${biz?.name ?? 'a business'} on Moneylix`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #334155;">
            <h1 style="color: #84cc16; margin-bottom: 24px;">Team Invitation</h1>
            <p style="font-size: 16px; line-height: 1.5; color: #cbd5e1; margin-bottom: 32px;">
              <strong>${inviter?.username ?? 'Someone'}</strong> has invited you to join
              <strong>${biz?.name ?? 'their business'}</strong> on Moneylix as a <strong>${role}</strong>.
            </p>
            <a href="${inviteLink}" style="display: inline-block; background-color: #84cc16; color: #000; padding: 14px 28px; text-decoration: none; font-weight: 800; border-radius: 8px; font-size: 16px; margin-bottom: 32px;">
              Accept Invitation
            </a>
            <p style="font-size: 12px; color: #64748b;">
              If you don't have a Moneylix account, you'll be asked to create one first.
            </p>
          </div>
        `,
      })
    } catch (emailErr) {
      console.error('Failed to send invite email:', emailErr)
    }

    return NextResponse.json({ success: true, inviteToken })
  } catch (err) {
    console.error('Team POST error:', err)
    return NextResponse.json({ error: 'Failed to invite team member' }, { status: 500 })
  }
}
