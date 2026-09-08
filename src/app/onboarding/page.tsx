'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Tag, ChevronRight, Check, Sparkles } from 'lucide-react'

const STEPS = ['Welcome', 'Business', 'Done']

const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', icon: '🍔', color: '#f97316', type: 'debit' },
  { name: 'Shopping', icon: '🛒', color: '#8b5cf6', type: 'debit' },
  { name: 'Transport', icon: '🚗', color: '#3b82f6', type: 'debit' },
  { name: 'Salary', icon: '💰', color: '#10b981', type: 'credit' },
  { name: 'Freelance', icon: '💻', color: '#06b6d4', type: 'credit' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFinish = async () => {
    if (!businessName.trim()) { setError('Please enter a business name'); return }
    setLoading(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ name: businessName.trim() }),
      })
      if (!res.ok) throw new Error('Failed to create business')
      localStorage.setItem('moneylix_onboarded', 'true')
      setStep(2)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                i < step ? 'bg-emerald-500 border-emerald-500 text-white' :
                i === step ? 'border-emerald-500 text-emerald-400' :
                'border-slate-700 text-slate-600'
              }`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-12 h-0.5 ${i < step ? 'bg-emerald-500' : 'bg-slate-800'}`} />}
            </div>
          ))}
        </div>

        {/* Step 0 — Welcome */}
        {step === 0 && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-[24px] flex items-center justify-center mx-auto text-4xl font-black text-slate-950 shadow-2xl shadow-emerald-500/30">₹</div>
            <div>
              <h1 className="text-3xl font-black text-white">Welcome to Moneylix</h1>
              <p className="text-slate-400 mt-2">Let&apos;s set up your account in 2 quick steps.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-left">
              {[
                { icon: Building2, title: 'Create a Business', desc: 'Organise finances by business or project' },
                { icon: Tag, title: 'Track Everything', desc: 'Credits, debits, categories and more' },
                { icon: Sparkles, title: 'AI Insights', desc: 'Get smart recommendations on Premium' },
                { icon: Check, title: 'Export & Import', desc: 'CSV export for your records' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <Icon className="w-5 h-5 text-emerald-400 mb-2" />
                  <p className="text-xs font-bold text-white">{title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep(1)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition"
            >
              Get Started <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Step 1 — Business */}
        {step === 1 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6">
            <div>
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-black text-white">Name Your Business</h2>
              <p className="text-slate-400 text-sm mt-1">This is your main financial account. You can add more later.</p>
            </div>

            {error && <p className="text-rose-400 text-sm font-semibold">{error}</p>}

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Business Name</label>
              <input
                type="text"
                autoFocus
                value={businessName}
                onChange={e => { setBusinessName(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleFinish()}
                placeholder="e.g. My Finances, Shop Name, Freelance..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 text-sm"
              />
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quick Suggestions</p>
              <div className="flex flex-wrap gap-2">
                {['My Finances', 'Personal', 'Business', 'Freelance'].map(s => (
                  <button key={s} onClick={() => setBusinessName(s)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400 transition">
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleFinish}
              disabled={loading || !businessName.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition"
            >
              {loading ? 'Creating...' : <>Continue <ChevronRight className="w-5 h-5" /></>}
            </button>
          </div>
        )}

        {/* Step 2 — Done */}
        {step === 2 && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white">You&apos;re all set!</h2>
              <p className="text-slate-400 mt-2">Your account is ready. Start tracking your finances.</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition"
            >
              Go to Dashboard <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
