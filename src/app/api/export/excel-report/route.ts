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

interface TxnRow {
  id: number
  type: string
  amount: number
  currency: string
  date: string
  due_date: string | null
  note: string | null
  method: string | null
  tags: string | null
  status: string
  client_name: string | null
  category_name: string | null
  business_name: string | null
  created_at: string
}

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * GET /api/export/excel-report?businessId=N&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Generate a comprehensive multi-section CSV report containing:
 *   Section 1: All Transactions
 *   Section 2: Category Summary
 *   Section 3: Monthly Summary
 *   Section 4: GST Summary
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!businessId) return NextResponse.json({ error: 'businessId is required' }, { status: 400 })

    const bizId = parseInt(businessId, 10)
    let dateFilter = ''
    const params: unknown[] = [bizId]

    if (startDate) { dateFilter += ' AND t.date >= ?'; params.push(startDate) }
    if (endDate) { dateFilter += ' AND t.date <= ?'; params.push(endDate) }

    // Business name
    const business = await db.get<{ name: string }>('SELECT name FROM businesses WHERE id = ?', [bizId])
    const bizName = business?.name ?? 'Business'

    // GST settings
    const gstSettings = await db.get<{ default_tax_rate: number }>(
      'SELECT default_tax_rate FROM gst_settings WHERE user_id = ? AND business_id = ?',
      [userId, bizId],
    )
    const taxRate = gstSettings?.default_tax_rate ?? 18

    // ─── Section 1: All Transactions ───
    const transactions = await db.all<TxnRow>(
      `SELECT t.id, t.type, t.amount, t.currency, t.date, t.due_date, t.note, t.method, t.tags, t.status, t.client_name, t.created_at,
              c.name as category_name, b.name as business_name
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN businesses b ON b.id = t.business_id
       WHERE t.business_id = ? AND t.status = 'completed'${dateFilter}
       ORDER BY t.date ASC`,
      params,
    )

    const lines: string[] = []

    // Report header
    lines.push(`"MONEYLIX FINANCIAL REPORT"`)
    lines.push(`"Business","${escapeCsv(bizName)}"`)
    lines.push(`"Period","${startDate ?? 'All time'} to ${endDate ?? 'Present'}"`)
    lines.push(`"Generated","${new Date().toISOString()}"`)
    lines.push(`"Total Transactions","${transactions.length}"`)
    lines.push('')

    // Section 1 header
    lines.push('"=== TRANSACTIONS ==="')
    lines.push('ID,Date,Type,Amount,Currency,Category,Method,Client,Note,Tags,Due Date')

    for (const txn of transactions) {
      lines.push([
        escapeCsv(txn.id),
        escapeCsv(txn.date),
        escapeCsv(txn.type),
        escapeCsv(txn.amount),
        escapeCsv(txn.currency),
        escapeCsv(txn.category_name),
        escapeCsv(txn.method),
        escapeCsv(txn.client_name),
        escapeCsv(txn.note),
        escapeCsv(txn.tags),
        escapeCsv(txn.due_date),
      ].join(','))
    }

    // ─── Section 2: Category Summary ───
    const categorySummary = await db.all<{ category_name: string; type: string; total: number; count: number }>(
      `SELECT c.name as category_name, t.type, COALESCE(SUM(t.amount), 0) as total, COUNT(*) as count
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.business_id = ? AND t.status = 'completed'${dateFilter}
       GROUP BY c.name, t.type
       ORDER BY t.type ASC, total DESC`,
      params,
    )

    lines.push('')
    lines.push('"=== CATEGORY SUMMARY ==="')
    lines.push('Category,Type,Total Amount,Transaction Count')

    for (const cat of categorySummary) {
      lines.push([
        escapeCsv(cat.category_name),
        escapeCsv(cat.type),
        escapeCsv(round2(cat.total)),
        escapeCsv(cat.count),
      ].join(','))
    }

    // ─── Section 3: Monthly Summary ───
    const monthlySummary = await db.all<{ month: string; type: string; total: number; count: number }>(
      `SELECT strftime('%Y-%m', date) as month, type, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM transactions
       WHERE business_id = ? AND status = 'completed'${dateFilter.replace(/t\./g, '')}
       GROUP BY month, type
       ORDER BY month ASC`,
      params,
    )

    const monthMap = new Map<string, { income: number; expense: number; income_count: number; expense_count: number }>()
    for (const row of monthlySummary) {
      if (!monthMap.has(row.month)) {
        monthMap.set(row.month, { income: 0, expense: 0, income_count: 0, expense_count: 0 })
      }
      const entry = monthMap.get(row.month)!
      if (row.type === 'credit') {
        entry.income = row.total
        entry.income_count = row.count
      } else {
        entry.expense = row.total
        entry.expense_count = row.count
      }
    }

    lines.push('')
    lines.push('"=== MONTHLY SUMMARY ==="')
    lines.push('Month,Income,Expense,Net Profit,Income Txns,Expense Txns')

    let grandIncome = 0
    let grandExpense = 0
    for (const [month, data] of Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const net = round2(data.income - data.expense)
      grandIncome += data.income
      grandExpense += data.expense
      lines.push([
        escapeCsv(month),
        escapeCsv(round2(data.income)),
        escapeCsv(round2(data.expense)),
        escapeCsv(net),
        escapeCsv(data.income_count),
        escapeCsv(data.expense_count),
      ].join(','))
    }

    lines.push([
      '"TOTAL"',
      escapeCsv(round2(grandIncome)),
      escapeCsv(round2(grandExpense)),
      escapeCsv(round2(grandIncome - grandExpense)),
      '',
      '',
    ].join(','))

    // ─── Section 4: GST Summary ───
    const gstCollected = round2(grandIncome * taxRate / (100 + taxRate))
    const gstPaid = round2(grandExpense * taxRate / (100 + taxRate))
    const netGST = round2(gstCollected - gstPaid)

    lines.push('')
    lines.push('"=== GST SUMMARY ==="')
    lines.push(`"Tax Rate","${taxRate}%"`)
    lines.push(`"GST Collected (Output Tax)","${gstCollected}"`)
    lines.push(`"GST Paid (Input Tax)","${gstPaid}"`)
    lines.push(`"Net GST ${netGST >= 0 ? 'Payable' : 'Receivable'}","${Math.abs(netGST)}"`)

    // ─── Section 5: P&L Summary ───
    lines.push('')
    lines.push('"=== PROFIT & LOSS SUMMARY ==="')
    lines.push(`"Total Income","${round2(grandIncome)}"`)
    lines.push(`"Total Expense","${round2(grandExpense)}"`)
    lines.push(`"Net Profit / (Loss)","${round2(grandIncome - grandExpense)}"`)
    if (grandIncome > 0) {
      lines.push(`"Profit Margin","${round2(((grandIncome - grandExpense) / grandIncome) * 100)}%"`)
    }

    const csv = lines.join('\n')
    const fileName = `financial_report_${bizName.replace(/\s+/g, '_')}_${startDate ?? 'all'}_${endDate ?? 'all'}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err) {
    console.error('Excel report export error:', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
