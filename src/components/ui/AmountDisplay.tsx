import { formatAmount, cn } from '@/lib/utils/format'

interface AmountDisplayProps {
  amount: number
  type?: 'credit' | 'debit' | 'auto'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showSign?: boolean
  className?: string
}

export default function AmountDisplay({ 
  amount, 
  type = 'auto', 
  size = 'md', 
  showSign = true,
  className
}: AmountDisplayProps) {
  const actualType = type === 'auto' ? (amount >= 0 ? 'credit' : 'debit') : type
  const color = actualType === 'credit' ? 'text-[#10B981]' : 'text-[#EF4444]'
  const sign = showSign ? (actualType === 'credit' ? '+' : '-') : ''
  
  const sizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-3xl'
  }

  return (
    <span className={cn('number-font font-bold', color, sizes[size], className)}>
      {sign}{formatAmount(Math.abs(amount))}
    </span>
  )
}
