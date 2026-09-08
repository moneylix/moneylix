/**
 * GST Calculation Helpers for Indian Tax Compliance
 *
 * Covers:
 * - Intra-state (CGST + SGST) and inter-state (IGST) splits
 * - GSTIN validation
 * - Financial-year / quarter helpers
 * - Indian state-code lookup
 */

// ---------------------------------------------------------------------------
// Indian state codes (first two digits of GSTIN)
// ---------------------------------------------------------------------------

export const INDIAN_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
  '97': 'Other Territory',
}

export const STATE_CODE_OPTIONS = Object.entries(INDIAN_STATES).map(([code, name]) => ({
  code,
  name,
  label: `${code} – ${name}`,
}))

// ---------------------------------------------------------------------------
// GST calculation
// ---------------------------------------------------------------------------

export interface GSTBreakdown {
  cgst: number
  sgst: number
  igst: number
  cess: number
  total: number
  taxableAmount: number
  totalWithTax: number
  isInterState: boolean
}

/**
 * Calculate GST split for a given taxable amount.
 *
 * @param amount        Taxable value (exclusive of tax)
 * @param rate          GST rate in percent (e.g. 18)
 * @param placeOfSupply Two-digit state code of the buyer / place of supply
 * @param businessState Two-digit state code of the seller (business registration)
 * @param cessRate      Optional cess rate in percent
 */
export function calculateGST(
  amount: number,
  rate: number,
  placeOfSupply: string,
  businessState: string,
  cessRate: number = 0,
): GSTBreakdown {
  const taxAmount = round2(amount * (rate / 100))
  const cessAmount = round2(amount * (cessRate / 100))
  const isInterState = placeOfSupply !== businessState

  if (isInterState) {
    return {
      cgst: 0,
      sgst: 0,
      igst: taxAmount,
      cess: cessAmount,
      total: taxAmount + cessAmount,
      taxableAmount: amount,
      totalWithTax: round2(amount + taxAmount + cessAmount),
      isInterState: true,
    }
  }

  const half = round2(taxAmount / 2)
  return {
    cgst: half,
    sgst: round2(taxAmount - half), // avoids rounding gap
    igst: 0,
    cess: cessAmount,
    total: taxAmount + cessAmount,
    taxableAmount: amount,
    totalWithTax: round2(amount + taxAmount + cessAmount),
    isInterState: false,
  }
}

/**
 * Reverse-calculate: given a tax-inclusive amount, derive the taxable value
 * and tax components.
 */
export function reverseGST(
  inclusiveAmount: number,
  rate: number,
  placeOfSupply: string,
  businessState: string,
  cessRate: number = 0,
): GSTBreakdown {
  const effectiveRate = rate + cessRate
  const taxableAmount = round2(inclusiveAmount / (1 + effectiveRate / 100))
  return calculateGST(taxableAmount, rate, placeOfSupply, businessState, cessRate)
}

// ---------------------------------------------------------------------------
// GSTIN validation
// ---------------------------------------------------------------------------

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/

export interface GSTINValidation {
  valid: boolean
  stateCode: string | null
  stateName: string | null
  pan: string | null
  error: string | null
}

export function validateGSTIN(gstin: string): GSTINValidation {
  if (!gstin || gstin.length !== 15) {
    return { valid: false, stateCode: null, stateName: null, pan: null, error: 'GSTIN must be exactly 15 characters' }
  }

  const upper = gstin.toUpperCase()
  if (!GSTIN_REGEX.test(upper)) {
    return { valid: false, stateCode: null, stateName: null, pan: null, error: 'Invalid GSTIN format' }
  }

  const stateCode = upper.substring(0, 2)
  const stateName = INDIAN_STATES[stateCode] ?? null
  if (!stateName) {
    return { valid: false, stateCode, stateName: null, pan: null, error: 'Invalid state code in GSTIN' }
  }

  const pan = upper.substring(2, 12)

  return { valid: true, stateCode, stateName, pan, error: null }
}

