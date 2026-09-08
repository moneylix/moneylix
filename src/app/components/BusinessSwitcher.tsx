'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Plus, ChevronDown, Check, Pencil, Trash2, X } from 'lucide-react'
import { useBusiness } from '@/lib/contexts/BusinessContext'

export function BusinessSwitcher({ compact = false }: { compact?: boolean }) {
  const { activeBusiness, businesses, setActiveBusinessId, refreshBusinesses } = useBusiness()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setAdding(false)
        setEditingId(null)
        setDeletingId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) {
        await refreshBusinesses()
        setNewName('')
        setAdding(false)
      }
    } catch (error) {
      console.error('Failed to create business:', error)
    }
  }

  const handleEdit = async (e: React.FormEvent, id: number) => {
    e.preventDefault()
    if (!editName.trim()) return
    try {
      const res = await fetch(`/api/businesses/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: editName.trim() }),
      })
      if (res.ok) {
        await refreshBusinesses()
        setEditingId(null)
      }
    } catch (error) {
      console.error('Failed to update business:', error)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const res = await fetch(`/api/businesses/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        if (activeBusiness?.id === id) {
          const other = businesses.find(b => b.id !== id)
          if (other) setActiveBusinessId(other.id)
        }
        await refreshBusinesses()
        setDeletingId(null)
      }
    } catch (error) {
      console.error('Failed to delete business:', error)
    }
  }

  return (
    <>
      {/* Full-screen backdrop blur — mobile only */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm"
          onClick={() => { setOpen(false); setAdding(false); setEditingId(null); setDeletingId(null) }}
        />
      )}

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => { setOpen(!open); setAdding(false); setEditingId(null); setDeletingId(null) }}
          className={`w-full flex items-center justify-between gap-2 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 transition border border-white/10 active:scale-95 ${compact ? 'px-3 py-2.5' : 'px-3 py-2'}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`rounded-lg bg-gradient-to-br from-emerald-400/30 to-cyan-400/20 flex items-center justify-center text-emerald-300 font-bold flex-shrink-0 ${compact ? 'w-7 h-7 text-sm' : 'w-7 h-7 text-sm'}`}>
              {activeBusiness?.name?.[0]?.toUpperCase() || 'B'}
            </div>
            <span className="text-white text-sm font-medium truncate">
              {activeBusiness?.name || 'Loading...'}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className={`absolute top-full left-0 rounded-2xl border border-white/15 bg-slate-900 shadow-2xl z-[60] overflow-hidden ${compact ? 'w-full mt-1' : 'w-64 mt-2'}`}>
            {/* Business list */}
            <div className={`overflow-y-auto p-2 space-y-0.5 ${compact ? 'max-h-52' : 'max-h-72'}`}>
              {businesses.map((b) => {
                const isActive = activeBusiness?.id === b.id
                const isEditing = editingId === b.id
                const isDeleting = deletingId === b.id

                if (isEditing) {
                  return (
                    <form key={b.id} onSubmit={(e) => handleEdit(e, b.id)} className="flex items-center gap-2 px-2 py-1.5">
                      <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="flex-1 bg-slate-800 border border-emerald-400/40 rounded-lg px-2 py-1 text-sm text-white outline-none"
                      />
                      <button type="submit" className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white transition">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )
                }

                if (isDeleting) {
                  return (
                    <div key={b.id} className="px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 mx-1">
                      <p className="text-xs text-rose-300 mb-2">Delete <span className="font-bold">{b.name}</span>?</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleDelete(b.id)} className="flex-1 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-semibold hover:bg-rose-500/30 transition">Delete</button>
                        <button onClick={() => setDeletingId(null)} className="flex-1 py-1.5 rounded-lg bg-white/5 text-slate-400 text-xs hover:text-white transition">Cancel</button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={b.id} className={`flex items-center gap-2 px-2 rounded-xl group transition ${compact ? 'py-1.5' : 'py-3 px-3 gap-3'} ${isActive ? 'bg-emerald-500/10' : 'hover:bg-white/5'}`}>
                    <button onClick={() => { setActiveBusinessId(b.id); setOpen(false) }} className="flex-1 flex items-center gap-2 text-left">
                      <div className={`rounded-lg flex items-center justify-center font-bold flex-shrink-0 ${compact ? 'w-6 h-6 text-xs rounded-md' : 'w-9 h-9 text-sm rounded-xl font-black'} ${
                        isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-400'
                      }`}>
                        {b.name[0].toUpperCase()}
                      </div>
                      <span className={`text-sm truncate ${isActive ? 'text-emerald-300 font-medium' : 'text-slate-300'}`}>
                        {b.name}
                      </span>
                      {isActive && <Check className={`text-emerald-400 flex-shrink-0 ml-auto ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />}
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); setEditName(b.name); setEditingId(b.id); setDeletingId(null) }} className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-300 hover:bg-emerald-500/10 transition">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {businesses.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); setDeletingId(b.id); setEditingId(null) }} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Add Business */}
            <div className="p-2 border-t border-white/10">
              {adding ? (
                <form onSubmit={handleCreate} className="space-y-2 p-1">
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Business name"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50 transition"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/30 transition">Create</button>
                    <button type="button" onClick={() => setAdding(false)} className="flex-1 py-2 rounded-xl bg-white/5 text-slate-400 text-sm hover:text-white transition">Cancel</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => { setAdding(true); setEditingId(null); setDeletingId(null) }} className={`w-full flex items-center gap-2 px-3 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition ${compact ? 'py-2' : 'py-3 gap-3'}`}>
                  <Plus className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
                  <span className={compact ? '' : 'font-semibold'}>Add Business</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
