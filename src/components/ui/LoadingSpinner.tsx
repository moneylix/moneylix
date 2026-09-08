import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/format'

export default function LoadingSpinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg', className?: string }) {
  const sizes = {
    sm: 16,
    md: 32,
    lg: 48
  }

  return (
    <div className={cn("flex items-center justify-center p-4", className)}>
      <Loader2 
        className="animate-spin text-[#10B981]" 
        size={sizes[size]} 
      />
    </div>
  )
}
