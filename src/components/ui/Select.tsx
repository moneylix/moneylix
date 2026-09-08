import React from 'react'
import { cn } from '@/lib/utils/format'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { label: string; value: string | number }[]
}

export default function Select({ label, error, options, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      {label && <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">{label}</label>}
      <div className="relative">
        <select
          className={cn(
            "w-full bg-secondary/50 border border-border/50 focus:border-primary outline-none",
            "rounded-xl px-4 py-3 text-foreground transition-all appearance-none",
            "focus:ring-2 focus:ring-primary/10",
            error && "border-destructive focus:ring-destructive/10",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-card text-foreground">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground opacity-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      </div>
      {error && <span className="text-[10px] text-destructive font-bold ml-1">{error}</span>}
    </div>
  )
}
