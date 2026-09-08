import db from '@/lib/db.async'
import { resend } from '@/lib/email/resend'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'low_balance'
  | 'due_date'
  | 'unusual_spend'
  | 'tax_deadline'
  | 'budget_alert'
  | 'system'

export interface CreateNotificationOpts {
  businessId?: number | null
  actionUrl?: string
  metadata?: Record<string, unknown>
}

interface NotificationRow {
  id: number
  user_id: number
  business_id: number | null
  type: string
  title: string
  message: string
  is_read: number
  action_url: string | null
  metadata: string | null
  created_at: string
}

interface UserRow {
  id: number
  email: string
  username: string
}

interface PreferenceRow {
  email_enabled: number
  push_enabled: number
}

// ─── Create a notification ────────────────────────────────────────────────────

export async function createNotification(
  userId: number,
  type: NotificationType,
  title: string,
  message: string,
  opts?: CreateNotificationOpts
): Promise<number> {
  const result = await db.run(
    `INSERT INTO notifications (user_id, business_id, type, title, message, action_url, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      opts?.businessId ?? null,
      type,
      title,
      message,
      opts?.actionUrl ?? null,
      opts?.metadata ? JSON.stringify(opts.metadata) : null,
    ]
  )
  return Number(result.lastInsertRowid)
}

// ─── Send notification email ──────────────────────────────────────────────────

export async function sendNotificationEmail(
  userId: number,
  notification: { type: string; title: string; message: string; action_url?: string | null }
): Promise<void> {
  const pref = await db.get<PreferenceRow>(
    'SELECT email_enabled FROM notification_preferences WHERE user_id = ? AND notification_type = ?',
    [userId, notification.type]
  )
  // Default is enabled; only skip when explicitly disabled
  if (pref && pref.email_enabled === 0) return

  const user = await db.get<UserRow>('SELECT email, username FROM users WHERE id = ?', [userId])
  if (!user || !user.email) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const actionLink = notification.action_url
    ? `${appUrl}${notification.action_url}`
    : `${appUrl}/dashboard/notifications`

  try {
    await resend.emails.send({
      from: 'Moneylix <noreply@moneylix.in>',
      to: user.email,
      subject: `Moneylix Alert: ${notification.title}`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #334155;">
          <h1 style="color: #38bdf8; margin-bottom: 24px;">${notification.title}</h1>
          <p style="font-size: 16px; line-height: 1.5; color: #cbd5e1; margin-bottom: 32px;">
            ${notification.message}
          </p>
          <a href="${actionLink}" style="display: inline-block; background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; font-weight: 800; border-radius: 8px; font-size: 16px;">
            View Details
          </a>
        </div>
      `,
    })
  } catch (err) {
    console.error('[notifications] Failed to send email:', err)
  }
}

// ─── Check low balance ────────────────────────────────────────────────────────
// Triggers when current balance < 20% of average monthly income

