'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Lock, Zap, ShieldCheck, ChevronRight, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle')

  const verified = searchParams.get('verified') === 'true'

  const doLogin = async (username: string, password: string) => {
    setLoading(true)
    setError('')
    setUnverifiedEmail(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await res.json()

      if (res.ok) {
        localStorage.setItem('moneylix_auth', 'logged_in')
        if (data.sessionToken) localStorage.setItem('moneylix_session_token', data.sessionToken)
        if (data.userId) localStorage.setItem('moneylix_user_id', String(data.userId))
        router.push('/dashboard')
      } else if (data.code === 'EMAIL_NOT_VERIFIED') {
        setError(data.error)
        setUnverifiedEmail(data.email ?? null)
      } else {
        setError(data.error || 'Invalid credentials')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!unverifiedEmail) return
    setResendStatus('sending')
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail }),
      })
      setResendStatus('sent')
    } catch {
      setResendStatus('idle')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    doLogin(form.username, form.password)
  }

  const handleDemoLogin = () => {
    setForm({ username: 'demo', password: 'demo' })
    doLogin('demo', 'demo')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-5 py-8 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent">
      <div className="w-full max-w-sm animate-fadeIn">
        <div className="text-center mb-5">
          <img src="/logos/moneylix-app-icon-dark.svg" alt="Moneylix" className="h-14 w-14 mb-3 mx-auto drop-shadow-2xl" />
          <h1 className="text-2xl font-black text-white tracking-tight">Sign In</h1>
          <p className="mt-1 text-sm text-slate-400">Welcome back to Moneylix</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl p-5 shadow-2xl space-y-5">
          {/* Demo Login Button */}
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-500 p-px shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-60"
          >
            <div className="flex items-center justify-center gap-2 rounded-[14px] bg-slate-950/80 px-5 py-3 font-black text-emerald-400 backdrop-blur-xl transition group-hover:bg-transparent group-hover:text-slate-950">
              <Zap className="w-5 h-5" />
              {loading ? 'Authenticating...' : 'Instant Demo Access'}
            </div>
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-[0.2em]"><span className="bg-[#0f172a] p-2 text-slate-500 backdrop-blur-md rounded-lg border border-white/5">Manual Entry</span></div>
          </div>

          {verified && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300 text-xs font-bold">
              Email verified! You can now sign in.
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs font-bold animate-shake">
              <div className="flex gap-2 items-start">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span>{error}</span>
                  {unverifiedEmail && (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendStatus !== 'idle'}
                      className="mt-2 flex items-center gap-1.5 text-rose-200 hover:text-white disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {resendStatus === 'sent' ? 'Email sent!' : resendStatus === 'sending' ? 'Sending…' : 'Resend verification email'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                <Mail className="w-3.5 h-3.5" />
                User Identity
              </label>
              <Input
                type="text"
                required
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                placeholder="demo"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  Access Key
                </label>
                <Link href="/auth/forgot-password" className="text-[10px] font-bold text-slate-500 hover:text-emerald-400 transition-colors uppercase tracking-widest">
                  Forgot?
                </Link>
              </div>
              <Input
                type="password"
                required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl font-black text-base gap-2 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Sign In <ChevronRight className="w-5 h-5" /></>
              )}
            </Button>
          </form>

          <div className="text-center pt-2">
            <p className="text-xs text-slate-500 font-medium">
              New to Moneylix?{' '}
              <Link href="/auth/register" className="text-emerald-400 hover:text-emerald-300 font-black transition-colors">
                Create Identity
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center mt-8 text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">
           Protected by SecureFlow Intelligence
        </p>
      </div>
    </div>
  )
}
