/**
 * Internal Cron Scheduler for Moneylix
 * 
 * Runs notification checks, recurring transaction processing, and subscription
 * expiry checks on a configurable interval.
 * 
 * This module auto-starts when the server boots (imported from layout or middleware).
 * In production, you can also use an external scheduler (Upstash QStash, crontab)
 * hitting the /api/cron/* endpoints directly.
 * 
 * Schedule:
 *   - Every 6 hours:  check-notifications (low balance, due dates, unusual spend, budgets)
 *   - Every 1 hour:   process-recurring (create transactions from recurring rules)
 *   - Every 24 hours: expire-subscriptions
 *   - Every 24 hours: backup-database (SQLite only — no-ops once DATABASE_URL/Postgres is set)
 */

let schedulerStarted = false

interface CronJob {
  name: string
  endpoint: string
  intervalMs: number
  timerId?: ReturnType<typeof setInterval>
  lastRun?: Date
  lastStatus?: 'ok' | 'error'
}

const jobs: CronJob[] = [
  {
    name: 'check-notifications',
    endpoint: '/api/cron/check-notifications',
    intervalMs: 6 * 60 * 60 * 1000, // 6 hours
  },
  {
    name: 'process-recurring',
    endpoint: '/api/cron/process-recurring',
    intervalMs: 1 * 60 * 60 * 1000, // 1 hour
  },
  {
    name: 'expire-subscriptions',
    endpoint: '/api/cron/expire-subscriptions',
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
  },
  {
    name: 'backup-database',
    endpoint: '/api/cron/backup-database',
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
  },
]

async function runJob(job: CronJob): Promise<void> {
  // Always call the server's own local port, never the public domain -
  // this is a server-to-itself call, and depending on NEXT_PUBLIC_APP_URL
  // made it fragile during infra migrations: when that env var pointed at
  // www.moneylix.in while DNS still resolved to the old Proxmox server,
  // these requests silently hit that unrelated old server instead of
  // this one, 404-ing on any route that didn't exist in whatever older
  // code was running there.
  const baseUrl = `http://localhost:${process.env.PORT || 3006}`
  const cronSecret = process.env.CRON_SECRET || ''

  try {
    const url = new URL(job.endpoint, baseUrl)
    if (cronSecret) url.searchParams.set('secret', cronSecret)

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'User-Agent': 'Moneylix-Internal-Cron/1.0' },
      signal: AbortSignal.timeout(30000), // 30s timeout
    })

    job.lastRun = new Date()

    if (res.ok) {
      job.lastStatus = 'ok'
      const data = await res.json().catch(() => ({}))
      console.log(`[cron] ✓ ${job.name} completed`, data.stats ? JSON.stringify(data.stats) : '')
    } else {
      job.lastStatus = 'error'
      console.error(`[cron] ✗ ${job.name} failed with status ${res.status}`)
    }
  } catch (err) {
    job.lastStatus = 'error'
    console.error(`[cron] ✗ ${job.name} error:`, err instanceof Error ? err.message : err)
  }
}

/**
 * Start the internal cron scheduler.
 * Safe to call multiple times — only starts once.
 * 
 * Usage: import { startScheduler } from '@/lib/scheduler'
 *        startScheduler()
 */
export function startScheduler(): void {
  if (schedulerStarted) return
  schedulerStarted = true

  // Don't run during build (next build) or in edge runtime
  if (typeof setInterval === 'undefined') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  console.log('[cron] Starting internal scheduler with', jobs.length, 'jobs')

  for (const job of jobs) {
    // Run once after a short delay (30s after boot) to let the server warm up
    setTimeout(() => {
      runJob(job)
    }, 30000)

    // Then run on interval
    job.timerId = setInterval(() => {
      runJob(job)
    }, job.intervalMs)

    const hours = Math.round(job.intervalMs / (60 * 60 * 1000))
    console.log(`[cron]   → ${job.name}: every ${hours}h`)
  }
}

/**
 * Stop all cron jobs. Useful for graceful shutdown.
 */
export function stopScheduler(): void {
  for (const job of jobs) {
    if (job.timerId) {
      clearInterval(job.timerId)
      job.timerId = undefined
    }
  }
  schedulerStarted = false
  console.log('[cron] Scheduler stopped')
}

/**
 * Get current scheduler status.
 */
export function getSchedulerStatus(): { running: boolean; jobs: Array<{ name: string; lastRun?: Date; lastStatus?: string; intervalHours: number }> } {
  return {
    running: schedulerStarted,
    jobs: jobs.map(j => ({
      name: j.name,
      lastRun: j.lastRun,
      lastStatus: j.lastStatus,
      intervalHours: Math.round(j.intervalMs / (60 * 60 * 1000)),
    })),
  }
}
