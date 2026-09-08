/**
 * Team Roles & Permissions helpers
 *
 * Each team member has a `role` and a JSON `permissions` blob that can
 * override the role defaults.  The helpers below resolve the effective
 * permission for a user within a given business.
 */

import db from '@/lib/db.async'

// ─── permission keys ────────────────────────────────────────────────────────

export interface TeamPermissions {
  can_add_transactions: boolean
  can_edit_transactions: boolean
  can_delete_transactions: boolean
  can_view_reports: boolean
  can_manage_invoices: boolean
  can_manage_settings: boolean
  can_manage_team: boolean
  can_view_bank: boolean
}

export type PermissionKey = keyof TeamPermissions

// ─── role defaults ──────────────────────────────────────────────────────────

export const ROLE_DEFAULTS: Record<string, TeamPermissions> = {
  owner: {
    can_add_transactions: true,
    can_edit_transactions: true,
    can_delete_transactions: true,
    can_view_reports: true,
    can_manage_invoices: true,
    can_manage_settings: true,
    can_manage_team: true,
    can_view_bank: true,
  },
  admin: {
    can_add_transactions: true,
    can_edit_transactions: true,
    can_delete_transactions: true,
    can_view_reports: true,
    can_manage_invoices: true,
    can_manage_settings: true,
    can_manage_team: false,
    can_view_bank: true,
  },
  accountant: {
    can_add_transactions: false,
    can_edit_transactions: false,
    can_delete_transactions: false,
    can_view_reports: true,
    can_manage_invoices: true,
    can_manage_settings: false,
    can_manage_team: false,
    can_view_bank: true,
  },
  staff: {
    can_add_transactions: true,
    can_edit_transactions: false,
    can_delete_transactions: false,
    can_view_reports: false,
    can_manage_invoices: false,
    can_manage_settings: false,
    can_manage_team: false,
    can_view_bank: false,
  },
  viewer: {
    can_add_transactions: false,
    can_edit_transactions: false,
    can_delete_transactions: false,
    can_view_reports: true,
    can_manage_invoices: false,
    can_manage_settings: false,
    can_manage_team: false,
    can_view_bank: false,
  },
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Return the effective permissions for a user in a business.
 * Falls back to role defaults, then overlays any per-member overrides.
 */
export function resolvePermissions(role: string, permissionsJson: string): TeamPermissions {
  const base = ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.viewer
  try {
    const overrides = JSON.parse(permissionsJson || '{}')
    return { ...base, ...overrides }
  } catch {
    return base
  }
}

/**
 * Check whether a user has a specific permission in a business.
 *
 * Business owners (from businesses.user_id) always have full access even
 * if no team_members row exists.
 */
export async function checkPermission(
  userId: number,
  businessId: number,
  permission: PermissionKey,
): Promise<boolean> {
  // Business owner always has full access
  const biz = await db.get<{ user_id: number }>(
    'SELECT user_id FROM businesses WHERE id = ?',
    [businessId],
  )
  if (biz?.user_id === userId) return true

  // Lookup team_members row
  const member = await db.get<{ role: string; permissions: string }>(
    "SELECT role, permissions FROM team_members WHERE business_id = ? AND user_id = ? AND invite_status = 'accepted'",
    [businessId, userId],
  )
  if (!member) return false

  const perms = resolvePermissions(member.role, member.permissions)
  return perms[permission]
}

/**
 * Return the role string for a user in a business, or null if not a member.
 */
export async function getUserBusinessRole(
  userId: number,
  businessId: number,
): Promise<string | null> {
  const biz = await db.get<{ user_id: number }>(
    'SELECT user_id FROM businesses WHERE id = ?',
    [businessId],
  )
  if (biz?.user_id === userId) return 'owner'

  const member = await db.get<{ role: string }>(
    "SELECT role FROM team_members WHERE business_id = ? AND user_id = ? AND invite_status = 'accepted'",
    [businessId, userId],
  )
  return member?.role ?? null
}

/**
 * Higher-order wrapper — returns 403 if the user lacks a permission.
 * Intended for use inside API route handlers.
 */
export async function requirePermission(
  userId: number,
  businessId: number,
  permission: PermissionKey,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const ok = await checkPermission(userId, businessId, permission)
  if (!ok) {
    return { allowed: false, reason: `Missing permission: ${permission}` }
  }
  return { allowed: true }
}
