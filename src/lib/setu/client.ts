/**
 * Setu Account Aggregator (AA) Client
 * 
 * Setu API docs: https://docs.setu.co/data/account-aggregator
 * 
 * Environment variables required:
 *   SETU_CLIENT_ID       — From Setu dashboard
 *   SETU_CLIENT_SECRET   — From Setu dashboard
 *   SETU_AA_BASE_URL     — "https://aa-sandbox.setu.co" (sandbox) or "https://aa.setu.co" (production)
 *   SETU_FIU_ID          — Your FIU (Financial Information User) ID
 *   NEXT_PUBLIC_APP_URL  — e.g., "https://moneylix.in" (for redirect URLs)
 */

const SETU_BASE_URL = process.env.SETU_AA_BASE_URL || 'https://aa-sandbox.setu.co'
const SETU_CLIENT_ID = process.env.SETU_CLIENT_ID || ''
const SETU_CLIENT_SECRET = process.env.SETU_CLIENT_SECRET || ''
const SETU_FIU_ID = process.env.SETU_FIU_ID || ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://moneylix.in'

interface SetuTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

interface SetuConsentResponse {
  id: string
  url: string
  status: string
}

interface SetuDataResponse {
  status: string
  fipId: string
  data: Array<{
    transactionId: string
    type: 'CREDIT' | 'DEBIT'
    amount: number
    currentBalance: number
    transactionTimestamp: string
    narration: string
    reference: string
  }>
}

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Get access token from Setu (client credentials flow)
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token
  }

  const res = await fetch(`${SETU_BASE_URL}/api/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientID: SETU_CLIENT_ID,
      secret: SETU_CLIENT_SECRET,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Setu auth failed: ${res.status} ${err}`)
  }

  const data: SetuTokenResponse = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return data.access_token
}

/**
 * Make an authenticated request to Setu AA API
 */
async function setuFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  const res = await fetch(`${SETU_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-product-instance-id': SETU_FIU_ID,
      ...(options.headers || {}),
    },
  })
  return res
}

/**
 * Create a consent request
 * Returns: { id (consent handle), url (redirect URL for user) }
 */
export async function createConsent(userId: number, mobileNumber: string): Promise<{ consentHandle: string; redirectUrl: string }> {
  const now = new Date()
  const consentStart = now.toISOString()
  const consentExpiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year

  // Data fetch range: last 6 months to now
  const fetchFrom = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString()
  const fetchTo = now.toISOString()

  const body = {
    consentDuration: {
      unit: 'MONTH',
      value: 12,
    },
    consentMode: 'STORE', // Store data for processing
    fetchType: 'PERIODIC',
    Frequency: {
      unit: 'MONTH',
      value: 1,
    },
    dataRange: {
      from: fetchFrom,
      to: fetchTo,
    },
    dataLife: {
      unit: 'MONTH',
      value: 3, // Keep data for 3 months
    },
    fiTypes: ['DEPOSIT'], // Savings/Current accounts
    consentTypes: ['TRANSACTIONS', 'SUMMARY'],
    Customer: {
      id: `${mobileNumber}@onemoney`, // AA handle format
    },
    Purpose: {
      code: '101', // Personal finance management
      text: 'Track your income and expenses automatically in Moneylix',
      refUri: `${APP_URL}/privacy`,
      Category: {
        type: 'string',
      },
    },
    redirectUrl: `${APP_URL}/dashboard/settings?bank_consent=success`,
    context: [
      {
        key: 'userId',
        value: String(userId),
      },
    ],
    consentStart,
    consentExpiry,
  }

  const res = await setuFetch('/consents', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[setu] Create consent failed:', res.status, err)
    throw new Error(`Failed to create consent: ${res.status}`)
  }

  const data: SetuConsentResponse = await res.json()

  return {
    consentHandle: data.id,
    redirectUrl: data.url,
  }
}

/**
 * Check consent status
 */
export async function getConsentStatus(consentHandle: string): Promise<{ status: string; consentId?: string }> {
  const res = await setuFetch(`/consents/${consentHandle}`)

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to get consent status: ${res.status} ${err}`)
  }

  const data = await res.json()
  return {
    status: data.status, // PENDING, ACTIVE, PAUSED, REVOKED, EXPIRED
    consentId: data.consentId,
  }
}

/**
 * Create a data session (FI request) to fetch transactions
 */
export async function createDataSession(consentId: string): Promise<string> {
  const now = new Date()
  const fetchFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString() // last 90 days
  const fetchTo = now.toISOString()

  const body = {
    consentId,
    DataRange: {
      from: fetchFrom,
      to: fetchTo,
    },
    format: 'json',
  }

  const res = await setuFetch('/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to create data session: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.id // session ID
}

/**
 * Fetch financial data from a session
 */
export async function fetchSessionData(sessionId: string): Promise<SetuDataResponse[]> {
  const res = await setuFetch(`/sessions/${sessionId}`)

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to fetch session data: ${res.status} ${err}`)
  }

  const data = await res.json()

  if (data.status === 'PENDING') {
    return [] // Data not ready yet
  }

  return data.payload || []
}

/**
 * Revoke a consent
 */
export async function revokeConsent(consentId: string): Promise<void> {
  const res = await setuFetch(`/consents/${consentId}/revoke`, {
    method: 'POST',
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to revoke consent: ${res.status} ${err}`)
  }
}

/**
 * Whether real Setu AA credentials are configured.
 * When false, the bank-connect routes fall back to a local mock flow
 * so the UI can be exercised without a live Setu sandbox account.
 */
export function isSetuConfigured(): boolean {
  return Boolean(SETU_CLIENT_ID && SETU_CLIENT_SECRET)
}

export { SETU_BASE_URL, SETU_FIU_ID, APP_URL }
