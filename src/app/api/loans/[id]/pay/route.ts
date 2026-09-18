import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await db.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token]
  )
  return session?.user_id ?? null
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const loanId = parseInt(params.id)
    const body = await request.json()
    const { emi_payment_id, create_transaction = false, payment_date } = body

    // Verify loan ownership
    const loan = await db.get<{
      id: number; user_id: number; business_id: number | null;
      outstanding_balance: number; total_interest_paid: number; total_principal_paid: number;
      emi_amount: number; tenure_months: number; status: string
    }>(
      'SELECT * FROM loans WHERE id = ? AND user_id = ?',
      [loanId, userId]
    )
    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    if (loan.status !== 'active') return NextResponse.json({ error: 'Loan is not active' }, { status: 400 })

    // Get the EMI payment entry
    const emiPayment = await db.get<{
      id: number; loan_id: number; principal_component: number;
      interest_component: number; total_amount: number; status: string; emi_number: number
    }>(
      'SELECT * FROM emi_payments WHERE id = ? AND loan_id = ?',
      [emi_payment_id, loanId]
    )
    if (!emiPayment) return NextResponse.json({ error: 'EMI payment entry not found' }, { status: 404 })
    if (emiPayment.status === 'paid') return NextResponse.json({ error: 'EMI already paid' }, { status: 400 })

    let transactionId: number | null = null

    // Optionally create a debit transaction for this payment
    if (create_transaction) {
      const txResult = await db.insert(
        `INSERT INTO transactions (type, amount, category_id, business_id, currency, date, note, method, status)
         VALUES ('debit', ?, (SELECT id FROM categories WHERE name = 'Miscellaneous' LIMIT 1), ?, 'INR', ?, ?, 'bank', 'completed')`,
        [
          emiPayment.total_amount,
          loan.business_id,
          payment_date || new Date().toISOString().split('T')[0],
          `EMI #${emiPayment.emi_number} - ${(await db.get<{lender_name: string}>('SELECT lender_name FROM loans WHERE id = ?', [loanId]))?.lender_name || 'Loan'}`,
        ]
      )
      transactionId = Number(txResult.lastInsertRowid)
    }

    // Mark EMI as paid
    await db.run(
      `UPDATE emi_payments SET status = 'paid', payment_date = ?, transaction_id = ? WHERE id = ?`,
      [
        payment_date || new Date().toISOString().split('T')[0],
        transactionId,
        emi_payment_id,
      ]
    )

    // Update loan outstanding balance and totals
    const principalPaid = emiPayment.principal_component || 0
    const interestPaid = emiPayment.interest_component || 0
    const newOutstanding = Math.max(0, (loan.outstanding_balance || 0) - principalPaid)

    // Find next pending EMI date
    const nextEmi = await db.get<{ payment_date: string }>(
      `SELECT payment_date FROM emi_payments WHERE loan_id = ? AND status = 'pending' ORDER BY emi_number ASC LIMIT 1`,
      [loanId]
    )

    // Check if all EMIs are paid
    const pendingCount = await db.get<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM emi_payments WHERE loan_id = ? AND status IN ('pending', 'overdue')`,
      [loanId]
    )

    const newStatus = (pendingCount?.cnt ?? 0) <= 1 && newOutstanding <= 0 ? 'closed' : 'active'

    await db.run(
      `UPDATE loans SET
        outstanding_balance = ?,
        total_interest_paid = total_interest_paid + ?,
        total_principal_paid = total_principal_paid + ?,
        next_emi_date = ?,
        status = ?,
        updated_at = datetime('now')
       WHERE id = ?`,
      [
        newOutstanding,
        interestPaid,
        principalPaid,
        nextEmi?.payment_date || null,
        newStatus,
        loanId,
      ]
    )

    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      outstanding_balance: newOutstanding,
      loan_status: newStatus,
    })
  } catch (err) {
    console.error('Loan pay error:', err)
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
  }
}
