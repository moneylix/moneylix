import { NextRequest } from 'next/server'
import db from '@/lib/db.async'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  // Also check query param for direct browser tab opens
  const urlToken = new URL(request.url).searchParams.get('token') ?? ''
  const sessionToken = token || urlToken
  if (!sessionToken) return null
  const session = await db.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [sessionToken]
  )
  return session?.user_id ?? null
}

const currencySymbols: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥',
  CAD: 'C$', AUD: 'A$', CHF: 'Fr', CNY: '¥', MXN: '$',
}

function fmtAmount(amount: number, currency: string): string {
  const sym = currencySymbols[currency] || currency + ' '
  return `${sym}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function escHtml(str: string | null | undefined): string {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * GET /api/invoices/[id]/pdf
 *
 * Returns a standalone, print-ready HTML page for the invoice.
 * Open in a new browser tab, then Ctrl+P / Cmd+P to save as PDF.
 *
 * Auth: Bearer token in header OR ?token= query param (for window.open from frontend).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return new Response('<h1>Unauthorized</h1>', {
        status: 401,
        headers: { 'Content-Type': 'text/html' },
      })
    }

    const invoiceId = parseInt(params.id, 10)
    if (isNaN(invoiceId)) {
      return new Response('<h1>Invalid invoice ID</h1>', {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      })
    }

    const invoice = await db.get<Record<string, unknown>>(
      'SELECT * FROM invoices WHERE id = ? AND user_id = ?',
      [invoiceId, userId]
    )
    if (!invoice) {
      return new Response('<h1>Invoice not found</h1>', {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      })
    }

    const settings = await db.get<Record<string, unknown>>(
      'SELECT * FROM invoice_settings WHERE user_id = ?',
      [userId]
    )

    // Parse JSON fields
    const items: Array<{ description: string; quantity: number; rate: number; amount: number }> =
      typeof invoice.items === 'string' ? JSON.parse(invoice.items as string) : (invoice.items as any) || []

    let gstBreakdown: { cgst?: number; sgst?: number; igst?: number; cess?: number } | null = null
    if (invoice.gst_breakdown) {
      try {
        gstBreakdown = typeof invoice.gst_breakdown === 'string'
          ? JSON.parse(invoice.gst_breakdown as string)
          : (invoice.gst_breakdown as any)
      } catch { /* ignore */ }
    }

    const cur = (invoice.currency as string) || 'INR'
    const businessName = escHtml(settings?.business_name as string) || 'Business'
    const businessAddress = escHtml(settings?.address as string)
    const businessEmail = escHtml(settings?.email as string)
    const businessPhone = escHtml(settings?.phone as string)
    const bankDetails = escHtml(settings?.bank_details as string)

    const clientName = escHtml(invoice.client_name as string)
    const clientEmail = escHtml(invoice.client_email as string)
    const clientAddress = escHtml(invoice.client_address as string)

    const invoiceNumber = escHtml(invoice.invoice_number as string)
    const createdDate = new Date(invoice.created_at as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const dueDate = invoice.due_date
      ? new Date(invoice.due_date as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : null
    const paidDate = invoice.paid_date
      ? new Date(invoice.paid_date as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : null

    const subtotal = Number(invoice.subtotal) || 0
    const taxRate = Number(invoice.tax_rate) || 0
    const taxAmount = Number(invoice.tax_amount) || 0
    const discountAmount = Number(invoice.discount_amount) || 0
    const total = Number(invoice.total) || 0
    const paidAmount = Number(invoice.paid_amount) || 0
    const status = (invoice.status as string) || 'draft'
    const notes = escHtml(invoice.notes as string)
    const terms = escHtml(invoice.terms as string)
    const gstin = escHtml(invoice.gstin as string)

    // Build items rows
    const itemsHtml = items
      .map(
        (item, i) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#374151;">${i + 1}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#374151;">${escHtml(item.description)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#6b7280;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#6b7280;font-family:'JetBrains Mono',monospace;">${fmtAmount(item.rate, cur)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#111827;font-family:'JetBrains Mono',monospace;">${fmtAmount(item.amount, cur)}</td>
      </tr>`
      )
      .join('\n')

    // Status badge
    const statusColors: Record<string, { bg: string; color: string }> = {
      draft: { bg: '#f5f5f5', color: '#525252' },
      sent: { bg: '#dbeafe', color: '#1d4ed8' },
      viewed: { bg: '#cffafe', color: '#0e7490' },
      paid: { bg: '#ecfccb', color: '#4d7c0f' },
      overdue: { bg: '#ffe4e6', color: '#be123c' },
      cancelled: { bg: '#f5f5f5', color: '#a3a3a3' },
    }
    const sc = statusColors[status] || statusColors.draft

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${escHtml(invoiceNumber)} — ${businessName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #111827;
      background: #f8fafc;
      padding: 32px;
    }

    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      overflow: hidden;
    }

    .header {
      padding: 40px 40px 0;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .brand h1 {
      font-size: 22px;
      font-weight: 900;
      color: #111827;
      margin-bottom: 6px;
    }

    .brand p {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.5;
    }

    .invoice-meta {
      text-align: right;
    }

    .invoice-number {
      font-size: 28px;
      font-weight: 900;
      color: #111827;
      letter-spacing: -0.5px;
    }

    .invoice-meta p {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 3px;
    }

    .status-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 12px;
      border-radius: 999px;
      margin-top: 8px;
    }

    .divider {
      height: 1px;
      background: #f0f0f0;
      margin: 28px 40px;
    }

    .bill-to {
      padding: 0 40px;
    }

    .section-label {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #9ca3af;
      margin-bottom: 6px;
    }

    .bill-to h3 {
      font-size: 15px;
      font-weight: 700;
      color: #111827;
    }

    .bill-to p {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.5;
    }

    .items-table {
      margin: 28px 40px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead th {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #9ca3af;
      padding: 10px 12px;
      border-bottom: 2px solid #e5e7eb;
      text-align: left;
    }

    thead th.right { text-align: right; }

    .totals {
      padding: 0 40px;
      display: flex;
      justify-content: flex-end;
    }

    .totals-box {
      width: 280px;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
      color: #6b7280;
    }

    .totals-row span:last-child {
      font-family: 'JetBrains Mono', monospace;
    }

    .totals-row.total {
      border-top: 2px solid #e5e7eb;
      padding-top: 10px;
      margin-top: 6px;
      font-size: 16px;
      font-weight: 900;
      color: #111827;
    }

    .totals-row.paid {
      color: #4d7c0f;
      font-weight: 700;
    }

    .footer-section {
      padding: 28px 40px;
    }

    .footer-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    .footer-section h4 {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #9ca3af;
      margin-bottom: 6px;
    }

    .footer-section p {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.6;
      white-space: pre-line;
    }

    .print-bar {
      text-align: center;
      padding: 20px;
    }

    .print-bar button {
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 700;
      padding: 10px 32px;
      border: none;
      border-radius: 10px;
      background: #a3e635;
      color: #111827;
      cursor: pointer;
    }

    .print-bar button:hover { background: #84cc16; }

    .gst-row {
      font-size: 12px;
      color: #6b7280;
    }

    .watermark {
      text-align: center;
      padding: 16px;
      font-size: 10px;
      color: #d1d5db;
    }

    @media print {
      body {
        background: #fff;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .invoice-container {
        box-shadow: none;
        border-radius: 0;
        max-width: 100%;
      }

      .print-bar { display: none; }
      .watermark { display: none; }

      @page {
        margin: 12mm;
        size: A4;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>

  <div class="invoice-container">
    <!-- Header -->
    <div class="header">
      <div class="brand">
        <h1>${businessName}</h1>
        ${businessAddress ? `<p>${businessAddress.replace(/\n/g, '<br/>')}</p>` : ''}
        ${businessEmail ? `<p>${businessEmail}</p>` : ''}
        ${businessPhone ? `<p>${businessPhone}</p>` : ''}
        ${gstin ? `<p style="margin-top:4px;font-weight:600;">GSTIN: ${gstin}</p>` : ''}
      </div>
      <div class="invoice-meta">
        <div class="invoice-number">${invoiceNumber}</div>
        <p>Date: ${createdDate}</p>
        ${dueDate ? `<p>Due: ${dueDate}</p>` : ''}
        ${paidDate ? `<p>Paid: ${paidDate}</p>` : ''}
        <span class="status-badge" style="background:${sc.bg};color:${sc.color};">
          ${status.toUpperCase()}
        </span>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Bill To -->
    <div class="bill-to">
      <div class="section-label">Bill To</div>
      <h3>${clientName}</h3>
      ${clientEmail ? `<p>${clientEmail}</p>` : ''}
      ${clientAddress ? `<p>${clientAddress.replace(/\n/g, '<br/>')}</p>` : ''}
    </div>

    <!-- Items Table -->
    <div class="items-table">
      <table>
        <thead>
          <tr>
            <th style="width:40px;">#</th>
            <th>Description</th>
            <th class="right" style="width:60px;">Qty</th>
            <th class="right" style="width:110px;">Rate</th>
            <th class="right" style="width:120px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div class="totals">
      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>${fmtAmount(subtotal, cur)}</span>
        </div>
        ${taxRate > 0 ? `
        <div class="totals-row">
          <span>Tax (${taxRate}%)</span>
          <span>${fmtAmount(taxAmount, cur)}</span>
        </div>` : ''}
        ${gstBreakdown ? `
          ${gstBreakdown.cgst ? `<div class="totals-row gst-row"><span>CGST</span><span>${fmtAmount(gstBreakdown.cgst, cur)}</span></div>` : ''}
          ${gstBreakdown.sgst ? `<div class="totals-row gst-row"><span>SGST</span><span>${fmtAmount(gstBreakdown.sgst, cur)}</span></div>` : ''}
          ${gstBreakdown.igst ? `<div class="totals-row gst-row"><span>IGST</span><span>${fmtAmount(gstBreakdown.igst, cur)}</span></div>` : ''}
          ${gstBreakdown.cess ? `<div class="totals-row gst-row"><span>Cess</span><span>${fmtAmount(gstBreakdown.cess, cur)}</span></div>` : ''}
        ` : ''}
        ${discountAmount > 0 ? `
        <div class="totals-row">
          <span>Discount</span>
          <span>-${fmtAmount(discountAmount, cur)}</span>
        </div>` : ''}
        <div class="totals-row total">
          <span>Total</span>
          <span>${fmtAmount(total, cur)}</span>
        </div>
        ${status === 'paid' ? `
        <div class="totals-row paid">
          <span>Amount Paid</span>
          <span>${fmtAmount(paidAmount || total, cur)}</span>
        </div>` : ''}
      </div>
    </div>

    ${notes || terms ? `
    <div class="divider"></div>
    <div class="footer-section">
      <div class="footer-grid">
        ${notes ? `<div><h4>Notes</h4><p>${notes.replace(/\n/g, '<br/>')}</p></div>` : '<div></div>'}
        ${terms ? `<div><h4>Terms & Conditions</h4><p>${terms.replace(/\n/g, '<br/>')}</p></div>` : '<div></div>'}
      </div>
    </div>` : ''}

    ${bankDetails ? `
    <div class="divider"></div>
    <div class="footer-section">
      <h4>Bank Details</h4>
      <p>${bankDetails.replace(/\n/g, '<br/>')}</p>
    </div>` : ''}

    <div class="watermark">
      Generated by Moneylix — moneylix.in
    </div>
  </div>
</body>
</html>`

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('Invoice PDF error:', err)
    return new Response('<h1>Failed to generate invoice</h1>', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }
}
