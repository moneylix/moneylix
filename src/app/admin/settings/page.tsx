'use client'

import { useEffect, useState, useCallback } from 'react'
import { Save, Check, Settings as SettingsIcon } from 'lucide-react'

const getToken = () => {
  try { return JSON.parse(localStorage.getItem('moneylix_admin_auth') ?? '{}').token ?? '' } catch { return '' }
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${getToken()}` } })
    const data = await res.json()
    setSettings(data.settings ?? {})
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const set = (k: string, v: string) => setSettings(s => ({ ...s, [k]: v }))
  const bool = (k: string) => settings[k] === 'true'
  const toggle = (k: string) => set(k, bool(k) ? 'false' : 'true')

  const save = async () => {
    setSaving(true); setSaved(false)
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ settings }),
    })
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
    setSaving(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>

  const textFields = [
    { key: 'app_name', label: 'App Name', ph: 'Moneylix' },
    { key: 'currency_symbol', label: 'Currency Symbol', ph: '₹' },
    { key: 'default_currency', label: 'Default Currency', ph: 'INR' },
    { key: 'rows_per_page', label: 'Rows Per Page', ph: '20', type: 'number' },
    { key: 'support_email', label: 'Support Email', ph: 'support@moneylix.in' },
    { key: 'support_phone', label: 'Support Phone', ph: '+91 ...' },
  ]

  const toggles = [
    { key: 'allow_registration', label: 'Allow New Registrations', desc: 'Let new users sign up' },
    { key: 'scope_users_to_self', label: 'Scope Users to Own Data', desc: 'Users only see their own records' },
    { key: 'maintenance_mode', label: 'Maintenance Mode', desc: 'Show a maintenance notice to users' },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">General Settings</h1>
            <p className="text-xs text-slate-400">Live app configuration — no restart needed</p>
          </div>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-sm font-black hover:bg-emerald-400 transition disabled:opacity-60">
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Text fields */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs font-black text-white uppercase tracking-widest mb-4">Application</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {textFields.map(f => (
            <div key={f.key}>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">{f.label}</label>
              <input
                type={f.type ?? 'text'}
                value={settings[f.key] ?? ''}
                placeholder={f.ph}
                onChange={e => set(f.key, e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs font-black text-white uppercase tracking-widest mb-4">Feature Toggles</p>
        <div className="space-y-3">
          {toggles.map(t => (
            <div key={t.key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-semibold text-white">{t.label}</p>
                <p className="text-[11px] text-slate-500">{t.desc}</p>
              </div>
              <button onClick={() => toggle(t.key)}
                className={`relative w-11 h-6 rounded-full transition ${bool(t.key) ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${bool(t.key) ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