export function formatGSTIN(gstin: string): string {
  return gstin.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// ---------------------------------------------------------------------------
// Financial year / quarter helpers
// ---------------------------------------------------------------------------

/**
 * Returns the Indian financial year string for a given date.
 * FY runs April 1 → March 31.
 * e.g. 2026-06-15 → "2026-27", 2027-01-10 → "2026-27"
 */
export function getFinancialYear(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const month = d.getMonth() // 0-based
  const year = d.getFullYear()

  if (month >= 3) {
    // April (3) onwards → current year is start
    return `${year}-${String(year + 1).slice(2)}`
  }
  // Jan-Mar → previous year is start
  return `${year - 1}-${String(year).slice(2)}`
}

/**
 * Returns Q1–Q4 for the Indian financial year.
 * Q1 = Apr-Jun, Q2 = Jul-Sep, Q3 = Oct-Dec, Q4 = Jan-Mar
 */
export function getQuarter(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const month = d.getMonth() // 0-based: 0=Jan

  if (month >= 3 && month <= 5) return 'Q1'
  if (month >= 6 && month <= 8) return 'Q2'
  if (month >= 9 && month <= 11) return 'Q3'
  return 'Q4' // Jan, Feb, Mar
}

/**
 * Returns the month string (YYYY-MM) for a date.
 */
export function getMonthKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/**
 * Get start and end dates for a given financial year.
 * e.g. "2026-27" → { start: "2026-04-01", end: "2027-03-31" }
 */
export function getFinancialYearDates(fy: string): { start: string; end: string } {
  const startYear = parseInt(fy.split('-')[0], 10)
  return {
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
  }
}

/**
 * Get start and end dates for a specific quarter within a financial year.
 */
export function getQuarterDates(fy: string, quarter: string): { start: string; end: string } {
  const startYear = parseInt(fy.split('-')[0], 10)
  switch (quarter) {
    case 'Q1': return { start: `${startYear}-04-01`, end: `${startYear}-06-30` }
    case 'Q2': return { start: `${startYear}-07-01`, end: `${startYear}-09-30` }
    case 'Q3': return { start: `${startYear}-10-01`, end: `${startYear}-12-31` }
    case 'Q4': return { start: `${startYear + 1}-01-01`, end: `${startYear + 1}-03-31` }
    default:   return getFinancialYearDates(fy)
  }
}

/**
 * List all financial years from a start year to now.
 */
export function listFinancialYears(fromYear: number = 2020): string[] {
  const now = new Date()
  const currentFY = getFinancialYear(now)
  const currentStart = parseInt(currentFY.split('-')[0], 10)
  const years: string[] = []
  for (let y = fromYear; y <= currentStart; y++) {
    years.push(`${y}-${String(y + 1).slice(2)}`)
  }
  return years.reverse()
}

// ---------------------------------------------------------------------------
// Common GST rates in India
// ---------------------------------------------------------------------------

export const GST_RATES = [0, 5, 12, 18, 28] as const

export const GST_RATE_OPTIONS = GST_RATES.map((r) => ({
  value: r,
  label: r === 0 ? 'Exempt (0%)' : `${r}%`,
}))

// ---------------------------------------------------------------------------
// Tax deadline helpers
// ---------------------------------------------------------------------------

export interface TaxDeadline {
  type: string
  description: string
  dueDate: string
  quarter?: string
}

/**
 * Get upcoming GST/TDS filing deadlines for the current period.
 */
export function getUpcomingDeadlines(fy: string): TaxDeadline[] {
  const startYear = parseInt(fy.split('-')[0], 10)
  const endYear = startYear + 1

  return [
    { type: 'GSTR-1', description: 'Outward supplies (monthly)', dueDate: `${startYear}-05-11`, quarter: 'Q1' },
    { type: 'GSTR-3B', description: 'Summary return (monthly)', dueDate: `${startYear}-05-20`, quarter: 'Q1' },
    { type: 'GSTR-1', description: 'Outward supplies (monthly)', dueDate: `${startYear}-08-11`, quarter: 'Q2' },
    { type: 'GSTR-3B', description: 'Summary return (monthly)', dueDate: `${startYear}-08-20`, quarter: 'Q2' },
    { type: 'GSTR-1', description: 'Outward supplies (monthly)', dueDate: `${startYear}-11-11`, quarter: 'Q3' },
    { type: 'GSTR-3B', description: 'Summary return (monthly)', dueDate: `${startYear}-11-20`, quarter: 'Q3' },
    { type: 'GSTR-1', description: 'Outward supplies (monthly)', dueDate: `${endYear}-02-11`, quarter: 'Q4' },
    { type: 'GSTR-3B', description: 'Summary return (monthly)', dueDate: `${endYear}-02-20`, quarter: 'Q4' },
    { type: 'Advance Tax', description: 'Q1 instalment (15%)', dueDate: `${startYear}-06-15`, quarter: 'Q1' },
    { type: 'Advance Tax', description: 'Q2 instalment (45%)', dueDate: `${startYear}-09-15`, quarter: 'Q2' },
    { type: 'Advance Tax', description: 'Q3 instalment (75%)', dueDate: `${startYear}-12-15`, quarter: 'Q3' },
    { type: 'Advance Tax', description: 'Q4 instalment (100%)', dueDate: `${endYear}-03-15`, quarter: 'Q4' },
    { type: 'TDS Return', description: 'Quarterly TDS return', dueDate: `${startYear}-07-31`, quarter: 'Q1' },
    { type: 'TDS Return', description: 'Quarterly TDS return', dueDate: `${startYear}-10-31`, quarter: 'Q2' },
    { type: 'TDS Return', description: 'Quarterly TDS return', dueDate: `${endYear}-01-31`, quarter: 'Q3' },
    { type: 'TDS Return', description: 'Quarterly TDS return', dueDate: `${endYear}-05-31`, quarter: 'Q4' },
  ]
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
