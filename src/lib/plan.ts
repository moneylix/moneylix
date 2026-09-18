/**
 * Server-side plan checks — for API routes that need to enforce a feature
 * gate beyond what the client-side PlanContext hides in the UI. The client
 * check alone is only a UI convenience; anyone can still call the API
 * directly, so routes gating a real Enterprise-only capability (advanced
 * tax estimates, Tally export) must check here too.
 */
import dbQuery from '@/lib/db.async'

export type Plan = 'free' | 'pro' | 'premium' | 'enterprise'

const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, premium: 2, enterprise: 3 }

function isValidPlan(v: unknown): v is Plan {
  return v === 'free' || v === 'pro' || v === 'premium' || v === 'enterprise'
}

/**
 * Look up a user's current active plan by their session token.
 * Returns 'free' if there's no active subscription row, matching the
 * default every other part of the app already assumes.
 */
export async function getPlanForToken(token: string | null): Promise<{ userId: number; plan: Plan } | null> {
  if (!token) return null

  const session = await dbQuery.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token]
  )
  if (!session) return null

  const sub = await dbQuery.get<{ plan: string }>(
    "SELECT plan FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    [session.user_id]
  )

  return { userId: session.user_id, plan: isValidPlan(sub?.plan) ? sub!.plan : 'free' }
}

/** True if `plan` meets or exceeds `minPlan` in the free < pro < premium < enterprise order. */
export function planAtLeast(plan: Plan, minPlan: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minPlan]
}

/**
 * Look up a user's current active plan when the route has already resolved
 * userId itself (most routes do their own session lookup) — avoids querying
 * the sessions table a second time.
 */
export async function getPlanForUserId(userId: number): Promise<Plan> {
  const sub = await dbQuery.get<{ plan: string }>(
    "SELECT plan FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    [userId]
  )
  return isValidPlan(sub?.plan) ? sub!.plan : 'free'
}
