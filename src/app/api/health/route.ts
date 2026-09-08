import { NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'

const startedAt = Date.now()

export async function GET() {
  let dbOk = false
  try {
    await dbQuery.get<{ n: number }>('SELECT 1 AS n')
    dbOk = true
  } catch { /* db unreachable */ }

  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000)

  return NextResponse.json({
    status: dbOk ? 'ok' : 'degraded',
    version: process.env.npm_package_version ?? '0.0.0',
    uptime: uptimeSeconds,
    db: dbOk ? 'connected' : 'error',
    timestamp: new Date().toISOString(),
  }, { status: dbOk ? 200 : 503 })
}
