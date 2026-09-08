'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, X, Clock, Play, Square, Timer, DollarSign,
  Calendar, Briefcase, Trash2, Edit2, Search,
} from 'lucide-react'
import { useBusiness } from '@/lib/contexts/BusinessContext'
import { useCurrency } from '@/lib/contexts/CurrencyContext'

interface TimeEntry {
  id: number
  client_name: string | null
  project_name: string | null
  description: string | null
  start_time: string
  end_time: string | null
  duration_minutes: number | null
  hourly_rate: number | null
  total_amount: number | null
  is_billable: number
  status: string
}

interface TimeSummary {
  total_hours: number
  billable_hours: number
  total_billable_amount: number
  today_hours: number
  week_hours: number
  by_project: { project_name: string; total_hours: number; total_amount: number; entry_count: number }[]
}

interface TimeProject {
  id: number
  name: string
  client_name: string | null
  hourly_rate: number | null
  color: string
  status: string
}

function formatDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function formatRunningTime(startTime: string): string {
  const diff = Date.now() - new Date(startTime).getTime()
  const minutes = Math.floor(diff / 60000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const s = Math.floor((diff % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function TimePage() {
  const { activeBusiness } = useBusiness()
  const { currentCurrency, currencies } = useCurrency()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [runningTimer, setRunningTimer] = useState<TimeEntry | null>(null)
  const [summary, setSummary] = useState<TimeSummary | null>(null)
  const [projects, setProjects] = useState<TimeProject[]>([])
  const [loading, setLoading] = useState(true)
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [runningDisplay, setRunningDisplay] = useState('00:00:00')
  const [isMounted, setIsMounted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [entryForm, setEntryForm] = useState({
    project_name: '', client_name: '', description: '', hourly_rate: '',
    start_time: '', end_time: '', is_billable: true,
  })
  const [projectForm, setProjectForm] = useState({
    name: '', client_name: '', hourly_rate: '', color: '#10B981',
  })

  useEffect(() => { setIsMounted(true) }, [])

  const fmt = useCallback((n: number) => {
    const sym = currencies.find(c => c.code === currentCurrency)?.symbol ?? ''
    return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }, [currencies, currentCurrency])

  const fetchData = useCallback(async () => {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const bId = activeBusiness.id

      const [entriesRes, summaryRes, projectsRes] = await Promise.all([
        fetch(`/api/time/entries?businessId=${bId}&limit=30`, { headers }),
        fetch(`/api/time/summary?businessId=${bId}`, { headers }),
        fetch(`/api/time/projects?businessId=${bId}`, { headers }),
      ])

      const entriesData = await entriesRes.json()
      const summaryData = await summaryRes.json()
      const projectsData = await projectsRes.json()

      setEntries(entriesData.entries || [])
      setRunningTimer(entriesData.running_timer || null)
      setSummary(summaryData)
      setProjects(projectsData.projects || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [activeBusiness])

  useEffect(() => { fetchData() }, [fetchData])

  // Running timer display
  useEffect(() => {
    if (runningTimer) {
      const update = () => setRunningDisplay(formatRunningTime(runningTimer.start_time))
      update()
      timerRef.current = setInterval(update, 1000)
    } else {
      setRunningDisplay('00:00:00')
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [runningTimer])

  const handleStartTimer = async () => {
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      await fetch('/api/time/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          business_id: activeBusiness?.id,
          start_timer: true,
          project_name: entryForm.project_name || null,
          client_name: entryForm.client_name || null,
          description: entryForm.description || null,
          hourly_rate: parseFloat(entryForm.hourly_rate) || null,
          is_billable: entryForm.is_billable,
        }),
      })
      fetchData()
    } catch (e) { console.error(e) }
  }

  const handleStopTimer = async () => {
    if (!runningTimer) return
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      await fetch('/api/time/entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id: runningTimer.id, stop_timer: true }),
      })
      fetchData()
    } catch (e) { console.error(e) }
  }

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      await fetch('/api/time/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          business_id: activeBusiness?.id,
          project_name: entryForm.project_name || null,
          client_name: entryForm.client_name || null,
          description: entryForm.description || null,
          hourly_rate: parseFloat(entryForm.hourly_rate) || null,
          start_time: entryForm.start_time,
          end_time: entryForm.end_time || null,
          is_billable: entryForm.is_billable,
        }),
      })
      setShowEntryModal(false)
      setEntryForm({ project_name: '', client_name: '', description: '', hourly_rate: '', start_time: '', end_time: '', is_billable: true })
      fetchData()
    } catch (e) { console.error(e) }
    finally { setSubmitting(false) }
  }

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      await fetch('/api/time/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          business_id: activeBusiness?.id,
          name: projectForm.name,
          client_name: projectForm.client_name || null,
          hourly_rate: parseFloat(projectForm.hourly_rate) || null,
          color: projectForm.color,
        }),
      })
      setShowProjectModal(false)
      setProjectForm({ name: '', client_name: '', hourly_rate: '', color: '#10B981' })
      fetchData()
    } catch (e) { console.error(e) }
    finally { setSubmitting(false) }
  }

  const handleDeleteEntry = async (id: number) => {
    if (!confirm('Delete this time entry?')) return
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    await fetch(`/api/time/entries?id=${id}`, {
      method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    fetchData()
  }

  // Group entries by date
  const groupedEntries: Record<string, TimeEntry[]> = {}
  entries.filter(e => e.status !== 'running').forEach(entry => {
    const date = entry.start_time.split('T')[0]
    if (!groupedEntries[date]) groupedEntries[date] = []
    groupedEntries[date].push(entry)
  })
  const sortedDates = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-bold text-neutral-900">Time Tracking</h1>
          <p className="text-[10px] text-neutral-400">Track hours for freelance and service billing</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowProjectModal(true)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition font-bold">
            <Briefcase className="w-3 h-3" /> Projects
          </button>
          <button onClick={() => setShowEntryModal(true)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-lime-400 text-neutral-900 hover:bg-lime-300 transition font-bold">
            <Plus className="w-3 h-3" /> Manual Entry
          </button>
        </div>
      </div>

      {/* Timer Widget */}
      <div className="rounded-2xl bg-white shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${runningTimer ? 'bg-rose-100 animate-pulse' : 'bg-neutral-100'}`}>
              <Timer className={`w-6 h-6 ${runningTimer ? 'text-rose-600' : 'text-neutral-400'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-neutral-900">{runningDisplay}</p>
              {runningTimer && (
                <p className="text-[10px] text-neutral-400">
                  {runningTimer.project_name || 'No project'} {runningTimer.client_name ? `· ${runningTimer.client_name}` : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!runningTimer ? (
              <>
                <select value={entryForm.project_name} onChange={e => setEntryForm(f => ({ ...f, project_name: e.target.value }))} className="px-2 py-1.5 rounded-lg border border-neutral-200 text-xs min-w-[120px]">
                  <option value="">No project</option>
                  {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
                <input value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))} placeholder="What are you working on?" className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs min-w-[200px]" />
                <button onClick={handleStartTimer} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-lime-400 text-neutral-900 text-xs font-bold hover:bg-lime-300 transition">
                  <Play className="w-3.5 h-3.5" /> Start
                </button>
              </>
            ) : (
              <button onClick={handleStopTimer} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition">
                <Square className="w-3.5 h-3.5" /> Stop
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-50 text-blue-700">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-neutral-400">Today</p>
              <p className="text-sm font-bold">{summary.today_hours}h</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-purple-50 text-purple-700">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-neutral-400">This Week</p>
              <p className="text-sm font-bold">{summary.week_hours}h</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-lime-50 text-lime-700">
            <Timer className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-neutral-400">Billable Hours</p>
              <p className="text-sm font-bold">{summary.billable_hours}h</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 text-amber-700">
            <DollarSign className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-neutral-400">Billable Amount</p>
              <p className="text-sm font-bold font-mono">{fmt(summary.total_billable_amount)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Time Entries grouped by date */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-sm p-8 text-center">
          <Clock className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
          <p className="text-xs text-neutral-400">
            {runningTimer ? 'No completed entries yet — stop the timer above to log it.' : 'No time entries yet. Start a timer or add a manual entry.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map(date => {
            const dayEntries = groupedEntries[date]
            const dayTotal = dayEntries.reduce((s, e) => s + (e.duration_minutes || 0), 0)
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-neutral-900">{new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                  <p className="text-[10px] font-bold text-neutral-400">{formatDuration(dayTotal)}</p>
                </div>
                <div className="rounded-2xl bg-white shadow-sm overflow-hidden divide-y divide-neutral-50">
                  {dayEntries.map(entry => (
                    <div key={entry.id} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-1 h-8 rounded-full ${entry.is_billable ? 'bg-lime-400' : 'bg-neutral-200'}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-neutral-900 truncate">{entry.description || entry.project_name || 'Untitled'}</p>
                          <p className="text-[10px] text-neutral-400 truncate">
                            {entry.project_name && <span className="text-purple-500">{entry.project_name}</span>}
                            {entry.client_name && <span> · {entry.client_name}</span>}
                            {entry.is_billable ? <span className="text-lime-600"> · Billable</span> : <span> · Non-billable</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-bold font-mono text-neutral-900">{formatDuration(entry.duration_minutes)}</p>
                          {entry.total_amount ? <p className="text-[10px] text-neutral-400 font-mono">{fmt(entry.total_amount)}</p> : null}
                        </div>
                        <button onClick={() => handleDeleteEntry(entry.id)} className="p-1 text-neutral-300 hover:text-rose-500 transition">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Manual Entry Modal */}
      {showEntryModal && isMounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEntryModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-neutral-900">Add Time Entry</h2>
              <button onClick={() => setShowEntryModal(false)} className="p-1 text-neutral-400 hover:text-neutral-900"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleManualEntry} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">Project</label>
                  <select value={entryForm.project_name} onChange={e => setEntryForm(f => ({ ...f, project_name: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none">
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">Client</label>
                  <input value={entryForm.client_name} onChange={e => setEntryForm(f => ({ ...f, client_name: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-neutral-500">Description</label>
                <input value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">Start Time *</label>
                  <input type="datetime-local" value={entryForm.start_time} onChange={e => setEntryForm(f => ({ ...f, start_time: e.target.value }))} required className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">End Time</label>
                  <input type="datetime-local" value={entryForm.end_time} onChange={e => setEntryForm(f => ({ ...f, end_time: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-neutral-500">Hourly Rate</label>
                <input type="number" step="0.01" value={entryForm.hourly_rate} onChange={e => setEntryForm(f => ({ ...f, hourly_rate: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" placeholder="500" />
              </div>
              <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer">
                <input type="checkbox" checked={entryForm.is_billable} onChange={e => setEntryForm(f => ({ ...f, is_billable: e.target.checked }))} className="rounded border-neutral-300 text-lime-500 focus:ring-lime-400" />
                Billable
              </label>
              <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-xl bg-lime-400 text-neutral-900 text-xs font-bold hover:bg-lime-300 transition disabled:opacity-50">
                {submitting ? 'Saving...' : 'Add Entry'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Add Project Modal */}
      {showProjectModal && isMounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowProjectModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-neutral-900">Add Project</h2>
              <button onClick={() => setShowProjectModal(false)} className="p-1 text-neutral-400 hover:text-neutral-900"><X className="w-4 h-4" /></button>
            </div>

            {/* Existing projects list */}
            {projects.length > 0 && (
              <div className="mb-4 space-y-1">
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Existing Projects</p>
                {projects.map(p => (
                  <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-neutral-50 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="font-medium text-neutral-900">{p.name}</span>
                    {p.client_name && <span className="text-neutral-400">· {p.client_name}</span>}
                    {p.hourly_rate && <span className="text-neutral-400 ml-auto font-mono">{fmt(p.hourly_rate)}/hr</span>}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddProject} className="space-y-3">
              <div>
                <label className="text-[10px] font-medium text-neutral-500">Project Name *</label>
                <input value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} required className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-neutral-500">Client</label>
                <input value={projectForm.client_name} onChange={e => setProjectForm(f => ({ ...f, client_name: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">Hourly Rate</label>
                  <input type="number" step="0.01" value={projectForm.hourly_rate} onChange={e => setProjectForm(f => ({ ...f, hourly_rate: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">Color</label>
                  <input type="color" value={projectForm.color} onChange={e => setProjectForm(f => ({ ...f, color: e.target.value }))} className="w-full mt-1 h-9 rounded-xl border border-neutral-200 cursor-pointer" />
                </div>
              </div>
              <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-xl bg-lime-400 text-neutral-900 text-xs font-bold hover:bg-lime-300 transition disabled:opacity-50">
                {submitting ? 'Creating...' : 'Add Project'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
