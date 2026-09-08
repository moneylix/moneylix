'use client'

import { useEffect, useState, useCallback } from 'react'
import { Save, Check, Palette } from 'lucide-react'

const getToken = () => {
  try { return JSON.parse(localStorage.getItem('moneylix_admin_auth') ?? '{}').token ?? '' } catch { return '' }
}

export default function AdminBrandingPage() {
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

  const primary = settings.primary_color || '#10b981'
  const accent = settings.accent_color || '#22d3ee'

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
            <Palette className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Branding</h1>
            <p className="text-xs text-slate-400">Logo, colors, and theme defaults</p>
          </div>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-sm font-black hover:bg-emerald-400 transition disabled:opacity-60">
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Colors */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs font-black text-white uppercase tracking-widest mb-4">Brand Colors</p>
        <div className="grid sm:grid-cols-2 gap-5">
          {[
            { key: 'primary_color', label: 'Primary Color', val: primary },
            { key: 'accent_color', label: 'Accent Color', val: accent },
          ].map(c => (
            <div key={c.key}>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">{c.label}</label>
              <div className="flex items-center gap-3">
                <input type="color" value={c.val} onChange={e => set(c.key, e.target.value)}
                  className="w-12 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer" />
                <input type="text" value={c.val} onChange={e => set(c.key, e.target.value)}
                  className="flex-1 rounded-xl border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
              </div>
            </div>
          ))}
        </div>
        {/* Live preview */}
        <div className="mt-5 rounded-xl p-4" style={{ background: `linear-gradient(135deg, ${primary}22, ${accent}11)`, border: `1px solid ${primary}44` }}>
          <p className="text-xs text-slate-400 mb-2">Preview</p>
          <div className="flex gap-2">
            <span className="px-3 py-1.5 rounded-lg text-xs font-black" style={{ background: primary, color: '#04121e' }}>Primary Button</span>
            <span className="px-3 py-1.5 rounded-lg text-xs font-black" style={{ background: accent, color: '#04121e' }}>Accent</span>
          </div>
        </div>
      </div>

      {/* Logo & favicon URLs + theme */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs font-black text-white uppercase tracking-widest mb-4">Assets & Theme</p>
        <div className="space-y-4">
          {[
            { key: 'logo_url', label: 'Logo URL', ph: '/logos/moneylix-mark.svg' },
            { key: 'favicon_url', label: 'Favicon URL', ph: '/favicon.ico' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">{f.label}</label>
              <input type="text" value={settings[f.key] ?? ''} placeholder={f.ph} onChange={e => set(f.key, e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
            </div>
          ))}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Default Theme</label>
            <div className="flex gap-2">
              {['dark', 'light'].map(th => (
                <button key={th} onClick={() => set('default_theme', th)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition ${settings.default_theme === th ? 'bg-emerald-500 text-slate-950' : 'border border-white/10 text-white hover:bg-white/5'}`}>
                  {th}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
