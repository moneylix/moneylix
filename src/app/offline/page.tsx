import Image from 'next/image'
import Link from 'next/link'
import { WifiOff, RefreshCw } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#0a0f1a] flex flex-col items-center justify-center p-6 text-center">
      <Image
        src="/logos/moneylix-app-icon-dark.svg"
        alt="Moneylix"
        width={80}
        height={80}
        className="rounded-3xl mb-8"
      />

      <div className="w-16 h-16 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center mb-6">
        <WifiOff className="w-8 h-8 text-slate-400" />
      </div>

      <h1 className="text-2xl font-black text-white mb-3">You're offline</h1>
      <p className="text-slate-400 text-sm max-w-xs leading-relaxed mb-8">
        No internet connection. Check your network and try again. Your data is safe and will sync when you're back online.
      </p>

      <Link
        href="/dashboard"
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-slate-950 font-black text-sm hover:bg-emerald-400 transition"
      >
        <RefreshCw className="w-4 h-4" /> Try Again
      </Link>

      <p className="text-xs text-slate-600 mt-8">moneylix.in</p>
    </div>
  )
}
