'use client'

import { useState, useEffect, useCallback } from 'react'

type SetValue<T> = (value: T | ((prev: T) => T)) => void

export function useLocalStorage<T>(key: string, defaultValue: T): [T, SetValue<T>] {
  // Always start with defaultValue to prevent SSR/hydration mismatch
  const [value, setValue] = useState<T>(defaultValue)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = window.localStorage.getItem(key)
      if (stored !== null) {
        setValue(JSON.parse(stored) as T)
      }
    } catch {
      // Corrupted JSON or missing localStorage — stay on defaultValue
      try { window.localStorage.removeItem(key) } catch { /* quota exceeded or private mode */ }
    }
  }, [key])

  const set: SetValue<T> = useCallback((update) => {
    setValue(prev => {
      const next = typeof update === 'function' ? (update as (p: T) => T)(prev) : update
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Storage quota exceeded or private browsing — update state only
      }
      return next
    })
  }, [key])

  // Return defaultValue before mount so server and client renders match
  return [mounted ? value : defaultValue, set]
}

export function readLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue
  try {
    const stored = window.localStorage.getItem(key)
    return stored !== null ? (JSON.parse(stored) as T) : defaultValue
  } catch {
    return defaultValue
  }
}
