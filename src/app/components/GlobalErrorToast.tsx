'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ToastItem {
  id: number
  message: string
}

let toastId = 0

export function GlobalErrorToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason ?? 'Unhandled error')
      addToast(msg)
    }

    const handleError = (e: ErrorEvent) => {
      addToast(e.message || 'Unexpected error')
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
    }
  }, [])

  const addToast = (message: string) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id))

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="flex items-center gap-2 bg-rose-950 border border-rose-500/30 text-white px-4 py-2.5 rounded-2xl shadow-2xl text-xs pointer-events-auto max-w-sm"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
          <span className="text-rose-200 flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="text-rose-400 hover:text-white transition">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
