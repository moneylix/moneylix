export function formatAmount(amount: number, currency = 'INR'): string {
  const symbols: Record<string, string> = {
    INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥'
  }
  const symbol = symbols[currency] || '₹'
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return formatAmount(amount, currency)
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', { 
    day: 'numeric', month: 'short', year: 'numeric' 
  })
}

export function formatDateShort(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', { 
    day: 'numeric', month: 'short' 
  })
}

export function getDateRange(period: 'today' | 'week' | 'month'): { from: Date; to: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  if (period === 'today') return { from: today, to: now }
  
  if (period === 'week') {
    const monday = new Date(today)
    monday.setDate(today.getDate() - today.getDay() + 1)
    return { from: monday, to: now }
  }
  
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  return { from: monthStart, to: now }
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
