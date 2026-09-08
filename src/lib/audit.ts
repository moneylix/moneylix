import { NextRequest } from 'next/server'
import dbQuery from '@/lib/db.async'

export type AuditCategory = 'bank_sync' | 'auth' | 'data_access' | 'admin' | 'general'
export type AuditStatus = 'success' | 'failure' | 'pending'

interface AuditLogEntry {
  userId?: number | null
  action: string
  category?: AuditCategory
  resourceType?: string
  resourceId?: string | number
  description?: string
  metadata?: Record<string, unknown>
  status?: AuditStatus
  errorMessage?: string
  request?: NextRequest
}

/**
 * Write an audit log entry.
 * 
 * Usage:
 *   audit({ userId: 1, action: 'DATA_FETCHED', category: 'bank_sync', description: 'Fetched 42 transactions', request })
 *   audit({ action: 'LOGIN_FAILED', category: 'auth', status: 'failure', errorMessage: 'Invalid password' })
 */
export async function audit(entry: AuditLogEntry): Promise<void> {
  try {
    const ip = entry.request?.headers.get('x-forwarded-for')
      || entry.request?.headers.get('x-real-ip')
      || null
    const userAgent = entry.request?.headers.get('user-agent') || null

    await dbQuery.run(
      `INSERT INTO audit_logs (
        user_id, action, category, resource_type, resource_id,
        description, metadata, status, error_message, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId ?? null,
        entry.action,
        entry.category || 'general',
        entry.resourceType || null,
        entry.resourceId ? String(entry.resourceId) : null,
        entry.description || null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.status || 'success',
        entry.errorMessage || null,
        ip,
        userAgent,
      ]
    )
  } catch (err) {
    // Never let audit logging break the main flow
    console.error('[audit] Failed to write log:', err)
  }
}

/**
 * Standard audit actions for bank sync compliance
 */
export const AUDIT_ACTIONS = {
  // Bank sync
  CONSENT_CREATED: 'CONSENT_CREATED',
  CONSENT_APPROVED: 'CONSENT_APPROVED',
  CONSENT_REVOKED: 'CONSENT_REVOKED',
  CONSENT_EXPIRED: 'CONSENT_EXPIRED',
  DATA_FETCH_REQUESTED: 'DATA_FETCH_REQUESTED',
  DATA_FETCHED: 'DATA_FETCHED',
  DATA_CATEGORISED: 'DATA_CATEGORISED',
  BANK_DISCONNECTED: 'BANK_DISCONNECTED',

  // Auth
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  ACCOUNT_DELETED: 'ACCOUNT_DELETED',

  // Data access
  DATA_EXPORTED: 'DATA_EXPORTED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',

  // Admin
  ADMIN_LOGIN: 'ADMIN_LOGIN',
  ADMIN_ACTION: 'ADMIN_ACTION',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_UNSUSPENDED: 'USER_UNSUSPENDED',
  USER_DELETED_BY_ADMIN: 'USER_DELETED_BY_ADMIN',
  USER_DATA_VIEWED_BY_ADMIN: 'USER_DATA_VIEWED_BY_ADMIN',
} as const
