'use client'

import { useState } from 'react'
import { Send, Users, CheckCircle, Megaphone } from 'lucide-react'
import Button from '@/components/ui/Button'

const PLAN_OPTIONS = [
  { value: 'all', label: 'All Users', desc: 'Every verified user' },
  { value: 'free', label: 'Free Plan', desc: 'Users on free tier' },
  { value: 'pro', label: 'Pro Plan', desc: 'Active Pro subscribers' },
  { value: 'premium', label: 'Premium Plan', desc: 'Active Premium subscribers' },
]

export default function BroadcastPage() {
  const [form, setForm] = useState({ subject: '', message: '', plan_filter: 'all' })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ recipients: number } | null>(null)
  const [error, setError] = useState('')

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      const auth = JSON.parse(localStorage.getItem('moneylix_admin_auth') ?? '{}')
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult({ recipients: data.recipients })
      setForm({ subject: '', message: '', plan_filter: 'all' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-3">
          <Megaphone className="w-6 h-6 text-amber-400" /> Broadcast Notification
        </h1>
        <p className="text-sm text-slate-400 mt-1">Send a message to all or selected users</p>
      </div>

      {result && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-semibold">Broadcast sent to {result.recipients} users successfully.</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSend} className="space-y-5 bg-slate-900 border border-slate-800 rounded-3xl p-6">
        {/* Target audience */}
        <div>
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-3">Target Audience</label>
          <div className="grid grid-cols-2 gap-2">
            {PLAN_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm(p => ({ ...p, plan_filter: opt.value }))}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                  form.plan_filter === opt.value
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                <Users className="w-4 h-4 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold">{opt.label}</p>
                  <p className="text-[10px] text-slate-500">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Subject</label>
          <input
            type="text" required
            value={form.subject}
            onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
            placeholder="e.g. New feature available!"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Message */}
        <div>
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Message</label>
          <textarea
            required rows={5}
            value={form.message}
            onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
            placeholder="Write your notification message here..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
          />
        </div>

        <Button type="submit" disabled={sending} className="w-full gap-2">
          <Send className="w-4 h-4" />
          {sending ? 'Sending...' : 'Send Broadcast'}
        </Button>
      </form>
    </div>
  )
}
