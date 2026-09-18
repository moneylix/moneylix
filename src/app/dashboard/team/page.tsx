'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Users, Plus, X, Shield, Eye, Pencil, Trash2, Mail,
  CheckCircle2, Clock, XCircle, UserPlus,
} from 'lucide-react'
import { useBusiness } from '@/lib/contexts/BusinessContext'
import { useTranslation } from '@/lib/i18n'

interface TeamMember {
  id: number
  business_id: number
  user_id: number | null
  role: string
  invited_email: string | null
  invite_status: string
  permissions: string
  username: string | null
  user_email: string | null
  is_owner?: boolean
}

const ROLES = ['admin', 'accountant', 'staff', 'viewer'] as const

function getRoleConfig(t: (key: string) => string): Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> {
  return {
    owner:      { label: t('team.owner'),      cls: 'bg-amber-100 text-amber-700',   icon: Shield },
    admin:      { label: t('team.admin'),      cls: 'bg-blue-100 text-blue-700',     icon: Shield },
    accountant: { label: t('team.accountant'), cls: 'bg-violet-100 text-violet-700', icon: Eye },
    staff:      { label: t('team.staff'),      cls: 'bg-lime-100 text-lime-700',     icon: Pencil },
    viewer:     { label: t('team.viewer'),     cls: 'bg-neutral-100 text-neutral-600', icon: Eye },
  }
}

function getStatusConfig(t: (key: string) => string): Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> {
  return {
    accepted: { label: t('team.active'),   cls: 'bg-lime-100 text-lime-700',   icon: CheckCircle2 },
    pending:  { label: t('team.pending'),  cls: 'bg-amber-100 text-amber-700', icon: Clock },
    declined: { label: t('team.declined'), cls: 'bg-rose-100 text-rose-700',   icon: XCircle },
  }
}

export default function TeamPage() {
  const { t } = useTranslation()
  const roleConfig = getRoleConfig(t)
  const statusConfig = getStatusConfig(t)
  const { activeBusiness } = useBusiness()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editRole, setEditRole] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('staff')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const fetchMembers = useCallback(async () => {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const res = await fetch(`/api/team?businessId=${activeBusiness.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setMembers(data.members ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [activeBusiness])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeBusiness || !inviteEmail.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          businessId: activeBusiness.id,
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || t('team.failedToInvite')); return }
      setShowInvite(false)
      setInviteEmail('')
      setInviteRole('staff')
      fetchMembers()
    } catch {
      setError(t('team.networkError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateRole = async (memberId: number) => {
    if (!editRole) return
    setSubmitting(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      await fetch(`/api/team/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ role: editRole }),
      })
      setEditingId(null)
      setEditRole('')
      fetchMembers()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (memberId: number) => {
    if (!confirm(t('team.removeConfirm'))) return
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      await fetch(`/api/team/${memberId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      fetchMembers()
    } catch (e) {
      console.error(e)
    }
  }

  const activeCount = members.filter((m) => m.invite_status === 'accepted' || m.is_owner).length
  const pendingCount = members.filter((m) => m.invite_status === 'pending').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold text-neutral-900">{t('team.title')}</h1>
          <p className="text-[10px] text-neutral-400">
            {t('team.manageAccessPrefix')} {activeBusiness?.name ?? t('team.thisBusiness')}
          </p>
        </div>
        <button
          onClick={() => { setShowInvite(true); setError('') }}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-lime-400 text-neutral-900 hover:bg-lime-300 transition font-bold"
        >
          <UserPlus className="w-3 h-3" /> {t('team.inviteMember')}
        </button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-lime-50 text-lime-700">
          <Users className="w-3 h-3" />
          <span className="text-[10px] text-neutral-400">{t('team.active')}:</span>
          <span className="text-xs font-bold">{activeCount}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 text-amber-700">
          <Clock className="w-3 h-3" />
          <span className="text-[10px] text-neutral-400">{t('team.pending')}:</span>
          <span className="text-xs font-bold">{pendingCount}</span>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white shadow-sm rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-neutral-400 text-xs gap-1">
            <p>{t('team.noMembersYet')}</p>
            <button onClick={() => setShowInvite(true)} className="text-lime-700 font-semibold">
              {t('team.inviteSomeone')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-3 sm:mx-0"><table className="w-full text-xs">
            <thead className="border-b border-black/5 bg-neutral-50">
              <tr>
                {[t('team.member'), t('team.role'), t('common.status'), t('common.email'), ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-neutral-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {members.map((m) => {
                const rc = roleConfig[m.role] || roleConfig.viewer
                const sc = statusConfig[m.is_owner ? 'accepted' : m.invite_status] || statusConfig.pending
                const RIcon = rc.icon
                const SIcon = sc.icon
                return (
                  <tr key={m.id + '-' + (m.user_id ?? m.invited_email)} className="hover:bg-neutral-50 transition">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-500">
                          {(m.username ?? m.invited_email ?? '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-neutral-900">
                            {m.username ?? m.invited_email ?? t('team.unknown')}
                          </p>
                          {m.is_owner && (
                            <span className="text-[9px] text-amber-600 font-semibold">{t('team.businessOwner')}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {editingId === m.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="text-[10px] px-1.5 py-1 border border-neutral-200 rounded-lg"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{roleConfig[r]?.label ?? r}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleUpdateRole(m.id)}
                            disabled={submitting}
                            className="text-[10px] px-1.5 py-0.5 bg-lime-400 text-neutral-900 rounded font-bold"
                          >
                            {t('common.save')}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-[10px] px-1.5 py-0.5 text-neutral-400"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${rc.cls}`}>
                          <RIcon className="w-2.5 h-2.5" />
                          {rc.label}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sc.cls}`}>
                        <SIcon className="w-2.5 h-2.5" />
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-400">
                      <span className="flex items-center gap-1 text-[10px]">
                        <Mail className="w-3 h-3" />
                        {m.user_email ?? m.invited_email ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {!m.is_owner && (
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => { setEditingId(m.id); setEditRole(m.role) }}
                            className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 transition"
                            title={t('team.editRole')}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleRemove(m.id)}
                            className="p-1 rounded-lg hover:bg-rose-50 text-neutral-400 hover:text-rose-600 transition"
                            title={t('team.remove')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Invite Modal */}
      {showInvite && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 animate-scaleIn">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-neutral-900">{t('team.inviteTeamMember')}</h2>
              <button onClick={() => setShowInvite(false)} className="p-1 text-neutral-400 hover:text-neutral-900 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-[10px]">{error}</div>
            )}

            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 mb-1 block">{t('team.emailAddress')}</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-lime-400 transition"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 mb-1 block">{t('team.role')}</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-lime-400 transition"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{roleConfig[r]?.label ?? r}</option>
                  ))}
                </select>
              </div>

              {/* Role description */}
              <div className="px-3 py-2 rounded-xl bg-neutral-50 text-[10px] text-neutral-500">
                {inviteRole === 'admin' && t('team.adminDesc')}
                {inviteRole === 'accountant' && t('team.accountantDesc')}
                {inviteRole === 'staff' && t('team.staffDesc')}
                {inviteRole === 'viewer' && t('team.viewerDesc')}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !inviteEmail.trim()}
                  className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold bg-lime-400 text-neutral-900 hover:bg-lime-300 rounded-xl transition disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-3 h-3 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                  {t('team.sendInvitation')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
