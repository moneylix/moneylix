'use client'

import { useState } from 'react'
import { usePlan, PLAN_LABELS, Plan } from '@/lib/contexts/PlanContext'
import { Check, X, Zap, Crown, Sparkles, CheckCircle } from 'lucide-react'
import UpgradeModal from '@/components/payments/UpgradeModal'

type Billing = 'monthly' | 'halfyearly' | 'annual'

const PRICING = {
  pro:     { monthly: 199,  halfyearly: 999,  annual: 1788 },
  premium: { monthly: 499,  halfyearly: 2499, annual: 3588 },
}

const MONTHLY_EQUIV: Record<Billing, { pro: string; premium: string }> = {
  monthly:    { pro: '₹199/mo',  premium: '₹499/mo' },
  halfyearly: { pro: '₹166/mo',  premium: '₹416/mo' },
  annual:     { pro: '₹149/mo',  premium: '₹299/mo' },
}

const SAVINGS: Record<Billing, { pro: string; premium: string } | null> = {
  monthly:    null,
  halfyearly: { pro: 'Save ₹195',  premium: 'Save ₹495' },
  annual:     { pro: 'Save ₹600',  premium: 'Save ₹2,400' },
}

const plans: { key: Plan; icon: any; features: string[]; locked: string[] }[] = [
  {
    key: 'free',
    icon: Zap,
    features: ['1 Business', 'Transactions (add/view)', 'Basic Dashboard', 'Calculator'],
    locked: ['Edit Categories', 'Overall Reports', 'Receivables', 'Export Data', 'AI Advisor', 'Multiple Businesses'],
  },
  {
    key: 'pro',
    icon: Crown,
    features: ['Up to 3 Businesses', 'Full Transactions', 'Edit & Add Categories', 'Overall Reports', 'Receivables & Payables', 'Export CSV', 'Calculator'],
    locked: ['AI Investment Advisor', 'Export JSON', 'Unlimited Businesses'],
  },
  {
    key: 'premium',
    icon: Sparkles,
    features: ['Unlimited Businesses', 'All Pro Features', 'AI Investment Advisor', 'Export CSV & JSON', 'Edit Categories', 'Receivables', 'Priority Support'],
    locked: [],
  },
]

