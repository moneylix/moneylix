'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { User, Mail, Lock, CheckCircle, AlertCircle, Crown, Calendar, ArrowLeft } from 'lucide-react'

interface Profile {
  id: number
  username: string
  email: string
  createdAt: string
  plan: string
  planStatus: string
  planExpires: string | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Form state
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [editingField, setEditingField] = useState<'username' | 'email' | 'password' | null>(null)

  const getToken = () => localStorage.getItem('moneylix_session_token') || ''

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/user/profile', {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setProfile(data)
        setUsername(data.username)
        setEmail(data.email)
      } catch {
        showToast('Failed to load profile', 'error')
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleSave = async (field: 'username' | 'email' | 'password') => {
    setSaving(true)
    try {
      let body: Record<string, string> = {}

      if (field === 'username') {
        if (username === profile?.username) { setEditingField(null); setSaving(false); return }
        body = { username }
      } else if (field === 'email') {
        if (email === profile?.email) { setEditingField(null); setSaving(false); return }
        body = { email }
      } else if (field === 'password') {
        if (!currentPassword || !newPassword) {
          showToast('Fill in both password fields', 'error')
          setSaving(false)
          return
        }
        if (newPassword !== confirmPassword) {
          showToast('New passwords do not match', 'error')
          setSaving(false)
          return
        }
        if (newPassword.length < 8) {
          showToast('Password must be at least 8 characters', 'error')
          setSaving(false)
          return
        }
        body = { currentPassword, newPassword }
      }

      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || 'Failed to update', 'error')
      } else {
        showToast(field === 'password' ? 'Password changed!' : `${field.charAt(0).toUpperCase() + field.slice(1)} updated!`)
        setEditingField(null)
        if (field === 'username') setProfile(p => p ? { ...p, username } : null)
        if (field === 'email') setProfile(p => p ? { ...p, email } : null)
        if (field === 'password') {
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
        }
      }
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-40 bg-white/10 rounded" />
        <div className="h-32 bg-white/5 rounded-2xl" />
        <div className="h-24 bg-white/5 rounded-2xl" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center py-12 text-slate-400">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">Failed to load profile</p>
      </div>
    )
  }

  const planColors: Record<string, string> = {
    free: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    pro: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    premium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  }

  return (
    <div className="space-y-4 max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 rounded-xl hover:bg-white/5 transition">
          <ArrowLeft className="w-4 h-4 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-white">Profile</h1>
          <p className="text-[10px] text-slate-400">Manage your account details</p>
        </div>
      </div>

      {/* Profile card */}
      <div className="rounded-2xl bg-white shadow-sm p-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-lime-200 to-cyan-200 flex items-center justify-center">
            <span className="text-xl font-black text-lime-700">
              {profile.username[0]?.toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-bold text-white">{profile.username}</p>
            <p className="text-[11px] text-slate-400">{profile.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${planColors[profile.plan] || planColors.free}`}>
                <Crown className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
                {profile.plan.toUpperCase()}
              </span>
              <span className="text-[9px] text-slate-500 flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" />
                Joined {new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Username */}
      <div className="rounded-2xl bg-white shadow-sm p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            <p className="text-xs font-semibold text-white">Username</p>
          </div>
          {editingField !== 'username' && (
            <button onClick={() => setEditingField('username')} className="text-[10px] text-lime-700 font-semibold hover:text-lime-600">
              Edit
            </button>
          )}
        </div>
        {editingField === 'username' ? (
          <div className="mt-2 space-y-2">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              maxLength={30}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { setEditingField(null); setUsername(profile.username) }} className="px-3 py-1.5 rounded-lg border border-white/10 text-[11px] text-slate-400 hover:bg-white/5">Cancel</button>
              <button onClick={() => handleSave('username')} disabled={saving || username.length < 3} className="px-3 py-1.5 rounded-lg bg-lime-400 text-[11px] font-semibold text-neutral-900 hover:bg-lime-300 disabled:opacity-40">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-300 ml-6">{profile.username}</p>
        )}
      </div>

      {/* Email */}
      <div className="rounded-2xl bg-white shadow-sm p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400" />
            <p className="text-xs font-semibold text-white">Email</p>
          </div>
          {editingField !== 'email' && (
            <button onClick={() => setEditingField('email')} className="text-[10px] text-lime-700 font-semibold hover:text-lime-600">
              Edit
            </button>
          )}
        </div>
        {editingField === 'email' ? (
          <div className="mt-2 space-y-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { setEditingField(null); setEmail(profile.email) }} className="px-3 py-1.5 rounded-lg border border-white/10 text-[11px] text-slate-400 hover:bg-white/5">Cancel</button>
              <button onClick={() => handleSave('email')} disabled={saving || !email.includes('@')} className="px-3 py-1.5 rounded-lg bg-lime-400 text-[11px] font-semibold text-neutral-900 hover:bg-lime-300 disabled:opacity-40">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-300 ml-6">{profile.email}</p>
        )}
      </div>

      {/* Change Password */}
      <div className="rounded-2xl bg-white shadow-sm p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-400" />
            <p className="text-xs font-semibold text-white">Password</p>
          </div>
          {editingField !== 'password' && (
            <button onClick={() => setEditingField('password')} className="text-[10px] text-lime-700 font-semibold hover:text-lime-600">
              Change
            </button>
          )}
        </div>
        {editingField === 'password' ? (
          <div className="mt-2 space-y-2">
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              autoFocus
            />
            <input
              type="password"
              placeholder="New password (min 8 characters)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[10px] text-rose-400">Passwords do not match</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setEditingField(null); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }} className="px-3 py-1.5 rounded-lg border border-white/10 text-[11px] text-slate-400 hover:bg-white/5">Cancel</button>
              <button
                onClick={() => handleSave('password')}
                disabled={saving || !currentPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                className="px-3 py-1.5 rounded-lg bg-lime-400 text-[11px] font-semibold text-neutral-900 hover:bg-lime-300 disabled:opacity-40"
              >
                {saving ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-300 ml-6">••••••••</p>
        )}
      </div>

      {/* Plan Info */}
      {profile.planExpires && (
        <div className="rounded-2xl bg-white shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-4 h-4 text-amber-400" />
            <p className="text-xs font-semibold text-white">Subscription</p>
          </div>
          <p className="text-sm text-slate-300 ml-6">
            {profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)} plan · Expires {new Date(profile.planExpires).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <Link href="/dashboard/pricing" className="text-[10px] text-lime-700 font-semibold ml-6 hover:underline">
            Manage plan →
          </Link>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full shadow-2xl z-50 text-xs border ${
          toast.type === 'success' 
            ? 'bg-emerald-900/90 border-emerald-500/30 text-emerald-200' 
            : 'bg-rose-900/90 border-rose-500/30 text-rose-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {toast.message}
        </div>
      )}
    </div>
  )
}
