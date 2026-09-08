/**
 * IFSC code lookup via Razorpay's public IFSC API (https://ifsc.razorpay.com).
 * No API key required. Used to auto-fill bank name and branch when a user
 * enters their account's IFSC code.
 */

export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/

export interface IfscDetails {
  bank: string
  branch: string
  ifsc: string
  city: string
  state: string
  address: string
}

export async function lookupIFSC(ifsc: string): Promise<IfscDetails | null> {
  const code = ifsc.trim().toUpperCase()
  if (!IFSC_REGEX.test(code)) return null

  const res = await fetch(`https://ifsc.razorpay.com/${code}`)
  if (!res.ok) return null

  const data = await res.json()
  return {
    bank: data.BANK,
    branch: data.BRANCH,
    ifsc: data.IFSC,
    city: data.CITY,
    state: data.STATE,
    address: data.ADDRESS,
  }
}
