'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, Clock, CheckCircle, AlertCircle, Send, ChevronDown } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

type Ticket = {
  id: number; email: string; subject: string; message: string
  status: string; username: string | null; reply: string | null
  replied_at: string | null; created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  closed: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('open')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [reply, setReply] = useState('')
  const [replyStatus, setReplyStatus] = useState('resolved')
  const [sending, setSending] = useState(false)

  const getAuth = () => {
    try { return JSON.parse(localStorage.getItem('moneylix_admin_auth') ?? '{}') } catch { return {} }
  }

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const auth = getAuth()
      const res = await fetch(`/api/admin/tickets?status=${statusFilter}`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      })
      const data = await res.json()
      setTickets(data.tickets ?? [])
    } catch { /* silent */ } finally { setLoading(false) }
  }

  useEffect(() => { fetchTickets() }, [statusFilter])

  const handleReply = async (ticketId: number) => {
    setSending(true)
    try {
      const auth = getAuth()
      await fetch('/api/admin/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ id: ticketId, status: replyStatus, reply })
      })
      setReply('')
      setExpanded(null)
      fetchTickets()
    } catch { /* silent */ } finally { setSending(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-cyan-400" /> Support Tickets
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage user support requests</p>
        </div>

        {/* Status filter */}
        <div className="flex gap-2">
          {['open', 'in_progress', 'resolved', 'closed'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition border ${
                statusFilter === s ? STATUS_COLORS[s] : 'border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Open', icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500/10', status: 'open' },
          { label: 'In Progress', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', status: 'in_progress' },
          { label: 'Resolved', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', status: 'resolved' },
          { label: 'Closed', icon: MessageSquare, color: 'text-slate-400', bg: 'bg-slate-500/10', status: 'closed' },
        ].map(({ label, icon: Icon, color, bg, status }) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`flex items-center gap-3 p-4 rounded-2xl border border-white/5 ${bg} transition hover:opacity-80`}
          >
            <Icon className={`w-5 h-5 ${color}`} />
            <p className="text-xs font-bold text-white">{label}</p>
          </button>
        ))}
      </div>

      {/* Tickets list */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">No {statusFilter.replace('_', ' ')} tickets</div>
        ) : tickets.map(ticket => (
          <div key={ticket.id} className="rounded-2xl border border-white/5 bg-slate-900 overflow-hidden">
            {/* Header */}
            <button
              onClick={() => setExpanded(expanded === ticket.id ? null : ticket.id)}
              className="w-full flex items-start justify-between p-5 text-left hover:bg-white/5 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[ticket.status]}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    #{ticket.id} · {new Date(ticket.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm font-black text-white">{ticket.subject}</p>
                <p className="text-xs text-slate-400 mt-0.5">{ticket.email} {ticket.username && `· @${ticket.username}`}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-500 mt-1 ml-4 flex-shrink-0 transition-transform ${expanded === ticket.id ? 'rotate-180' : ''}`} />
            </button>

            {/* Expanded */}
            {expanded === ticket.id && (
              <div className="px-5 pb-5 space-y-4 border-t border-white/5">
                {/* Message */}
                <div className="mt-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Message</p>
                  <p className="text-sm text-slate-300 bg-slate-800/50 rounded-xl p-4 leading-relaxed">{ticket.message}</p>
                </div>

                {/* Existing reply */}
                {ticket.reply && (
                  <div>
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Your Reply · {ticket.replied_at ? new Date(ticket.replied_at).toLocaleDateString() : ''}</p>
                    <p className="text-sm text-slate-300 bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4">{ticket.reply}</p>
                  </div>
                )}

                {/* Reply form */}
                {ticket.status !== 'closed' && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Reply</p>
                    <textarea
                      rows={3}
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder="Type your reply..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
                    />
                    <div className="flex items-center gap-3">
                      <select
                        value={replyStatus}
                        onChange={e => setReplyStatus(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        <option value="in_progress">Mark In Progress</option>
                        <option value="resolved">Mark Resolved</option>
                        <option value="closed">Mark Closed</option>
                      </select>
                      <Button
                        onClick={() => handleReply(ticket.id)}
                        disabled={sending || !reply.trim()}
                        className="gap-2 text-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {sending ? 'Sending...' : 'Send Reply'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
