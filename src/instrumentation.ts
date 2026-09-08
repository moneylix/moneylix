/**
 * Next.js Instrumentation Hook
 * 
 * This file runs once when the Next.js server starts.
 * Used to start the internal cron scheduler for notifications,
 * recurring transactions, and subscription expiry.
 * 
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the server side (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('@/lib/scheduler')
    startScheduler()
  }
}
