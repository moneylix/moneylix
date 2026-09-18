import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'
import { toPgQuery } from '@/lib/db.postgres'

export async function GET() {
  try {
    const currencies = await dbQuery.all('SELECT * FROM currencies')
    const defaultCurrencySetting = await dbQuery.get('SELECT value FROM settings WHERE key = ?', ['defaultCurrency'])
    
    return NextResponse.json({
      currencies,
      defaultCurrency: defaultCurrencySetting?.value || 'USD'
    })
  } catch (error) {
    console.error('Error fetching currencies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch currencies' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { defaultCurrency } = await request.json()
    
    if (!defaultCurrency) {
      return NextResponse.json(
        { error: 'defaultCurrency is required' },
        { status: 400 }
      )
    }
    
    const setting = await dbQuery.transaction(async (tx) => {
      await tx.query(toPgQuery('UPDATE settings SET value = ? WHERE key = ?'), [defaultCurrency, 'defaultCurrency'])
      const result = await tx.query(toPgQuery('SELECT value FROM settings WHERE key = ?'), ['defaultCurrency'])
      return result.rows[0] as any
    })
    return NextResponse.json({
      success: true,
      defaultCurrency: setting?.value || defaultCurrency
    })
  } catch (error) {
    console.error('Error updating currency:', error)
    return NextResponse.json(
      { error: 'Failed to update currency' },
      { status: 500 }
    )
  }
}
