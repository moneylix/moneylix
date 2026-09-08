import type { Currency } from '@/types'

interface CurrencyDisplayProps {
  amount: number
  currencyCode: string
  currencies: Currency[]
  precision?: number
}

export function CurrencyDisplay({
  amount,
  currencyCode,
  currencies,
  precision = 2,
}: CurrencyDisplayProps) {
  const currency = currencies.find(c => c.code === currencyCode)

  if (!currency) {
    return <span>{amount.toFixed(precision)} {currencyCode}</span>
  }

  return (
    <span>
      {currency.symbol}{amount.toFixed(precision)}
    </span>
  )
}

export function formatCurrency(
  amount: number,
  currencyCode: string,
  currencies: Currency[],
  precision: number = 2
): string {
  const currency = currencies.find(c => c.code === currencyCode)

  if (!currency) {
    return `${amount.toFixed(precision)} ${currencyCode}`
  }

  return `${currency.symbol}${amount.toFixed(precision)}`
}

export function convertCurrency(
  amount: number,
  _fromCurrency: string,
  _toCurrency: string,
  _currencies: Currency[]
): number {
  // No conversion — amounts are stored in the user's selected currency as-is
  return amount
}