export async function checkLowBalance(
  userId: number,
  businessId: number,
  thresholdPercent: number = 20
): Promise<boolean> {
  // Monthly average income over last 3 months
  const avgRow = await db.get<{ avg_income: number }>(
    `SELECT COALESCE(AVG(monthly_total), 0) as avg_income FROM (
       SELECT SUM(amount) as monthly_total
       FROM transactions
       WHERE business_id = ? AND type = 'credit' AND status = 'completed'
         AND date >= date('now', '-3 months')
       GROUP BY strftime('%Y-%m', date)
     )`,
    [businessId]
  )
  const avgIncome = avgRow?.avg_income ?? 0
  if (avgIncome === 0) return false

  // Current balance
  const balRow = await db.get<{ balance: number }>(
    `SELECT COALESCE(
       (SELECT SUM(amount) FROM transactions WHERE business_id = ? AND type = 'credit' AND status = 'completed'),
       0
     ) - COALESCE(
       (SELECT SUM(amount) FROM transactions WHERE business_id = ? AND type = 'debit' AND status = 'completed'),
       0
     ) as balance`,
    [businessId, businessId]
  )
  const balance = balRow?.balance ?? 0
  const threshold = avgIncome * (thresholdPercent / 100)

  if (balance < threshold) {
    // Check we haven't already notified in the last 24 hours
    const recent = await db.get<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM notifications
       WHERE user_id = ? AND business_id = ? AND type = 'low_balance'
         AND created_at > datetime('now', '-1 day')`,
      [userId, businessId]
    )
    if (recent && recent.cnt > 0) return false

    const bizRow = await db.get<{ name: string }>('SELECT name FROM businesses WHERE id = ?', [businessId])
    const bizName = bizRow?.name ?? 'your business'

    await createNotification(
      userId,
      'low_balance',
      'Low Balance Alert',
      `Your balance in "${bizName}" is ₹${Math.round(balance).toLocaleString()}, which is below 20% of your average monthly income (₹${Math.round(avgIncome).toLocaleString()}).`,
      {
        businessId,
        actionUrl: '/dashboard',
        metadata: { balance, avgIncome, threshold },
      }
    )
    await sendNotificationEmail(userId, {
      type: 'low_balance',
      title: 'Low Balance Alert',
      message: `Your balance in "${bizName}" is ₹${Math.round(balance).toLocaleString()}.`,
      action_url: '/dashboard',
    })
    return true
  }
  return false
}

// ─── Check upcoming due dates (receivables) ──────────────────────────────────
// Fires for pending transactions with due_date within 3 days

export async function checkUpcomingDues(userId: number): Promise<number> {
  const dues = await db.all<{
    id: number
    client_name: string | null
    amount: number
    due_date: string
    business_id: number | null
    note: string | null
  }>(
    `SELECT id, client_name, amount, due_date, business_id, note
     FROM transactions
     WHERE status = 'pending'
       AND due_date IS NOT NULL
       AND due_date BETWEEN date('now') AND date('now', '+3 days')
       AND business_id IN (SELECT id FROM businesses WHERE user_id = ?)`,
    [userId]
  )

  let created = 0
  for (const due of dues) {
    // Don't duplicate within same day for same transaction
    const existing = await db.get<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM notifications
       WHERE user_id = ? AND type = 'due_date'
         AND json_extract(metadata, '$.transaction_id') = ?
         AND created_at > datetime('now', '-1 day')`,
      [userId, due.id]
    )
    if (existing && existing.cnt > 0) continue

    const clientLabel = due.client_name || due.note || 'a client'
    const daysLeft = Math.ceil(
      (new Date(due.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    const urgency = daysLeft <= 0 ? 'is overdue' : daysLeft === 1 ? 'is due tomorrow' : `is due in ${daysLeft} days`

    await createNotification(
      userId,
      'due_date',
      'Upcoming Payment Due',
      `₹${Math.round(due.amount).toLocaleString()} from ${clientLabel} ${urgency}.`,
      {
        businessId: due.business_id,
        actionUrl: '/dashboard/receivables',
        metadata: { transaction_id: due.id, due_date: due.due_date, amount: due.amount },
      }
    )
    created++
  }

  return created
}

// ─── Check unusual spending ──────────────────────────────────────────────────
// Fires when any category's spend this month exceeds 150% of its 3-month average

export async function checkUnusualSpend(
  userId: number,
  businessId: number
): Promise<number> {
  const rows = await db.all<{
    category_id: number
    category_name: string
    current_spend: number
    avg_spend: number
  }>(
    `SELECT
       c.id as category_id,
       c.name as category_name,
       COALESCE(cur.total, 0) as current_spend,
       COALESCE(hist.avg_total, 0) as avg_spend
     FROM categories c
     LEFT JOIN (
       SELECT category_id, SUM(amount) as total
       FROM transactions
       WHERE business_id = ? AND type = 'debit' AND status = 'completed'
         AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
       GROUP BY category_id
     ) cur ON cur.category_id = c.id
     LEFT JOIN (
       SELECT category_id, AVG(monthly_total) as avg_total FROM (
         SELECT category_id, SUM(amount) as monthly_total
         FROM transactions
         WHERE business_id = ? AND type = 'debit' AND status = 'completed'
           AND date >= date('now', '-3 months')
           AND strftime('%Y-%m', date) != strftime('%Y-%m', 'now')
         GROUP BY category_id, strftime('%Y-%m', date)
       ) GROUP BY category_id
     ) hist ON hist.category_id = c.id
     WHERE cur.total > 0 AND hist.avg_total > 0
       AND cur.total > hist.avg_total * 1.5`,
    [businessId, businessId]
  )

  let created = 0
  for (const row of rows) {
    const existing = await db.get<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM notifications
       WHERE user_id = ? AND business_id = ? AND type = 'unusual_spend'
         AND json_extract(metadata, '$.category_id') = ?
         AND created_at > datetime('now', '-7 days')`,
      [userId, businessId, row.category_id]
    )
    if (existing && existing.cnt > 0) continue

    const pct = Math.round((row.current_spend / row.avg_spend) * 100)
    const bizRow = await db.get<{ name: string }>('SELECT name FROM businesses WHERE id = ?', [businessId])
    const bizName = bizRow?.name ?? 'your business'

    await createNotification(
      userId,
      'unusual_spend',
      'Unusual Spending Detected',
      `"${row.category_name}" spending in "${bizName}" is ₹${Math.round(row.current_spend).toLocaleString()} this month — ${pct}% of the 3-month average (₹${Math.round(row.avg_spend).toLocaleString()}).`,
      {
        businessId,
        actionUrl: '/dashboard/transactions',
        metadata: {
          category_id: row.category_id,
          category_name: row.category_name,
          current_spend: row.current_spend,
          avg_spend: row.avg_spend,
          percent: pct,
        },
      }
    )
    created++
  }

  return created
}
