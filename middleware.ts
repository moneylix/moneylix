import { NextRequest, NextResponse } from 'next/server'

// In-memory store: key → [timestamps]
// Works per-process; good enough for single-instance dev/prod on SQLite.
const hits = new Map<string, number[]>()

function rateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now()
  const window = 60_000
  const timestamps = (hits.get(key) ?? []).filter(t => now - t < window)
  timestamps.push(now)
  hits.set(key, timestamps)
  return timestamps.length <= maxPerMinute
}

// Periodic cleanup so the map doesn't grow unbounded
let lastCleanup = Date.now()
function maybeCleanup() {
  if (Date.now() - lastCleanup < 5 * 60_000) return
  lastCleanup = Date.now()
  const cutoff = Date.now() - 60_000
  Array.from(hits.entries()).forEach(([key, times]) => {
    const fresh = times.filter(t => t > cutoff)
    if (fresh.length === 0) hits.delete(key)
    else hits.set(key, fresh)
  })
}

export function middleware(request: NextRequest) {
  maybeCleanup()

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  const { pathname } = request.nextUrl

  let limit = 0
  if (pathname.startsWith('/api/auth/')) limit = 10
  else if (pathname === '/api/admin/login') limit = 10
  else if (pathname.startsWith('/api/ai-')) limit = 20

  if (limit > 0) {
    const key = `${ip}:${pathname}`
    if (!rateLimit(key, limit)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': '60' },
        }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/auth/:path*', '/api/admin/login', '/api/ai-:path*'],
}
