'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { X, Download, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showAndroid, setShowAndroid] = useState(false)
  const [showIOS, setShowIOS] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('pwa_dismissed')) return

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
    if (isInStandaloneMode) return

    // The cookie banner is also a fixed bottom-0 overlay with its own timer.
    // Wait for it to be resolved first so the two never fight over the same
    // strip of screen — if the user never answers it, skip quietly this
    // pageview rather than stack on top of it.
    const cookieAnswered = () => !!localStorage.getItem('moneylix_cookie_consent')
    const scheduleAfterCookieBanner = (cb: () => void, delay: number) => {
      if (cookieAnswered()) {
        setTimeout(cb, delay)
        return
      }
      let elapsed = 0
      const poll = setInterval(() => {
        elapsed += 400
        if (cookieAnswered()) {
          clearInterval(poll)
          setTimeout(cb, delay)
        } else if (elapsed >= 20000) {
          clearInterval(poll)
        }
      }, 400)
    }

    if (isIOS) {
      scheduleAfterCookieBanner(() => setShowIOS(true), 800)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      scheduleAfterCookieBanner(() => setShowAndroid(true), 800)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShowAndroid(false)
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowAndroid(false)
    setShowIOS(false)
    setDismissed(true)
    localStorage.setItem('pwa_dismissed', '1')
  }

  if (dismissed) return null

  // Android install banner
  if (showAndroid) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-50 p-4 animate-slideUp">
        <div className="max-w-md mx-auto bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 shadow-2xl shadow-black/50 flex items-center gap-4">
          <Image src="/logos/moneylix-app-icon-dark.svg" alt="Moneylix" width={48} height={48} className="rounded-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white">Install Moneylix</p>
            <p className="text-xs text-slate-400 mt-0.5">Add to home screen for the best experience</p>
          </div>
          <button onClick={handleInstall}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black hover:bg-emerald-400 transition flex-shrink-0">
            <Download className="w-3.5 h-3.5" /> Install
          </button>
          <button onClick={handleDismiss} className="p-1 text-slate-500 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // iOS install instructions
  if (showIOS) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-50 p-4 animate-slideUp">
        <div className="max-w-md mx-auto bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Image src="/logos/moneylix-app-icon-dark.svg" alt="Moneylix" width={40} height={40} className="rounded-xl" />
              <div>
                <p className="text-sm font-black text-white">Install Moneylix</p>
                <p className="text-xs text-slate-400">Add to your home screen</p>
              </div>
            </div>
            <button onClick={handleDismiss} className="p-1 text-slate-500 hover:text-white transition">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-slate-800 rounded-xl p-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-black text-emerald-400">1</span>
              </div>
              <p className="text-xs text-slate-300">
                Tap the <Share className="w-3.5 h-3.5 inline text-blue-400 mx-0.5" /> <span className="font-bold text-white">Share</span> button at the bottom of Safari
              </p>
            </div>
            <div className="flex items-center gap-3 bg-slate-800 rounded-xl p-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-black text-emerald-400">2</span>
              </div>
              <p className="text-xs text-slate-300">
                Scroll down and tap <span className="font-bold text-white">"Add to Home Screen"</span>
              </p>
            </div>
            <div className="flex items-center gap-3 bg-slate-800 rounded-xl p-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-black text-emerald-400">3</span>
              </div>
              <p className="text-xs text-slate-300">
                Tap <span className="font-bold text-white">"Add"</span> — Moneylix appears on your home screen!
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
