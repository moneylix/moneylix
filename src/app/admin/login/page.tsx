'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Lock, User, ArrowLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function AdminLoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('moneylix_admin_auth', JSON.stringify({
          token: data.sessionToken,
          userId: data.userId,
          username: data.username,
        }))
        router.push('/admin')
      } else {
        setError(data.error || 'Invalid credentials')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent">
      <div className="w-full max-w-md animate-fadeIn">
        <Link
          href="/"
          className="inline-flex items-center gap-2 mb-8 text-slate-500 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">Back to Front</span>
        </Link>

        <div className="text-center mb-10">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-violet-500 to-purple-600 text-3xl font-black text-white shadow-2xl shadow-violet-500/30 ring-8 ring-violet-500/10 mb-6">
             <Shield className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">Admin OS</h1>
          <p className="mt-2 text-slate-400 font-medium text-sm">Moneylix — Restricted Internal Access</p>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-2xl p-8 shadow-2xl space-y-8">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs font-bold animate-shake">
              <div className="flex gap-2">
                <Shield className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                <User className="w-3.5 h-3.5" />
                Operator Identity
              </label>
              <Input
                type="text"
                required
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                placeholder="admin"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                <Lock className="w-3.5 h-3.5" />
                Security Key
              </label>
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
              className="w-full h-14 rounded-2xl font-black text-lg gap-2 mt-4 bg-gradient-to-r from-violet-500 to-purple-600 hover:opacity-90"
            >
              {loading ? (
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Enter Portal <ChevronRight className="w-5 h-5" /></>
              )}
            </Button>
          </form>

          <p className="text-center text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em] pt-4">
            Authorized Personnel Only
          </p>
        </div>
      </div>
    </div>
  )
}
