import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    if (!businessId) return NextResponse.json({ error: 'businessId is required' }, { status: 400 })

    const text = await request.text()
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return NextResponse.json({ error: 'CSV must have header + at least one row' }, { status: 400 })

    // Parse header — support flexible column names
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())

    const col = (names: string[]) => {
      for (const n of names) {
        const i = headers.indexOf(n)
        if (i !== -1) return i
      }
      return -1
    }

    const dateIdx   = col(['date'])
    const typeIdx   = col(['type'])
    const amountIdx = col(['amount'])
    const noteIdx   = col(['note', 'description', 'memo'])
    const methodIdx = col(['method', 'payment method', 'payment_method'])
    const tagsIdx   = col(['tags'])
    const catIdx    = col(['category', 'category_name'])

    if (dateIdx === -1 || typeIdx === -1 || amountIdx === -1) {
      return NextResponse.json({ error: 'CSV must have columns: date, type, amount' }, { status: 400 })
    }

    const categories = await dbQuery.all<{ id: number; name: string }>('SELECT id, name FROM categories')
    const now = new Date().toISOString()
    let imported = 0
    let skipped = 0

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map(c => c.replace(/"/g, '').trim())

      const date   = cells[dateIdx] ?? ''
      const type   = cells[typeIdx]?.toLowerCase() ?? ''
      const amount = parseFloat(cells[amountIdx] ?? '0')
      const note   = noteIdx !== -1 ? (cells[noteIdx] ?? '') : ''
      const method = methodIdx !== -1 ? (cells[methodIdx] ?? '') : ''
      const tags   = tagsIdx !== -1 ? (cells[tagsIdx] ?? '') : ''
      const catName = catIdx !== -1 ? (cells[catIdx] ?? '') : ''

      if (!date || !['credit', 'debit'].includes(type) || isNaN(amount) || amount <= 0) {
        skipped++
        continue
      }

      const category = categories.find(c => c.name.toLowerCase() === catName.toLowerCase())

      await dbQuery.run(
        `INSERT INTO transactions
           (type, amount, category_id, business_id, currency, date, note, method, tags, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'INR', ?, ?, ?, ?, 'completed', ?, ?)`,
        [
          type, amount, category?.id ?? null, parseInt(businessId),
          date, note || null, method || null, tags || null, now, now,
        ]
      )
      imported++
    }

    return NextResponse.json({ success: true, imported, skipped })
  } catch (err) {
    console.error('Import error:', err)
    return NextResponse.json({ error: 'Failed to import CSV' }, { status: 500 })
  }
}
