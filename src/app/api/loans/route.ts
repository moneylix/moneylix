import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { calculateEMI, generateAmortizationSchedule } from '@/lib/emi'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await db.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token]
  )
  return session?.user_id ?? null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const status = searchParams.get('status')

    let sql = 'SELECT l.*, b.name as business_name FROM loans l LEFT JOIN businesses b ON b.id = l.business_id WHERE l.user_id = ?'
    const params: unknown[] = [userId]

    if (businessId) {
      sql += ' AND l.business_id = ?'
      params.push(parseInt(businessId))
    }
    if (status) {
      sql += ' AND l.status = ?'
      params.push(status)
    }

    sql += ' ORDER BY l.status ASC, l.created_at DESC'

    const loans = await db.all<Record<string, unknown>>(sql, params)

    return NextResponse.json({ loans })
  } catch (err) {
    console.error('Loans GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch loans' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      business_id,
      lender_name,
      loan_type = 'other',
      principal_amount,
      interest_rate,
      tenure_months,
      start_date,
      disbursement_date,
      notes,
    } = body

    if (!lender_name || !principal_amount || interest_rate === undefined || !tenure_months || !start_date) {
      return NextResponse.json({ error: 'Missing required fields: lender_name, principal_amount, interest_rate, tenure_months, start_date' }, { status: 400 })
    }

    const emi = calculateEMI(principal_amount, interest_rate, tenure_months)
    const schedule = generateAmortizationSchedule(principal_amount, interest_rate, tenure_months, start_date)
    const endDate = schedule.length > 0 ? schedule[schedule.length - 1].date : null
    const nextEmiDate = schedule.length > 0 ? schedule[0].date : null

    const result = await db.run(
      `INSERT INTO loans (user_id, business_id, lender_name, loan_type, principal_amount, interest_rate, tenure_months, emi_amount, start_date, end_date, disbursement_date, outstanding_balance, next_emi_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        business_id || null,
        lender_name,
        loan_type,
        principal_amount,
        interest_rate,
        tenure_months,
        emi,
        start_date,
        endDate,
        disbursement_date || null,
        principal_amount,
        nextEmiDate,
        notes || null,
      ]
    )

    const loanId = Number(result.lastInsertRowid)

    // Generate EMI payment entries
    for (const row of schedule) {
      await db.run(
        `INSERT INTO emi_payments (loan_id, payment_date, emi_number, principal_component, interest_component, total_amount, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [loanId, row.date, row.month, row.principal, row.interest, row.emiAmount]
      )
    }

    return NextResponse.json({ id: loanId, emi_amount: emi, schedule_count: schedule.length }, { status: 201 })
  } catch (err) {
    console.error('Loans POST error:', err)
    return NextResponse.json({ error: 'Failed to create loan' }, { status: 500 })
  }
}
