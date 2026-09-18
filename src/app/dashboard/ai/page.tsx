'use client'

import { useState } from 'react'
import { useCurrency } from '@/lib/contexts/CurrencyContext'
import { useTranslation } from '@/lib/i18n'
import { PlanGate } from '@/app/components/PlanGate'
import { Sparkles, TrendingUp, Landmark, Coins, RefreshCw, CheckCircle, AlertCircle, ChevronRight, PiggyBank } from 'lucide-react'

interface Recommendations {
  savings: string[]
  investments: { gold: string; sip: string; fd: string }
  summary: string
  riskProfile: 'conservative' | 'moderate' | 'aggressive'
  monthlyInvestmentCapacity: number
}

const riskCls = { conservative: 'text-blue-700 bg-blue-100', moderate: 'text-amber-700 bg-amber-100', aggressive: 'text-rose-700 bg-rose-100' }

export default function AIRecommendationsPage() {
  const { t } = useTranslation()
  const { currencies, currentCurrency } = useCurrency()
  const [loading, setLoading] = useState(false)
  const [rec, setRec] = useState<Recommendations | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState({ income: '', expenses: '', balance: '' })

  const symbol = currencies.find(c => c.code === currentCurrency)?.symbol || currentCurrency
  const savingsRate = data.income && data.expenses ? Math.max(0, ((parseFloat(data.income) - parseFloat(data.expenses)) / parseFloat(data.income)) * 100) : 0

  const handleGenerate = async () => {
    const income = parseFloat(data.income); const expenses = parseFloat(data.expenses)
    if (!income || !expenses) { setError(t('ai.enterIncomeExpenses')); return }
    setLoading(true); setError(null); setRec(null)
    try {
      const res = await fetch('/api/ai-recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ income, expenses, balance: parseFloat(data.balance) || 0, savingsRate, topCategories: [], currency: currentCurrency }) })
      if (!res.ok) throw new Error((await res.json()).error || t('payroll.failed'))
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
          <h1 className="text-base font-bold text-neutral-900">{t('ai.title')}</h1>
          <p className="text-[10px] text-neutral-400">{t('ai.poweredBy')}</p>
        </div>
      </div>

      {/* Input form */}
      <div className="rounded-2xl bg-white shadow-sm p-3">
        <div className="flex items-end gap-3 flex-wrap">
          {[
            { label: `${t('dashboard.monthlyIncome')} (${symbol})`, key: 'income', ph: '50000' },
            { label: `${t('dashboard.monthlyExpense')} (${symbol})`, key: 'expenses', ph: '35000' },
            { label: `${t('ai.currentSavings')} (${symbol})`, key: 'balance', ph: '200000' },
          ].map(({ label, key, ph }) => (
            <div key={key} className="flex-1 min-w-[120px]">
              <label className="block text-[10px] font-medium text-neutral-400 mb-1">{label}</label>
              <input type="number" value={(data as any)[key]} onChange={e => setData(p => ({ ...p, [key]: e.target.value }))} placeholder={ph}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-400/50" />
            </div>
          ))}
          <button onClick={handleGenerate} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold shadow-md hover:opacity-90 active:scale-95 transition disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {loading ? t('ai.analyzing') : t('ai.getAdvice')}
          </button>
        </div>

        {data.income && data.expenses && (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-emerald-700">
            <PiggyBank className="w-3 h-3" />
            {t('ai.savingsRateLabel')} <span className="font-bold">{savingsRate.toFixed(1)}%</span> — {t('ai.surplusLabel')} <span className="font-bold">{symbol}{(parseFloat(data.income) - parseFloat(data.expenses)).toLocaleString()}</span>
          </div>
        )}

        {error && (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-rose-700 bg-rose-50 rounded-xl px-3 py-2">
            <AlertCircle className="w-3 h-3 flex-shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl bg-white shadow-sm p-8 text-center">
          <div className="relative w-10 h-10 mx-auto mb-2">
            <div className="w-10 h-10 rounded-full border-4 border-violet-200 border-t-violet-500 animate-spin" />
            <Sparkles className="absolute inset-0 m-auto w-4 h-4 text-violet-500" />
          </div>
          <p className="text-xs text-neutral-400">{t('ai.analyzingFinances')}</p>
        </div>
      )}

      {/* Results */}
      {rec && (
        <div className="space-y-2">
          {/* Summary + risk */}
          <div className="rounded-2xl bg-white shadow-sm px-3 py-2 flex items-start justify-between gap-3 flex-wrap">
            <p className="text-xs text-neutral-600 flex-1 leading-relaxed">{rec.summary}</p>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${riskCls[rec.riskProfile]}`}>{t(`ai.${rec.riskProfile}`)} {t('ai.riskSuffix')}</span>
              <span className="text-[10px] text-neutral-400">{t('ai.investLabel')} <span className="text-neutral-900 font-semibold">{symbol}{rec.monthlyInvestmentCapacity?.toLocaleString()}{t('ai.perMonth')}</span></span>
            </div>
          </div>

          {/* Investment cards */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Coins, label: t('ai.gold'), text: rec.investments.gold, cls: 'border-amber-200 bg-amber-50', icls: 'text-amber-700 bg-amber-100' },
              { icon: TrendingUp, label: t('ai.sipMutualFunds'), text: rec.investments.sip, cls: 'border-emerald-200 bg-emerald-50', icls: 'text-emerald-700 bg-emerald-100' },
              { icon: Landmark, label: t('ai.fixedDeposit'), text: rec.investments.fd, cls: 'border-cyan-200 bg-cyan-50', icls: 'text-cyan-700 bg-cyan-100' },
            ].map(({ icon: Icon, label, text, cls, icls }) => (
              <div key={label} className={`rounded-2xl border ${cls} p-3`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${icls}`}><Icon className="w-3 h-3" /></div>
                  <p className="text-xs font-semibold text-neutral-900">{label}</p>
                </div>
                <p className="text-[10px] text-neutral-600 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          {/* Savings tips */}
          <div className="rounded-2xl bg-white shadow-sm p-3">
            <p className="text-xs font-semibold text-neutral-900 mb-2 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-600" />{t('ai.savingsTips')}</p>
            <div className="space-y-1.5">
              {rec.savings.map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-neutral-600 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-neutral-400 text-center">{t('ai.disclaimer')}</p>
        </div>
      )}
    </div>
  )
  return <PlanGate feature="aiAdvisor">{inner}</PlanGate>
}
