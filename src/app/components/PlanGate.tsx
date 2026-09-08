'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { usePlan, PLAN_FEATURES, Plan } from '@/lib/contexts/PlanContext'

type Feature = keyof typeof PLAN_FEATURES.free

const requiredPlan: Record<string, Plan> = {
  editCategories: 'pro',
  overall: 'pro',
  receivables: 'pro',
  exportCSV: 'pro',
  exportJSON: 'premium',
  aiAdvisor: 'premium',
  bankSync: 'pro',
}

export function PlanGate({ feature, children }: { feature: Feature; children: React.ReactNode }) {
  const { can } = usePlan()
  if (can(feature)) return <>{children}</>

  const needed = requiredPlan[feature as string] || 'pro'

  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Blurred preview */}
      <div className="pointer-events-none select-none opacity-30 blur-sm">{children}</div>
      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/60 backdrop-blur-sm">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${needed === 'premium' ? 'bg-amber-500/20' : 'bg-cyan-500/20'}`}>
          <Lock className={`w-5 h-5 ${needed === 'premium' ? 'text-amber-400' : 'text-cyan-400'}`} />
        </div>
        <p className="text-xs font-bold text-white">
          {needed === 'premium' ? 'Premium' : 'Pro'} Feature
        </p>
        <p className="text-[10px] text-slate-400 text-center px-6">
          Upgrade to {needed === 'premium' ? 'Premium' : 'Pro'} to unlock this feature
        </p>
        <Link href="/dashboard/pricing"
          className={`mt-1 px-4 py-1.5 rounded-xl text-xs font-bold text-white transition ${needed === 'premium' ? 'bg-amber-500 hover:bg-amber-400' : 'bg-cyan-500 hover:bg-cyan-400'}`}>
          Upgrade Now
        </Link>
      </div>
    </div>
  )
}

export function LockedBadge({ feature }: { feature: Feature }) {
  const { can } = usePlan()
  if (can(feature)) return null
  const needed = requiredPlan[feature as string] || 'pro'
  return (
    <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${needed === 'premium' ? 'bg-amber-500/20 text-amber-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
      {needed === 'premium' ? 'PRO+' : 'PRO'}
    </span>
  )
}
