'use client'

import { useState, useCallback, useEffect } from 'react'
import { Delete } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

const buttons = [
  ['C', '+/-', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '⌫', '='],
]

export default function CalculatorPage() {
  const { t } = useTranslation()
  const [display, setDisplay] = useState('0')
  const [expression, setExpression] = useState('')
  const [prevValue, setPrevValue] = useState<number | null>(null)
  const [operator, setOperator] = useState<string | null>(null)
  const [waitingForNext, setWaitingForNext] = useState(false)
  const [history, setHistory] = useState<string[]>([])

  const calculate = useCallback((a: number, op: string, b: number): number => {
    switch (op) { case '+': return a + b; case '−': return a - b; case '×': return a * b; case '÷': return b !== 0 ? a / b : 0; default: return b }
  }, [])

  const handleNumber = useCallback((num: string) => {
    if (waitingForNext) { setDisplay(num); setWaitingForNext(false) }
    else setDisplay(prev => prev === '0' ? num : prev.length >= 15 ? prev : prev + num)
  }, [waitingForNext])

  const handleDecimal = useCallback(() => {
    if (waitingForNext) { setDisplay('0.'); setWaitingForNext(false); return }
    if (!display.includes('.')) setDisplay(d => d + '.')
  }, [display, waitingForNext])

  const handleOperator = useCallback((op: string) => {
    const current = parseFloat(display)
    if (prevValue !== null && !waitingForNext) {
      const result = calculate(prevValue, operator!, current)
      const fmt = parseFloat(result.toPrecision(12)).toString()
      setDisplay(fmt); setPrevValue(result); setExpression(`${fmt} ${op}`)
    } else { setPrevValue(current); setExpression(`${display} ${op}`) }
    setOperator(op); setWaitingForNext(true)
  }, [display, prevValue, operator, waitingForNext, calculate])

  const handleEquals = useCallback(() => {
    if (prevValue === null || operator === null) return
    const current = parseFloat(display)
    const result = calculate(prevValue, operator, current)
    const fmt = parseFloat(result.toPrecision(12)).toString()
    setHistory(h => [`${expression} ${display} = ${fmt}`, ...h].slice(0, 10))
    setDisplay(fmt); setExpression(''); setPrevValue(null); setOperator(null); setWaitingForNext(true)
  }, [display, prevValue, operator, expression, calculate])

  const handleClear = useCallback(() => { setDisplay('0'); setExpression(''); setPrevValue(null); setOperator(null); setWaitingForNext(false) }, [])
  const handleBackspace = useCallback(() => { if (waitingForNext) return; setDisplay(d => d.length > 1 ? d.slice(0, -1) : '0') }, [waitingForNext])
  const handlePlusMinus = useCallback(() => setDisplay(d => d.startsWith('-') ? d.slice(1) : '-' + d), [])
  const handlePercent = useCallback(() => setDisplay(d => (parseFloat(d) / 100).toString()), [])

  const handleButton = useCallback((btn: string) => {
    if (btn >= '0' && btn <= '9') return handleNumber(btn)
    if (btn === '.') return handleDecimal()
    if (['+', '−', '×', '÷'].includes(btn)) return handleOperator(btn)
    if (btn === '=') return handleEquals()
    if (btn === 'C') return handleClear()
    if (btn === '⌫') return handleBackspace()
    if (btn === '+/-') return handlePlusMinus()
    if (btn === '%') return handlePercent()
  }, [handleNumber, handleDecimal, handleOperator, handleEquals, handleClear, handleBackspace, handlePlusMinus, handlePercent])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleNumber(e.key)
      else if (e.key === '.') handleDecimal()
      else if (e.key === '+') handleOperator('+')
      else if (e.key === '-') handleOperator('−')
      else if (e.key === '*') handleOperator('×')
      else if (e.key === '/') { e.preventDefault(); handleOperator('÷') }
      else if (e.key === 'Enter' || e.key === '=') handleEquals()
      else if (e.key === 'Backspace') handleBackspace()
      else if (e.key === 'Escape') handleClear()
      else if (e.key === '%') handlePercent()
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [handleNumber, handleDecimal, handleOperator, handleEquals, handleBackspace, handleClear, handlePercent])

  const btnStyle = (btn: string) => {
    if (btn === '=') return 'bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950 font-bold'
    if (['+', '−', '×', '÷'].includes(btn)) return 'bg-lime-100 text-lime-700 font-bold hover:bg-lime-200'
    if (['C', '+/-', '%'].includes(btn)) return 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
    if (btn === '⌫') return 'bg-neutral-100 text-rose-600 hover:bg-rose-50'
    return 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200'
  }

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-base font-bold text-neutral-900">{t('nav.calculator')}</h1>
        <p className="text-[10px] text-neutral-400">{t('calculator.subtitle')}</p>
      </div>

      <div className="flex gap-3 items-start">
        {/* Calculator pad */}
        <div className="w-56 rounded-2xl bg-white shadow-sm overflow-hidden flex-shrink-0">
          <div className="px-4 py-3 min-h-[72px] flex flex-col justify-end items-end bg-neutral-50">
            <p className="text-[10px] text-neutral-400 truncate w-full text-right">{expression || ' '}</p>
            <p className={`font-bold text-neutral-900 font-mono break-all text-right ${display.length > 10 ? 'text-xl' : display.length > 7 ? 'text-2xl' : 'text-3xl'}`}>{display}</p>
          </div>
          <div className="p-2 grid grid-cols-4 gap-1.5">
            {buttons.flat().map((btn, i) => (
              <button key={i} onClick={() => handleButton(btn)}
                className={`h-10 rounded-xl text-sm font-semibold transition-all active:scale-95 ${btnStyle(btn)}`}>
                {btn === '⌫' ? <Delete className="w-3.5 h-3.5 mx-auto" /> : btn}
              </button>
            ))}
          </div>
        </div>

        {/* History */}
        <div className="flex-1 rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-black/5 bg-neutral-50">
            <p className="text-xs font-semibold text-neutral-900">{t('calculator.history')}</p>
            {history.length > 0 && <button onClick={() => setHistory([])} className="text-[10px] text-neutral-400 hover:text-rose-600 transition">{t('calculator.clear')}</button>}
          </div>
          {history.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-neutral-300 text-xs">{t('calculator.noCalculationsYet')}</div>
          ) : (
            <div className="divide-y divide-black/5">
              {history.map((entry, i) => {
                const parts = entry.split('=')
                return (
                  <div key={i} onClick={() => { const r = parts[1]?.trim(); if (r) { setDisplay(r); setWaitingForNext(true) } }}
                    className="px-3 py-2 cursor-pointer hover:bg-neutral-50 transition">
                    <p className="text-[10px] text-neutral-400">{parts[0]?.trim()} =</p>
                    <p className="text-sm font-bold font-mono text-lime-700">{parts[1]?.trim()}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
