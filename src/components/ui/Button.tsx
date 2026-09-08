import React from 'react'
import { cn } from '@/lib/utils/format'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20',
    danger: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg shadow-destructive/20',
    ghost: 'bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground',
    outline: 'border border-border hover:border-primary text-foreground'
  }
  
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3.5 text-base'
  }

  return (
    <button
      className={cn(
        'rounded-xl font-bold transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" size={16} />}
      {children}
    </button>
  )
}
