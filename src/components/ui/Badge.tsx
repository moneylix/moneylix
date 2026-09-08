import { cn } from '@/lib/utils/format'

export default function Badge({ 
  children, 
  variant = 'default',
  className 
}: { 
  children: React.ReactNode, 
  variant?: 'credit' | 'debit' | 'default' | 'pending',
  className?: string
}) {
  const styles = {
    credit: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    debit: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    default: 'bg-secondary text-muted-foreground border-border/50'
  }

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border transition-all",
      styles[variant as keyof typeof styles],
      className
    )}>
      {children}
    </span>
  )
}