export default function PricingPage() {
  const { plan: currentPlan, setPlan, refresh } = usePlan()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'premium'>('pro')
  const [successPlan, setSuccessPlan] = useState<string | null>(null)
  const [billing, setBilling] = useState<Billing>('monthly')

  const userId = typeof window !== 'undefined'
    ? (localStorage.getItem('moneylix_user_id') ?? '1')
    : '1'

  const handleActivate = (p: Plan) => {
    if (p === 'free') { setPlan('free'); return }
    setSelectedPlan(p as 'pro' | 'premium')
    setShowUpgrade(true)
  }

  const handlePaymentSuccess = async (plan: string) => {
    setPlan(plan as Plan)
    await refresh()
    setSuccessPlan(plan)
    setShowUpgrade(false)
    setTimeout(() => setSuccessPlan(null), 4000)
  }

  return (
    <div className="space-y-3">
      {successPlan && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-lime-100 text-lime-700 text-sm font-semibold">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          Payment successful! You are now on the {successPlan.toUpperCase()} plan.
        </div>
      )}

      {showUpgrade && (
        <UpgradeModal
          userId={userId}
          onClose={() => setShowUpgrade(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-base font-bold text-neutral-900">Plans & Pricing</h1>
          <p className="text-[10px] text-neutral-400">Choose the plan that fits your needs</p>
        </div>
        {/* Billing Toggle */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white shadow-sm">
          {(['monthly', 'halfyearly', 'annual'] as Billing[]).map(b => (
            <button key={b} onClick={() => setBilling(b)}
              className={`relative px-3 py-1.5 rounded-lg text-[10px] font-black transition ${billing === b ? 'bg-lime-100 text-lime-700' : 'text-neutral-400 hover:text-neutral-900'}`}>
              {b === 'monthly' ? 'Monthly' : b === 'halfyearly' ? 'Half-Yearly' : 'Annual'}
              {b === 'annual' && <span className="absolute -top-2 -right-1 bg-lime-500 text-neutral-900 text-[7px] font-black px-1 py-0.5 rounded-full leading-none">SAVE</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {plans.map(({ key, icon: Icon, features, locked }) => {
          const label = PLAN_LABELS[key]
          const isCurrent = currentPlan === key
          const isPremium = key === 'premium'
          const isPro = key === 'pro'

          return (
            <div key={key} className={`group relative rounded-2xl border-2 bg-white p-4 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1 shadow-sm ${
              isPremium ? 'border-amber-300 hover:shadow-xl hover:shadow-amber-400/20' :
              isPro     ? 'border-cyan-300 hover:shadow-xl hover:shadow-cyan-400/20' :
                          'border-transparent hover:shadow-xl hover:shadow-black/5'
            }`}>
              {isPro && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-cyan-500 text-white text-[10px] font-bold">
                  POPULAR
                </div>
              )}

              {/* Plan header */}
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${
                  isPremium ? 'bg-amber-100' : isPro ? 'bg-cyan-100' : 'bg-neutral-100'
                }`}>
                  <Icon className={`w-4 h-4 ${label.color}`} />
                </div>
                <div>
                  <p className="text-sm font-bold text-neutral-900">{label.name}</p>
                  {key === 'free' ? (
                    <p className="text-xs font-semibold text-neutral-400">₹0/mo</p>
                  ) : (
                    <div>
                      <p className={`text-xs font-semibold ${label.color}`}>
                        ₹{PRICING[key as 'pro'|'premium'][billing].toLocaleString()}
                      </p>
                      <p className="text-[9px] text-neutral-400">{MONTHLY_EQUIV[billing][key as 'pro'|'premium']} equiv</p>
                    </div>
                  )}
                </div>
                <div className="ml-auto flex flex-col items-end gap-1">
                  {isCurrent && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${label.badge}`}>Active</span>}
                  {!isCurrent && SAVINGS[billing] && key !== 'free' && (
                    <span className="text-[9px] bg-lime-100 text-lime-700 px-1.5 py-0.5 rounded-full font-bold">
                      {SAVINGS[billing]![key as 'pro'|'premium']}
                    </span>
                  )}
                </div>
              </div>

              {/* Features */}
              <div className="flex-1 space-y-1.5">
                {features.map(f => (
                  <div key={f} className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-lime-600 flex-shrink-0" />
                    <span className="text-[11px] text-neutral-600">{f}</span>
                  </div>
                ))}
                {locked.map(f => (
                  <div key={f} className="flex items-center gap-1.5 opacity-40">
                    <X className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                    <span className="text-[11px] text-neutral-400 line-through">{f}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => handleActivate(key)}
                disabled={isCurrent}
                className={`w-full py-2 rounded-xl text-xs font-bold transition ${
                  isCurrent
                    ? 'bg-neutral-100 text-neutral-400 cursor-default'
                    : isPremium
                    ? 'bg-amber-500 text-white hover:bg-amber-400 shadow shadow-amber-500/30'
                    : isPro
                    ? 'bg-cyan-500 text-white hover:bg-cyan-400 shadow shadow-cyan-500/30'
                    : 'bg-neutral-900 text-neutral-50 hover:bg-neutral-800'
                }`}>
                {isCurrent ? '✓ Current Plan' : key === 'free' ? 'Downgrade to Free' : `Upgrade to ${label.name}`}
              </button>
            </div>
          )
        })}
      </div>

      {/* Feature comparison table */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-black/5 bg-neutral-50">
          <p className="text-xs font-semibold text-neutral-900">Feature Comparison</p>
        </div>
        <table className="w-full text-xs">
          <thead className="border-b border-black/5">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-medium text-neutral-400">Feature</th>
              {plans.map(p => (
                <th key={p.key} className={`px-3 py-2 text-center text-[10px] font-bold ${PLAN_LABELS[p.key].color}`}>
                  {PLAN_LABELS[p.key].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {[
              { label: 'Businesses', values: ['1', 'Up to 3', 'Unlimited'] },
              { label: 'Transactions', values: ['✓', '✓', '✓'] },
              { label: 'Dashboard', values: ['Basic', 'Full', 'Full'] },
              { label: 'Edit Categories', values: ['✗', '✓', '✓'] },
              { label: 'Overall Reports', values: ['✗', '✓', '✓'] },
              { label: 'Receivables', values: ['✗', '✓', '✓'] },
              { label: 'Export CSV', values: ['✗', '✓', '✓'] },
              { label: 'Export JSON', values: ['✗', '✗', '✓'] },
              { label: 'AI Advisor', values: ['✗', '✗', '✓'] },
              { label: 'Calculator', values: ['✓', '✓', '✓'] },
            ].map(({ label, values }) => (
              <tr key={label} className="hover:bg-neutral-50">
                <td className="px-3 py-1.5 text-neutral-600">{label}</td>
                {values.map((v, i) => (
                  <td key={i} className={`px-3 py-1.5 text-center font-medium ${
                    v === '✓' || v === 'Full' || v === 'Unlimited' ? 'text-lime-600' :
                    v === '✗' ? 'text-neutral-300' : 'text-neutral-600'
                  }`}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
