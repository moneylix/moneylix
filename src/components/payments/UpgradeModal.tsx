'use client'

import React, { useState } from 'react'
import { Check, X, ShieldAlert, Sparkles, Loader2, Crown, Zap } from 'lucide-react'

declare global { interface Window { Razorpay: any } }

type Billing = 'monthly' | 'halfyearly' | 'annual'

const PRICING = {
  pro:     { monthly: 199,  halfyearly: 999,  annual: 1788 },
  premium: { monthly: 499,  halfyearly: 2499, annual: 3588 },
}

const BILLING_LABELS: Record<Billing, { label: string; sublabel: string; badge?: string }> = {
  monthly:    { label: 'Monthly',    sublabel: 'Billed every month' },
  halfyearly: { label: 'Half-Yearly', sublabel: 'Billed every 6 months' },
  annual:     { label: 'Annual',     sublabel: 'Billed once a year', badge: 'Most Savings' },
}

const MONTHLY_EQUIV: Record<Billing, { pro: string; premium: string }> = {
  monthly:    { pro: '₹199/mo',    premium: '₹499/mo' },
  halfyearly: { pro: '₹166/mo',    premium: '₹416/mo' },
  annual:     { pro: '₹149/mo',    premium: '₹299/mo' },
}

const SAVINGS: Record<Billing, { pro: string; premium: string } | null> = {
  monthly:    null,
  halfyearly: { pro: 'Save ₹195',  premium: 'Save ₹495' },
  annual:     { pro: 'Save ₹600',  premium: 'Save ₹2,400' },
}

