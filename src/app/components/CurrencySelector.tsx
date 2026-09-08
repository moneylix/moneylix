'use client'

import { useEffect, useState, useCallback } from 'react'
import { Globe, Check } from 'lucide-react'
import { useCurrency } from '@/lib/contexts/CurrencyContext'
import type { Currency } from '@/types'

interface CurrencySelectorProps {
  onCurrencyChange?: (currency: string) => void
}

export function CurrencySelector({ onCurrencyChange }: CurrencySelectorProps) {
  const { currentCurrency, setCurrentCurrency, currencies: ctxCurrencies } = useCurrency()
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [selectedCurrency, setSelectedCurrency] = useState<string>(currentCurrency)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ctxCurrencies.length > 0) {
      setCurrencies(ctxCurrencies)
      setLoading(false)
    } else {
      fetch('/api/currencies')
        .then(r => r.json())
        .then(data => { setCurrencies(data.currencies) })
        .catch(() => setError('Failed to load currencies'))
        .finally(() => setLoading(false))
    }
  }, [ctxCurrencies])

  useEffect(() => {
    setSelectedCurrency(currentCurrency)
  }, [currentCurrency])

  const handleUpdate = useCallback(async () => {
    if (selectedCurrency === currentCurrency) return
    try {
      await setCurrentCurrency(selectedCurrency)
      onCurrencyChange?.(selectedCurrency)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Failed to update currency')
    }
  }, [selectedCurrency, currentCurrency, setCurrentCurrency, onCurrencyChange])

  if (loading) return <div className="text-xs text-slate-400 py-2">Loading...</div>

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 mb-2">
        <Globe className="w-3.5 h-3.5 text-emerald-400" />
        <p className="text-xs font-semibold text-white">Currency</p>
        <span className="ml-auto text-[10px] text-slate-400">Active: <span className="text-emerald-300 font-bold">{currentCurrency}</span></span>
      </div>

      {error && <p className="text-[10px] text-rose-400">{error}</p>}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-800/50 border-b border-white/10">
            <tr>
              <th className="px-3 py-1.5 text-left text-[10px] font-medium text-slate-400">Symbol</th>
              <th className="px-3 py-1.5 text-left text-[10px] font-medium text-slate-400">Code</th>
              <th className="px-3 py-1.5 text-left text-[10px] font-medium text-slate-400">Name</th>
              <th className="px-3 py-1.5 text-right text-[10px] font-medium text-slate-400">Rate</th>
              <th className="px-3 py-1.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {currencies.map(c => {
              const isActive = c.code === currentCurrency
              const isSelected = c.code === selectedCurrency
              return (
                <tr key={c.code}
                  onClick={() => setSelectedCurrency(c.code)}
                  className={`cursor-pointer transition ${isSelected ? 'bg-emerald-500/10' : 'hover:bg-white/5'}`}>
                  <td className="px-3 py-1.5 font-bold text-white">{c.symbol}</td>
                  <td className="px-3 py-1.5 font-mono font-semibold text-slate-200">{c.code}</td>
                  <td className="px-3 py-1.5 text-slate-400">{c.name}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-slate-400">{c.rate.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">
                    {isActive && <span className="text-[10px] text-emerald-400 font-semibold">Active</span>}
                    {isSelected && !isActive && <Check className="w-3 h-3 text-emerald-400 ml-auto" />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={handleUpdate}
        disabled={selectedCurrency === currentCurrency || loading}
        className={`w-full py-1.5 rounded-xl text-xs font-bold transition ${
          saved ? 'bg-slate-700 text-emerald-400' :
          selectedCurrency === currentCurrency ? 'bg-slate-800 text-slate-500 cursor-not-allowed' :
          'bg-emerald-500 text-white hover:bg-emerald-600 shadow shadow-emerald-500/20'
        }`}>
        {saved ? '✓ Saved' : selectedCurrency === currentCurrency ? 'Select a currency to change' : `Set ${selectedCurrency} as default`}
      </button>
    </div>
  )
}
