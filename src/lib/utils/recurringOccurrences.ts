export interface RecurringRuleLike {
  id: number
  amount: number
  type: 'credit' | 'debit'
  note: string | null
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | string
  interval_value: number
  day_of_week: number | null
  day_of_month: number | null
  month_of_year: number | null
  next_run_date: string
  end_date: string | null
  status: string
}

export interface RecurringOccurrence {
  date: string
  rule: RecurringRuleLike
}

// Local-time date key — mirrors the same helper in the calendar page.
// Using Date#toISOString() here would round-trip through UTC and shift the
// range boundary a day off in any positive UTC-offset timezone.
function toLocalISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Mirrors advanceDate() in src/app/api/cron/process-recurring/route.ts —
 * that's the server-side step function the daily cron uses to move a rule's
 * next_run_date forward once it fires. Kept in lockstep with it so the
 * calendar's projected occurrences land on the same dates the cron will
 * actually use once it processes them.
 */
function advanceDate(
  currentDate: string,
  frequency: string,
  interval: number,
  dayOfMonth?: number | null
): string {
  const date = new Date(currentDate + 'T00:00:00')

  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + interval)
      break
    case 'weekly':
      date.setDate(date.getDate() + 7 * interval)
      break
    case 'monthly': {
      date.setMonth(date.getMonth() + interval)
      if (dayOfMonth) {
        const maxDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
        date.setDate(Math.min(dayOfMonth, maxDay))
      }
      break
    }
    case 'yearly': {
      date.setFullYear(date.getFullYear() + interval)
      if (dayOfMonth) {
        const maxDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
        date.setDate(Math.min(dayOfMonth, maxDay))
      }
      break
    }
  }

  return date.toISOString().split('T')[0]
}

/**
 * Projects an active recurring rule's upcoming occurrences within [rangeStart, rangeEnd],
 * walking forward from its stored next_run_date. Only ever looks forward — occurrences
 * before next_run_date have already posted as real transactions via the cron.
 */
export function projectOccurrences(
  rule: RecurringRuleLike,
  rangeStart: Date,
  rangeEnd: Date
): RecurringOccurrence[] {
  if (rule.status !== 'active') return []

  const rangeStartStr = toLocalISODate(rangeStart)
  const rangeEndStr = toLocalISODate(rangeEnd)

  const occurrences: RecurringOccurrence[] = []
  let cursor = rule.next_run_date
  const interval = rule.interval_value || 1
  let guard = 0

  while (cursor <= rangeEndStr && guard < 500) {
    guard++
    if (rule.end_date && cursor > rule.end_date) break
    if (cursor >= rangeStartStr) {
      occurrences.push({ date: cursor, rule })
    }
    cursor = advanceDate(cursor, rule.frequency, interval, rule.day_of_month)
  }

  return occurrences
}
