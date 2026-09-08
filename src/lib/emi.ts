/**
 * EMI Calculator & Amortization Schedule Generator
 *
 * Standard reducing-balance EMI formula:
 *   EMI = P × r × (1+r)^n / ((1+r)^n − 1)
 * where P = principal, r = monthly interest rate, n = tenure in months.
 */

export interface AmortizationRow {
  month: number
  date: string
  emiAmount: number
  principal: number
  interest: number
  balance: number
}

export interface PrepaymentResult {
  newTenureMonths: number
  interestSaved: number
  newEmi: number
  originalTotalInterest: number
  newTotalInterest: number
}

/**
 * Calculate monthly EMI using the standard reducing-balance formula.
 * @param principal - Loan principal amount
 * @param annualRate - Annual interest rate as a percentage (e.g. 12 for 12%)
 * @param tenureMonths - Loan tenure in months
 * @returns Monthly EMI amount rounded to 2 decimal places
 */
export function calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
  if (principal <= 0 || tenureMonths <= 0) return 0
  if (annualRate === 0) return Math.round((principal / tenureMonths) * 100) / 100

  const monthlyRate = annualRate / 12 / 100
  const factor = Math.pow(1 + monthlyRate, tenureMonths)
  const emi = (principal * monthlyRate * factor) / (factor - 1)
  return Math.round(emi * 100) / 100
}

/**
 * Generate a full amortization schedule.
 * @param principal - Loan principal amount
 * @param annualRate - Annual interest rate as percentage
 * @param tenureMonths - Loan tenure in months
 * @param startDate - Loan start date in YYYY-MM-DD format
 * @returns Array of amortization rows with monthly breakdown
 */
export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  startDate: string
): AmortizationRow[] {
  const emi = calculateEMI(principal, annualRate, tenureMonths)
  if (emi === 0) return []

  const monthlyRate = annualRate / 12 / 100
  let balance = principal
  const schedule: AmortizationRow[] = []
  const start = new Date(startDate + 'T00:00:00')

  for (let i = 1; i <= tenureMonths; i++) {
    const interest = Math.round(balance * monthlyRate * 100) / 100
    let principalPart: number
    let emiForMonth: number

    if (i === tenureMonths) {
      // Last month: clear the remaining balance
      principalPart = Math.round(balance * 100) / 100
      emiForMonth = Math.round((principalPart + interest) * 100) / 100
    } else {
      principalPart = Math.round((emi - interest) * 100) / 100
      emiForMonth = emi
    }

    balance = Math.max(0, Math.round((balance - principalPart) * 100) / 100)

    const date = new Date(start)
    date.setMonth(date.getMonth() + i)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(Math.min(date.getDate(), 28)).padStart(2, '0')

    schedule.push({
      month: i,
      date: `${y}-${m}-${d}`,
      emiAmount: emiForMonth,
      principal: principalPart,
      interest,
      balance,
    })
  }

  return schedule
}

/**
 * Calculate the impact of a lump-sum prepayment on the loan.
 * Assumes the prepayment reduces the outstanding principal while keeping EMI the same,
 * thus shortening the loan tenure.
 * @param outstandingBalance - Current outstanding balance
 * @param annualRate - Annual interest rate as percentage
 * @param remainingMonths - Remaining tenure months
 * @param emiAmount - Current monthly EMI
 * @param prepayAmount - Prepayment amount
 */
export function calculatePrepaymentImpact(
  outstandingBalance: number,
  annualRate: number,
  remainingMonths: number,
  emiAmount: number,
  prepayAmount: number
): PrepaymentResult {
  const monthlyRate = annualRate / 12 / 100

  // Original total interest for remaining tenure
  const originalTotalInterest = (emiAmount * remainingMonths) - outstandingBalance

  // New balance after prepayment
  const newBalance = Math.max(0, outstandingBalance - prepayAmount)

  if (newBalance === 0) {
    return {
      newTenureMonths: 0,
      interestSaved: originalTotalInterest,
      newEmi: 0,
      originalTotalInterest,
      newTotalInterest: 0,
    }
  }

  // Calculate new tenure with same EMI
  let newTenure = 0
  let bal = newBalance
  let newTotalInterest = 0

  while (bal > 0 && newTenure < remainingMonths * 2) {
    const interest = bal * monthlyRate
    const principalPart = emiAmount - interest
    if (principalPart <= 0) {
      // EMI can't cover interest — shouldn't happen in normal scenarios
      newTenure = remainingMonths
      break
    }
    bal = Math.max(0, bal - principalPart)
    newTotalInterest += interest
    newTenure++
  }

  newTotalInterest = Math.round(newTotalInterest * 100) / 100
  const interestSaved = Math.round((originalTotalInterest - newTotalInterest) * 100) / 100

  return {
    newTenureMonths: newTenure,
    interestSaved,
    newEmi: emiAmount,
    originalTotalInterest: Math.round(originalTotalInterest * 100) / 100,
    newTotalInterest,
  }
}
