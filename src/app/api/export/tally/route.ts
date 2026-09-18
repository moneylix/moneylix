import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import { getPlanForUserId, planAtLeast } from '@/lib/plan'

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
  type: 'credit' | 'debit'
  amount: number
  currency: string
  date: string
  note: string | null
  method: string | null
  tags: string | null
  status: string
  client_name: string | null
  category_name: string
  business_name: string
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatTallyDate(dateStr: string): string {
  // Tally uses YYYYMMDD format
  return dateStr.replace(/-/g, '')
}

/**
 * GET /api/export/tally?businessId=N&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Export transactions in Tally-compatible XML voucher format.
 * Returns an XML file download.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const plan = await getPlanForUserId(userId)
    if (!planAtLeast(plan, 'enterprise')) {
      return NextResponse.json(
        { error: 'Tally-compatible export is an Enterprise plan feature.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!businessId) return NextResponse.json({ error: 'businessId is required' }, { status: 400 })

    let dateFilter = ''
    const params: unknown[] = [parseInt(businessId, 10)]

    if (startDate) {
      dateFilter += ' AND t.date >= ?'
      params.push(startDate)
    }
    if (endDate) {
      dateFilter += ' AND t.date <= ?'
      params.push(endDate)
    }

    const transactions = await db.all<TxnRow>(
      `SELECT t.id, t.type, t.amount, t.currency, t.date, t.note, t.method, t.tags, t.status, t.client_name,
              c.name as category_name, b.name as business_name
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN businesses b ON b.id = t.business_id
       WHERE t.business_id = ? AND t.status = 'completed'${dateFilter}
       ORDER BY t.date ASC`,
      params,
    )

    // Get business name for company tag
    const business = await db.get<{ name: string }>(
      'SELECT name FROM businesses WHERE id = ?',
      [parseInt(businessId, 10)],
    )
    const companyName = business?.name ?? 'Moneylix Business'

    // Build Tally XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<ENVELOPE>\n'
    xml += '  <HEADER>\n'
    xml += '    <TALLYREQUEST>Import Data</TALLYREQUEST>\n'
    xml += '  </HEADER>\n'
    xml += '  <BODY>\n'
    xml += '    <IMPORTDATA>\n'
    xml += '      <REQUESTDESC>\n'
    xml += '        <REPORTNAME>Vouchers</REPORTNAME>\n'
    xml += `        <STATICVARIABLES>\n`
    xml += `          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>\n`
    xml += `        </STATICVARIABLES>\n`
    xml += '      </REQUESTDESC>\n'
    xml += '      <REQUESTDATA>\n'

    for (const txn of transactions) {
      const voucherType = txn.type === 'credit' ? 'Receipt' : 'Payment'
      const tallyDate = formatTallyDate(txn.date)
      const narration = [txn.note, txn.client_name, txn.tags].filter(Boolean).join(' | ')
      const ledgerName = txn.category_name || (txn.type === 'credit' ? 'Income' : 'Expense')
      const cashLedger = txn.method === 'bank' || txn.method === 'Bank Transfer'
        ? 'Bank Account'
        : txn.method === 'upi' || txn.method === 'UPI'
          ? 'UPI Account'
          : 'Cash'

      xml += '        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n'
      xml += `          <VOUCHER VCHTYPE="${voucherType}" ACTION="Create">\n`
      xml += `            <DATE>${tallyDate}</DATE>\n`
      xml += `            <VOUCHERTYPENAME>${voucherType}</VOUCHERTYPENAME>\n`
      xml += `            <VOUCHERNUMBER>${txn.id}</VOUCHERNUMBER>\n`
      xml += `            <NARRATION>${escapeXml(narration)}</NARRATION>\n`

      if (txn.type === 'credit') {
        // Receipt: Debit Cash/Bank, Credit Income ledger
        xml += '            <ALLLEDGERENTRIES.LIST>\n'
        xml += `              <LEDGERNAME>${escapeXml(cashLedger)}</LEDGERNAME>\n`
        xml += `              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`
        xml += `              <AMOUNT>-${txn.amount.toFixed(2)}</AMOUNT>\n`
        xml += '            </ALLLEDGERENTRIES.LIST>\n'
        xml += '            <ALLLEDGERENTRIES.LIST>\n'
        xml += `              <LEDGERNAME>${escapeXml(ledgerName)}</LEDGERNAME>\n`
        xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`
        xml += `              <AMOUNT>${txn.amount.toFixed(2)}</AMOUNT>\n`
        xml += '            </ALLLEDGERENTRIES.LIST>\n'
      } else {
        // Payment: Debit Expense ledger, Credit Cash/Bank
        xml += '            <ALLLEDGERENTRIES.LIST>\n'
        xml += `              <LEDGERNAME>${escapeXml(ledgerName)}</LEDGERNAME>\n`
        xml += `              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`
        xml += `              <AMOUNT>-${txn.amount.toFixed(2)}</AMOUNT>\n`
        xml += '            </ALLLEDGERENTRIES.LIST>\n'
        xml += '            <ALLLEDGERENTRIES.LIST>\n'
        xml += `              <LEDGERNAME>${escapeXml(cashLedger)}</LEDGERNAME>\n`
        xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`
        xml += `              <AMOUNT>${txn.amount.toFixed(2)}</AMOUNT>\n`
        xml += '            </ALLLEDGERENTRIES.LIST>\n'
      }

      xml += '          </VOUCHER>\n'
      xml += '        </TALLYMESSAGE>\n'
    }

    xml += '      </REQUESTDATA>\n'
    xml += '    </IMPORTDATA>\n'
    xml += '  </BODY>\n'
    xml += '</ENVELOPE>\n'

    const fileName = `tally_export_${companyName.replace(/\s+/g, '_')}_${startDate ?? 'all'}_${endDate ?? 'all'}.xml`

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err) {
    console.error('Tally export error:', err)
    return NextResponse.json({ error: 'Failed to generate Tally export' }, { status: 500 })
  }
}
