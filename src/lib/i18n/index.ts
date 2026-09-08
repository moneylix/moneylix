'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import React from 'react'

import en from './translations/en.json'
import ta from './translations/ta.json'
import hi from './translations/hi.json'

export type Language = 'en' | 'ta' | 'hi'

export const LANGUAGES: { code: Language; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
]

type TranslationMap = Record<string, Record<string, string>>

const translations: Record<Language, TranslationMap> = {
  en: en as unknown as TranslationMap,
  ta: ta as unknown as TranslationMap,
  hi: hi as unknown as TranslationMap,
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
})

function getNestedValue(obj: TranslationMap, key: string): string | undefined {
  const parts = key.split('.')
  if (parts.length !== 2) return undefined
  const [section, field] = parts
  return obj[section]?.[field]
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    // Read from localStorage first
    const stored = localStorage.getItem('moneylix_language') as Language | null
    if (stored && translations[stored]) {
      setLanguageState(stored)
      return
    }

    // Try to fetch from server
    const token = localStorage.getItem('moneylix_session_token')
    if (token) {
      fetch('/api/settings/language', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => {
          if (data.language && translations[data.language as Language]) {
            setLanguageState(data.language as Language)
            localStorage.setItem('moneylix_language', data.language)
          }
        })
        .catch(() => {})
    }
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('moneylix_language', lang)

    // Persist to server
    const token = localStorage.getItem('moneylix_session_token')
    if (token) {
      fetch('/api/settings/language', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ language: lang }),
      }).catch(() => {})
    }
  }, [])

  const t = useCallback((key: string): string => {
    // Try current language
    const value = getNestedValue(translations[language], key)
    if (value) return value

    // Fall back to English
    if (language !== 'en') {
      const fallback = getNestedValue(translations.en, key)
      if (fallback) return fallback
    }

    // Return the key itself as last resort
    return key
  }, [language])

  return React.createElement(
    LanguageContext.Provider,
    { value: { language, setLanguage, t } },
    children
  )
}

export function useTranslation() {
  return useContext(LanguageContext)
}

export { LanguageContext }
