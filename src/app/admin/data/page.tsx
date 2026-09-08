'use client'

import { useState } from 'react'
import { Database, Download, AlertTriangle, Trash2 } from 'lucide-react'

const getToken = () => {
  try { return JSON.parse(localStorage.getItem('moneylix_admin_auth') ?? '{}').token ?? '' } catch { return '' }
}

export default function AdminDataPage() {
  const [downloading, setDownloading] = useState(false)
  const [resetScope, setResetScope] = useState<'transactions' | 'all' | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const download = async () => {
    setDownloading(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/data/backup', { headers: { Authorization: `Bearer ${getToken()}` } })
      if (!res.ok) throw new Error('Backup failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `moneylix-backup-${new Date().toISOString().slice(0, 10)}.db`
      a.click()
      URL.revokeObjectURL(url)
      setMsg({ type: 'ok', text: 'Backup downloaded successfully.' })
    } catch {
      setMsg({ type: 'err', text: 'Backup failed. Check server logs.' })
    } finally { setDownloading(false) }
  }

  const REQUIRED: Record<string, string> = { transactions: 'RESET_DATA', all: 'FACTORY_RESET' }

  const doReset = async () => {
    if (!resetScope) return
    if (confirmText !== REQUIRED[resetScope]) {
      setMsg({ type: 'err', text: `Type "${REQUIRED[resetScope]}" exactly to confirm.` }); return
    }
    setResetting(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/data/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ scope: resetScope, confirm: confirmText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Reset failed')
      setMsg({ type: 'ok', text: `${resetScope === 'all' ? 'Factory reset' : 'Data reset'} completed. A backup was saved server-side first.` })
      setResetScope(null); setConfirmText('')
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message || 'Reset failed' })
    } finally { setResetting(false) }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
          <Database className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Data Management</h1>
          <p className="text-xs text-slate-400">Backup and reset — handle with care</p>
        </div>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm ${msg.type === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
          {msg.text}
        </div>
      )}

      {/* Backup */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm font-black text-white">Database Backup</p>
        <p className="text-xs text-slate-400 mt-1 mb-4">Download the live database as a timestamped file. Keep it somewhere safe.</p>
        <button onClick={download} disabled={downloading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 text-slate-950 text-sm font-black hover:bg-cyan-400 transition disabled:opacity-60">
          <Download className="w-4 h-4" /> {downloading ? 'Preparing...' : 'Download Backup'}
        </button>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <p className="text-sm font-black text-rose-400 uppercase tracking-widest">Danger Zone</p>
        </div>

        <div className="space-y-3">
          {[
            { scope: 'transactions' as const, label: 'Reset Transactional Data', desc: 'Wipes transactions, invoices, bank data, loans, payroll, inventory. Keeps users, businesses & settings.' },
            { scope: 'all' as const, label: 'Factory Reset', desc: 'Removes ALL non-admin users and their data. Only admin accounts and settings remain.' },
          ].map(item => (
            <div key={item.scope} className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                </div>
                <button onClick={() => { setResetScope(item.scope); setConfirmText(''); setMsg(null) }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-500/30 text-rose-400 text-xs font-bold hover:bg-rose-500/10 transition flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" /> Reset
                </button>
              </div>

              {resetScope === item.scope && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-slate-400 mb-2">
                    Type <span className="font-mono font-black text-rose-400">{REQUIRED[item.scope]}</span> to confirm. A server-side backup is made automatically first.
                  </p>
                  <div className="flex gap-2">
                    <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={REQUIRED[item.scope]}
                      className="flex-1 rounded-xl border border-rose-500/30 bg-slate-800/50 px-3 py-2 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50" />
                    <button onClick={doReset} disabled={resetting || confirmText !== REQUIRED[item.scope]}
                      className="px-4 py-2 rounded-xl bg-rose-500 text-white text-sm font-black hover:bg-rose-400 transition disabled:opacity-40">
                      {resetting ? 'Working...' : 'Confirm'}
                    </button>
                    <button onClick={() => { setResetScope(null); setConfirmText('') }}
                      className="px-4 py-2 rounded-xl border border-white/10 text-white text-sm font-bold hover:bg-white/5 transition">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
