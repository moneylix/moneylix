import React from 'react'
import { cn } from '@/lib/utils/format'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helpText?: string
}

export default function Input({ label, error, helpText, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      {label && <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">{label}</label>}
      <input
        className={cn(
          "bg-secondary/50 border border-border/50 focus:border-primary outline-none",
          "rounded-xl px-4 py-3 text-foreground transition-all placeholder:text-muted-foreground/50",
          "focus:ring-2 focus:ring-primary/10",
          error && "border-destructive focus:ring-destructive/10",
          className
        )}
        {...props}
      />
      {error ? (
        <span className="text-[10px] text-destructive font-bold ml-1">{error}</span>
      ) : helpText ? (
        <span className="text-[10px] text-muted-foreground ml-1">{helpText}</span>
      ) : null}
    </div>
  )
}
