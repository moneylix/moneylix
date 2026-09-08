'use client'

import { motion } from 'framer-motion'

interface SkeletonProps {
  className?: string
  variant?: 'rectangular' | 'circular' | 'text'
}

export default function LoadingSkeleton({ className = '', variant = 'rectangular' }: SkeletonProps) {
  const baseStyles = 'bg-[#334155]/30 relative overflow-hidden'
  const variantStyles = {
    rectangular: 'rounded-xl',
    circular: 'rounded-full',
    text: 'rounded h-4 w-full'
  }

  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-[#94A3B8]/10 to-transparent"
        animate={{
          x: ['-100%', '100%']
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: 'linear'
        }}
      />
    </div>
  )
}
