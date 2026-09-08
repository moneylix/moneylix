'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import type { Currency } from '@/types'
import { useLocalStorage } from '@/lib/hooks/useLocalStorage'

interface CurrencyContextType {
  currentCurrency: string
  currencies: Currency[]
  setCurrentCurrency: (code: string) => Promise<void>
  refreshCurrencies: () => Promise<void>
  loading: boolean
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [currentCurrency, setCurrentCurrencyState] = useState<string>('INR')
  const [loading, setLoading] = useState(true)
  const [savedCode, setSavedCode] = useLocalStorage<string>('active_currency', 'INR')
  const savedCodeRef = useRef(savedCode)
  savedCodeRef.current = savedCode

  const refreshCurrencies = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/currencies')
      if (!res.ok) throw new Error('Failed to fetch currencies')
      const data = await res.json()
      const list: Currency[] = data.currencies || []
      setCurrencies(list)
      const current = savedCodeRef.current
      const valid = list.find(c => c.code === current) ? current : 'INR'
      setCurrentCurrencyState(valid)
      if (valid !== current) setSavedCode(valid)
    } catch (error) {
      console.error('Failed to fetch currencies:', error)
    } finally {
      setLoading(false)
    }
  }, [setSavedCode])

  useEffect(() => { refreshCurrencies() }, [refreshCurrencies])

  const setCurrentCurrency = async (code: string) => {
    const found = currencies.find(c => c.code === code)
    if (!found) return
    setCurrentCurrencyState(code)
    setSavedCode(code)
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    await fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ defaultCurrency: code }),
    })
  }

  return (
    <CurrencyContext.Provider value={{ currentCurrency, currencies, setCurrentCurrency, refreshCurrencies, loading }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (context === undefined) throw new Error('useCurrency must be used within a CurrencyProvider')
  return context
}
