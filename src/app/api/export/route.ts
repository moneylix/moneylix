import { NextResponse } from 'next/server'
import db from '@/lib/db.async'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }

    const transactions = await db.all('SELECT * FROM transactions WHERE business_id = ? ORDER BY date DESC, created_at DESC', [businessId]) as any[]
    const categories = await db.all('SELECT * FROM categories') as any[]

    const mappedTransactions = transactions.map(t => {
      const cat = categories.find(c => c.id === t.category_id)
      return {
        ...t,
        category_name: cat?.name || '',
        category_icon: cat?.icon || '',
        category_color: cat?.color || '',
      }
    })

    if (format === 'csv') {
      const headers = ['Date', 'Type', 'Amount', 'Category', 'Note', 'Method', 'Tags']
      const rows = mappedTransactions.map((t: any) => [
        t.date,
        t.type,
        t.amount,
        t.category_name,
        t.note || '',
        t.method || '',
        t.tags || '',
      ])
      
      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="transactions.csv"',
        },
      })
    }

    return NextResponse.json({ transactions: mappedTransactions })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
  }
}

