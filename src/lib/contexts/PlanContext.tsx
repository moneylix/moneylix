'use client'

import { createContext, useContext, useEffect, ReactNode } from 'react'
import { useLocalStorage } from '@/lib/hooks/useLocalStorage'

// In local dev, unlock all features regardless of plan
const IS_DEV = process.env.NODE_ENV === 'development'

export type Plan = 'free' | 'pro' | 'premium'

interface PlanFeatures {
  maxBusinesses: number
  editCategories: boolean
  overall: boolean
  receivables: boolean
  aiAdvisor: boolean
  exportCSV: boolean
  exportJSON: boolean
  ocrScanner: boolean
  bankSync: boolean
  taxModule: boolean
  teamRoles: boolean
  invoicing: boolean
  forecasting: boolean
  loans: boolean
  inventory: boolean
  payroll: boolean
  timeTracking: boolean
  reconciliation: boolean
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  free:    { maxBusinesses: 1,        editCategories: false, overall: false, receivables: false, aiAdvisor: false, exportCSV: false, exportJSON: false, ocrScanner: false, bankSync: false, taxModule: false, teamRoles: false, invoicing: false,  forecasting: false, loans: false, inventory: false, payroll: false, timeTracking: false, reconciliation: false },
  pro:     { maxBusinesses: 3,        editCategories: true,  overall: true,  receivables: true,  aiAdvisor: false, exportCSV: true,  exportJSON: false, ocrScanner: false, bankSync: true,  taxModule: true,  teamRoles: false, invoicing: true,   forecasting: true,  loans: true,  inventory: false, payroll: false, timeTracking: true,  reconciliation: true  },
  premium: { maxBusinesses: Infinity, editCategories: true,  overall: true,  receivables: true,  aiAdvisor: true,  exportCSV: true,  exportJSON: true,  ocrScanner: true,  bankSync: true,  taxModule: true,  teamRoles: true,  invoicing: true,   forecasting: true,  loans: true,  inventory: true,  payroll: true,  timeTracking: true,  reconciliation: true  },
}

export const PLAN_LABELS: Record<Plan, { name: string; price: string; color: string; badge: string }> = {
  free:    { name: 'Free',    price: '₹0/mo',   color: 'text-slate-400', badge: 'bg-slate-500/20 text-slate-300' },
  pro:     { name: 'Pro',     price: '₹199/mo', color: 'text-cyan-400',  badge: 'bg-cyan-500/20 text-cyan-300'  },
  premium: { name: 'Premium', price: '₹499/mo', color: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300'},
}

interface PlanContextType {
  plan: Plan
  features: PlanFeatures
  expiresAt: string | null
  daysLeft: number | null
  setPlan: (p: Plan) => void
  can: (feature: keyof PlanFeatures) => boolean
  refresh: () => void
}

const PlanContext = createContext<PlanContextType>({
  plan: 'free', features: PLAN_FEATURES.free, expiresAt: null, daysLeft: null,
  setPlan: () => {}, can: () => false, refresh: () => {},
})

function isValidPlan(v: unknown): v is Plan {
  return v === 'free' || v === 'pro' || v === 'premium'
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlanStored] = useLocalStorage<Plan>('moneylix_plan', 'free')
  const [expiresAt, setExpiresAt] = useLocalStorage<string | null>('moneylix_plan_expires', null)
  const [daysLeft, setDaysLeft] = useLocalStorage<number | null>('moneylix_plan_days', null)

  const validPlan: Plan = isValidPlan(plan) ? plan : 'free'

  const fetchPlan = async () => {
    try {
      const token = localStorage.getItem('moneylix_session_token')
      if (!token) return
      const res = await fetch('/api/user/plan', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      if (isValidPlan(data.plan)) setPlanStored(data.plan)
      setExpiresAt(data.expires_at ?? null)
      setDaysLeft(data.days_left ?? null)
    } catch { /* silent */ }
  }

  useEffect(() => { fetchPlan() }, [])

  const setPlan = (p: Plan) => setPlanStored(p)
  // In dev mode, always use premium features so nothing is gated
  const effectivePlan: Plan = IS_DEV ? 'premium' : validPlan
  const features = PLAN_FEATURES[effectivePlan]
  const can = (feature: keyof PlanFeatures) => IS_DEV ? true : !!features[feature]

  return (
    <PlanContext.Provider value={{ plan: effectivePlan, features, expiresAt, daysLeft, setPlan, can, refresh: fetchPlan }}>
      {children}
    </PlanContext.Provider>
  )
}

export const usePlan = () => useContext(PlanContext)
