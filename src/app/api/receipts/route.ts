import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db.async'
import fs from 'fs'
import path from 'path'

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const session = await db.get<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
    [token]
  )
  return session?.user_id ?? null
}

/** Simple regex-based extraction helpers for OCR text */
function extractAmountFromText(text: string): number | null {
  // Match patterns like ₹1,234.56, Rs. 1234, Rs 1234.00, 1,234.56, Total: 1234
  const patterns = [
    /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:total|amount|grand\s*total|net\s*amount|balance\s*due)[:\s]*([\d,]+(?:\.\d{1,2})?)/i,
    /\b([\d,]{3,}(?:\.\d{1,2})?)\b/,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const val = parseFloat(match[1].replace(/,/g, ''))
      if (!isNaN(val) && val > 0 && val < 10000000) return val
    }
  }
  return null
}

function extractDateFromText(text: string): string | null {
  // Match patterns like 01/09/2026, 01-Sep-2026, September 1, 2026, 2026-09-01
  const patterns = [
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i,
    /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const d = new Date(match[1])
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0]
      }
      // Try DD/MM/YYYY
      const parts = match[1].split(/[\/\-]/)
      if (parts.length === 3) {
        const year = parts[2].length === 2 ? '20' + parts[2] : parts[2]
        const d2 = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`)
        if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0]
      }
    }
  }
  return null
}

function extractVendorFromText(text: string): string | null {
  // First non-empty line is usually the vendor/store name
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 2 && l.length < 80)
  if (lines.length > 0) return lines[0]
  return null
}

/**
 * GET /api/receipts
 * List receipts for the authenticated user.
 * Query params: businessId, status, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    let sql = `SELECT r.*, t.amount as tx_amount, t.date as tx_date, t.note as tx_note
               FROM receipts r
               LEFT JOIN transactions t ON t.id = r.transaction_id
               WHERE r.user_id = ?`
    const params: unknown[] = [userId]

    if (businessId) {
      sql += ' AND r.business_id = ?'
      params.push(parseInt(businessId, 10))
    }
    if (status) {
      sql += ' AND r.status = ?'
      params.push(status)
    }

    const countSql = sql.replace(/SELECT r\.\*.*?FROM/, 'SELECT COUNT(*) as total FROM')
    const countRow = await db.get<{ total: number }>(countSql, params)
    const total = countRow?.total ?? 0

    sql += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const receipts = await db.all<Record<string, unknown>>(sql, params)

    return NextResponse.json({ receipts, total, limit, offset })
  } catch (err) {
    console.error('Receipts GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch receipts' }, { status: 500 })
  }
}

/**
 * POST /api/receipts
 * Upload a receipt image, run OCR extraction, and attempt auto-match.
 * Expects multipart/form-data with fields: file (image), businessId (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const businessId = formData.get('businessId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only image files (JPEG, PNG, WebP, GIF) are accepted' }, { status: 400 })
    }

    // Save to disk
    const uploadsDir = path.join(process.cwd(), 'uploads', 'receipts', String(userId))
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `receipt_${Date.now()}.${ext}`
    const filePath = path.join(uploadsDir, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(filePath, buffer)

    const relativeFilePath = `uploads/receipts/${userId}/${filename}`

    // Attempt OCR with Tesseract.js (dynamic import to avoid build issues if not installed)
    let ocrText = ''
    let ocrAmount: number | null = null
    let ocrDate: string | null = null
    let ocrVendor: string | null = null

    try {
      const Tesseract = await import('tesseract.js')
      // Tesseract's worker can stall indefinitely (slow model download, worker-thread
      // issues) with no error of its own — race it against a timeout so a stuck OCR
      // run degrades to "receipt saved without OCR" instead of hanging the request.
      const recognize = Tesseract.recognize(filePath, 'eng')
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OCR timed out after 25s')), 25000)
      )
      const { data } = await Promise.race([recognize, timeout])
      ocrText = data.text || ''
      ocrAmount = extractAmountFromText(ocrText)
      ocrDate = extractDateFromText(ocrText)
      ocrVendor = extractVendorFromText(ocrText)
    } catch (ocrErr) {
      console.warn('OCR processing failed (Tesseract not available, timed out, or error):', ocrErr)
      // OCR is optional — receipt is still saved
    }

    // Attempt auto-match: find a transaction with similar amount and date
    let matchedTransactionId: number | null = null
    let matchStatus: 'processing' | 'matched' | 'unmatched' = 'unmatched'

    if (ocrAmount) {
      const tolerance = ocrAmount * 0.05 // 5% tolerance
      const minAmt = ocrAmount - tolerance
      const maxAmt = ocrAmount + tolerance

      let matchSql = `SELECT id FROM transactions WHERE business_id IN (SELECT id FROM businesses WHERE user_id = ?) AND type = 'debit'
                       AND amount BETWEEN ? AND ? AND id NOT IN (SELECT transaction_id FROM receipts WHERE transaction_id IS NOT NULL)`
      const matchParams: unknown[] = [userId, minAmt, maxAmt]

      if (ocrDate) {
        matchSql += " AND date BETWEEN date(?, '-2 days') AND date(?, '+2 days')"
        matchParams.push(ocrDate, ocrDate)
      }

      if (businessId) {
        matchSql += ' AND business_id = ?'
        matchParams.push(parseInt(businessId, 10))
      }

      matchSql += ' ORDER BY ABS(amount - ?) ASC LIMIT 1'
      matchParams.push(ocrAmount)

      const match = await db.get<{ id: number }>(matchSql, matchParams)
      if (match) {
        matchedTransactionId = match.id
        matchStatus = 'matched'
      }
    }

    if (!ocrText && !ocrAmount) {
      matchStatus = 'processing' // OCR failed, still processing
    }

    const result = await db.insert(
      `INSERT INTO receipts (user_id, business_id, transaction_id, file_path, ocr_text, ocr_amount, ocr_date, ocr_vendor, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        businessId ? parseInt(businessId, 10) : null,
        matchedTransactionId,
        relativeFilePath,
        ocrText || null,
        ocrAmount,
        ocrDate,
        ocrVendor,
        matchStatus,
      ]
    )

    const newReceipt = await db.get<Record<string, unknown>>(
      'SELECT * FROM receipts WHERE id = ?',
      [result.lastInsertRowid]
    )

    return NextResponse.json({
      receipt: newReceipt,
      ocr: { text: ocrText, amount: ocrAmount, date: ocrDate, vendor: ocrVendor },
      matched: matchedTransactionId !== null,
    }, { status: 201 })
  } catch (err) {
    console.error('Receipts POST error:', err)
    return NextResponse.json({ error: 'Failed to upload receipt' }, { status: 500 })
  }
}