export default function UpgradeModal({
  userId, onClose, onSuccess
}: {
  userId: string
  onClose: () => void
  onSuccess: (plan: string) => void
}) {
  const [billing, setBilling] = useState<Billing>('monthly')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCheckout = async (plan: 'pro' | 'premium') => {
    try {
      setLoadingPlan(plan); setError(null)

      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, userId, billing })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to initialize payment')

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'Moneylix Ecosystem',
        description: `${plan.toUpperCase()} — ${BILLING_LABELS[billing].label}`,
        order_id: data.orderId,
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                userId, plan, billing
              })
            })
            const verifyData = await verifyRes.json()
            if (verifyRes.ok && verifyData.success) { onSuccess(plan); onClose() }
            else setError('Security verification failed. Contact support.')
          } catch { setError('Failed to verify payment with server.') }
        },
        theme: { color: '#10b981' }
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (r: any) => { setError(`Payment Failed: ${r.error.description}`); setLoadingPlan(null) })
      rzp.open()
    } catch (err: any) { setError(err.message); setLoadingPlan(null) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-[32px] w-full max-w-4xl p-8 relative shadow-2xl">
        <button onClick={onClose} className="absolute right-6 top-6 text-slate-500 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-white">Upgrade Your Plan</h2>
          <p className="text-slate-400 mt-2">Choose the billing cycle that works best for you.</p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl mb-6 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['monthly', 'halfyearly', 'annual'] as Billing[]).map(b => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={`relative px-4 py-2 rounded-xl text-xs font-black transition border ${
                billing === b
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {BILLING_LABELS[b].label}
              {BILLING_LABELS[b].badge && (
                <span className="absolute -top-2.5 -right-2 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                  {BILLING_LABELS[b].badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col items-center">
            <div className="w-10 h-10 rounded-2xl bg-slate-700 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Free</p>
            <div className="text-4xl font-black text-white mb-1">₹0</div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6">Forever free</p>
            <ul className="space-y-3 text-sm text-slate-400 w-full mb-8 flex-1">
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-500" /> 1 Business</li>
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-500" /> Basic Dashboard</li>
              <li className="flex items-center gap-3 text-slate-600"><X className="w-4 h-4" /> No Reports</li>
              <li className="flex items-center gap-3 text-slate-600"><X className="w-4 h-4" /> No AI Advisor</li>
            </ul>
            <button disabled className="w-full py-3 rounded-xl bg-slate-800 text-slate-500 font-bold cursor-not-allowed text-sm">
              Current Plan
            </button>
          </div>

          {/* Pro */}
          <div className="rounded-3xl border border-cyan-500/30 bg-cyan-500/5 p-6 flex flex-col items-center relative shadow-[0_0_40px_rgba(6,182,212,0.1)]">
            <div className="absolute -top-3 bg-cyan-500 text-white text-[10px] font-black uppercase tracking-widest py-1 px-4 rounded-full">
              Popular
            </div>
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 flex items-center justify-center mb-3 mt-2">
              <Crown className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-sm font-black text-cyan-400 uppercase tracking-widest mb-2">Pro</p>
            <div className="text-4xl font-black text-white mb-1">₹{PRICING.pro[billing].toLocaleString()}</div>
            <p className="text-[10px] text-cyan-500/70 font-bold uppercase tracking-widest">{BILLING_LABELS[billing].sublabel}</p>
            <p className="text-[10px] text-slate-400 mt-1 mb-1">{MONTHLY_EQUIV[billing].pro} equivalent</p>
            {SAVINGS[billing] && (
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-bold mb-4">
                {SAVINGS[billing]!.pro}
              </span>
            )}
            <div className={SAVINGS[billing] ? 'mb-2' : 'mb-6'} />
            <ul className="space-y-3 text-sm text-slate-300 w-full mb-6 flex-1">
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-cyan-400" /> Up to 3 Businesses</li>
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-cyan-400" /> Full Transactions</li>
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-cyan-400" /> Reports & Receivables</li>
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-cyan-400" /> Export CSV</li>
              <li className="flex items-center gap-3 text-slate-600"><X className="w-4 h-4" /> No AI Advisor</li>
            </ul>
            <button
              onClick={() => handleCheckout('pro')}
              disabled={!!loadingPlan}
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-black transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60"
            >
              {loadingPlan === 'pro' ? <Loader2 className="w-5 h-5 animate-spin" /> : `Get Pro — ₹${PRICING.pro[billing].toLocaleString()}`}
            </button>
          </div>

          {/* Premium */}
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 flex flex-col items-center relative shadow-[0_0_40px_rgba(245,158,11,0.1)] md:-translate-y-4">
            <div className="absolute -top-3 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[10px] font-black uppercase tracking-widest py-1 px-4 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Best Value
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-3 mt-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-sm font-black text-amber-400 uppercase tracking-widest mb-2">Premium</p>
            <div className="text-4xl font-black text-white mb-1">₹{PRICING.premium[billing].toLocaleString()}</div>
            <p className="text-[10px] text-amber-500/70 font-bold uppercase tracking-widest">{BILLING_LABELS[billing].sublabel}</p>
            <p className="text-[10px] text-slate-400 mt-1 mb-1">{MONTHLY_EQUIV[billing].premium} equivalent</p>
            {SAVINGS[billing] && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold mb-4">
                {SAVINGS[billing]!.premium}
              </span>
            )}
            <div className={SAVINGS[billing] ? 'mb-2' : 'mb-6'} />
            <ul className="space-y-3 text-sm text-slate-300 w-full mb-6 flex-1">
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-amber-400" /> Unlimited Businesses</li>
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-amber-400" /> Everything in Pro</li>
              <li className="flex items-center gap-3 font-bold text-amber-200"><Check className="w-4 h-4 text-amber-400" /> AI Investment Advisor</li>
              <li className="flex items-center gap-3 font-bold text-amber-200"><Check className="w-4 h-4 text-amber-400" /> Export CSV & JSON</li>
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-amber-400" /> Priority Support</li>
            </ul>
            <button
              onClick={() => handleCheckout('premium')}
              disabled={!!loadingPlan}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:opacity-90 text-white font-black transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2 text-sm disabled:opacity-60"
            >
              {loadingPlan === 'premium' ? <Loader2 className="w-5 h-5 animate-spin" /> : `Get Premium — ₹${PRICING.premium[billing].toLocaleString()}`}
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-600 mt-6 font-medium">
          Secured by Razorpay · All payments in INR · Cancel anytime
        </p>
      </div>
    </div>
  )
}
