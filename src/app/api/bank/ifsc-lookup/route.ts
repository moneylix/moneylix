import { NextRequest, NextResponse } from 'next/server'
import { lookupIFSC, IFSC_REGEX } from '@/lib/ifsc'

/**
 * GET /api/bank/ifsc-lookup?code=HDFC0000001
 *
 * Looks up bank name, branch, city and state for an IFSC code.
 * Used to live-preview bank details while the user types their IFSC code.
 */
export async function GET(request: NextRequest) {
  const code = (request.nextUrl.searchParams.get('code') || '').trim().toUpperCase()

  if (!IFSC_REGEX.test(code)) {
    return NextResponse.json({ error: 'Invalid IFSC code format' }, { status: 400 })
  }

  try {
    const details = await lookupIFSC(code)
    if (!details) {
      return NextResponse.json({ error: 'IFSC code not found' }, { status: 404 })
    }
    return NextResponse.json(details)
  } catch (err) {
    console.error('[bank/ifsc-lookup] Error:', err)
    return NextResponse.json({ error: 'Failed to look up IFSC code' }, { status: 502 })
  }
}
