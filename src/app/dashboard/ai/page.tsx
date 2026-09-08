'use client'

import { useState } from 'react'
import { useCurrency } from '@/lib/contexts/CurrencyContext'
import { PlanGate } from '@/app/components/PlanGate'
import { Sparkles, TrendingUp, Landmark, Coins, RefreshCw, CheckCircle, AlertCircle, ChevronRight, PiggyBank } from 'lucide-react'

interface Recommendations {
  savings: string[]
  investments: { gold: string; sip: string; fd: string }
  summary: string
  riskProfile: 'conservative' | 'moderate' | 'aggressive'
  monthlyInvestmentCapacity: number
}

const riskCls = { conservative: 'text-blue-400 bg-blue-500/10 border-blue-500/20', moderate: 'text-amber-400 bg-amber-500/10 border-amber-500/20', aggressive: 'text-rose-400 bg-rose-500/10 border-rose-500/20' }

export default function AIRecommendationsPage() {
  const { currencies, currentCurrency } = useCurrency()
  const [loading, setLoading] = useState(false)
  const [rec, setRec] = useState<Recommendations | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState({ income: '', expenses: '', balance: '' })

  const symbol = currencies.find(c => c.code === currentCurrency)?.symbol || currentCurrency
  const savingsRate = data.income && data.expenses ? Math.max(0, ((parseFloat(data.income) - parseFloat(data.expenses)) / parseFloat(data.income)) * 100) : 0

  const handleGenerate = async () => {
    const income = parseFloat(data.income); const expenses = parseFloat(data.expenses)
    if (!income || !expenses) { setError('Enter your monthly income and expenses'); return }
    setLoading(true); setError(null); setRec(null)
    try {
      const res = await fetch('/api/ai-recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ income, expenses, balance: parseFloat(data.balance) || 0, savingsRate, topCategories: [], currency: currentCurrency }) })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      setRec(await res.json())
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const inner = (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white">AI Investment Advisor</h1>
          <p className="text-[10px] text-slate-400">Powered by Gemini AI</p>
        </div>
      </div>

      {/* Input form */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-end gap-3 flex-wrap">
          {[
            { label: `Monthly Income (${symbol})`, key: 'income', ph: '50000' },
            { label: `Monthly Expenses (${symbol})`, key: 'expenses', ph: '35000' },
            { label: `Current Savings (${symbol})`, key: 'balance', ph: '200000' },
          ].map(({ label, key, ph }) => (
            <div key={key} className="flex-1 min-w-[120px]">
              <label className="block text-[10px] font-medium text-slate-400 mb-1">{label}</label>
              <input type="number" value={(data as any)[key]} onChange={e => setData(p => ({ ...p, [key]: e.target.value }))} placeholder={ph}
                className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
            </div>
          ))}
          <button onClick={handleGenerate} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold shadow-md hover:opacity-90 active:scale-95 transition disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {loading ? 'Analyzing...' : 'Get Advice'}
          </button>
        </div>

        {data.income && data.expenses && (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-emerald-300">
            <PiggyBank className="w-3 h-3" />
            Savings rate: <span className="font-bold">{savingsRate.toFixed(1)}%</span> — surplus: <span className="font-bold">{symbol}{(parseFloat(data.income) - parseFloat(data.expenses)).toLocaleString()}</span>
          </div>
        )}

        {error && (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-rose-300 bg-rose-500/10 rounded-xl px-3 py-2">
            <AlertCircle className="w-3 h-3 flex-shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="relative w-10 h-10 mx-auto mb-2">
            <div className="w-10 h-10 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
            <Sparkles className="absolute inset-0 m-auto w-4 h-4 text-violet-400" />
          </div>
          <p className="text-xs text-slate-400">Gemini AI is analyzing your finances...</p>
        </div>
      )}

      {/* Results */}
      {rec && (
        <div className="space-y-2">
          {/* Summary + risk */}
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 flex items-start justify-between gap-3 flex-wrap">
            <p className="text-xs text-slate-300 flex-1 leading-relaxed">{rec.summary}</p>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${riskCls[rec.riskProfile]}`}>{rec.riskProfile} risk</span>
              <span className="text-[10px] text-slate-400">Invest: <span className="text-white font-semibold">{symbol}{rec.monthlyInvestmentCapacity?.toLocaleString()}/mo</span></span>
            </div>
          </div>

          {/* Investment cards */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Coins, label: 'Gold', text: rec.investments.gold, cls: 'border-amber-500/20 bg-amber-500/5', icls: 'text-amber-400 bg-amber-500/15' },
              { icon: TrendingUp, label: 'SIP / Mutual Funds', text: rec.investments.sip, cls: 'border-emerald-500/20 bg-emerald-500/5', icls: 'text-emerald-400 bg-emerald-500/15' },
              { icon: Landmark, label: 'Fixed Deposit', text: rec.investments.fd, cls: 'border-cyan-500/20 bg-cyan-500/5', icls: 'text-cyan-400 bg-cyan-500/15' },
            ].map(({ icon: Icon, label, text, cls, icls }) => (
              <div key={label} className={`rounded-2xl border ${cls} p-3`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${icls}`}><Icon className="w-3 h-3" /></div>
                  <p className="text-xs font-semibold text-white">{label}</p>
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          {/* Savings tips */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-400" />Savings Tips</p>
            <div className="space-y-1.5">
              {rec.savings.map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-300 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-slate-500 text-center">For informational purposes only. Consult a certified financial advisor before investing.</p>
        </div>
      )}
    </div>
  )
  return <PlanGate feature="aiAdvisor">{inner}</PlanGate>
}
