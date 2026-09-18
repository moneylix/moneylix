'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, MessageSquare, Mail, HelpCircle, BookOpen, Zap, CreditCard, Shield, Send, Check } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

function getFaqs(t: (key: string) => string) {
  return [
    {
      category: t('help.gettingStarted'),
      icon: Zap,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100',
      items: [
        { q: t('help.gs1q'), a: t('help.gs1a') },
        { q: t('help.gs2q'), a: t('help.gs2a') },
        { q: t('help.gs3q'), a: t('help.gs3a') },
      ]
    },
    {
      category: t('help.paymentsAndPlans'),
      icon: CreditCard,
      color: 'text-cyan-600',
      bg: 'bg-cyan-100',
      items: [
        { q: t('help.pp1q'), a: t('help.pp1a') },
        { q: t('help.pp2q'), a: t('help.pp2a') },
        { q: t('help.pp3q'), a: t('help.pp3a') },
        { q: t('help.pp4q'), a: t('help.pp4a') },
      ]
    },
    {
      category: t('help.dataAndSecurity'),
      icon: Shield,
      color: 'text-violet-600',
      bg: 'bg-violet-100',
      items: [
        { q: t('help.ds1q'), a: t('help.ds1a') },
        { q: t('help.ds2q'), a: t('help.ds2a') },
        { q: t('help.ds3q'), a: t('help.ds3a') },
        { q: t('help.ds4q'), a: t('help.ds4a') },
      ]
    },
    {
      category: t('help.features'),
      icon: BookOpen,
      color: 'text-amber-600',
      bg: 'bg-amber-100',
      items: [
        { q: t('help.ft1q'), a: t('help.ft1a') },
        { q: t('help.ft2q'), a: t('help.ft2a') },
        { q: t('help.ft3q'), a: t('help.ft3a') },
        { q: t('help.ft4q'), a: t('help.ft4a') },
      ]
    },
  ]
}

export default function HelpPage() {
  const { t } = useTranslation()
  const faqs = getFaqs(t)
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})
  const [ticket, setTicket] = useState({ subject: '', message: '', email: '' })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const toggle = (key: string) => setOpenItems(p => ({ ...p, [key]: !p[key] }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const token = localStorage.getItem('moneylix_session_token')
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(ticket),
      })
      if (!res.ok) throw new Error(t('payroll.failed'))
      setSubmitted(true)
    } catch {
      alert(t('help.failedToSend'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-neutral-900">{t('help.title')}</h1>
        <p className="text-sm text-neutral-400 mt-1">{t('help.subtitle')}</p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Zap, label: t('help.quickStart'), color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          { icon: CreditCard, label: t('help.billing'), color: 'text-cyan-600', bg: 'bg-cyan-50 border-cyan-200' },
          { icon: Shield, label: t('help.security'), color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
          { icon: MessageSquare, label: t('help.contactUs'), color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
        ].map(({ icon: Icon, label, color, bg }) => (
          <div key={label} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border ${bg} cursor-pointer hover:opacity-80 transition`}>
            <Icon className={`w-5 h-5 ${color}`} />
            <span className="text-xs font-bold text-neutral-900">{label}</span>
          </div>
        ))}
      </div>

      {/* FAQ sections */}
      {faqs.map(({ category, icon: Icon, color, bg, items }) => (
        <div key={category} className="rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-black/5">
            <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <h2 className="text-sm font-black text-neutral-900">{category}</h2>
          </div>
          <div className="divide-y divide-black/5">
            {items.map((item, i) => {
              const key = `${category}-${i}`
              const isOpen = openItems[key]
              return (
                <div key={key}>
                  <button
                    onClick={() => toggle(key)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-neutral-50 transition"
                  >
                    <span className="text-sm font-semibold text-neutral-900 pr-4">{item.q}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-neutral-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4">
                      <p className="text-sm text-neutral-600 leading-relaxed">{item.a}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Support ticket */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-black/5">
          <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <h2 className="text-sm font-black text-neutral-900">{t('help.contactSupport')}</h2>
            <p className="text-[10px] text-neutral-400">{t('help.replyWithin24h')}</p>
          </div>
        </div>

        {submitted ? (
          <div className="px-5 py-8 text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-neutral-900 font-black">{t('help.messageSent')}</p>
            <p className="text-neutral-400 text-sm mt-1">{t('help.getBackWithin24h')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1.5">{t('help.yourEmail')}</label>
              <input
                type="email" required
                value={ticket.email}
                onChange={e => setTicket(p => ({ ...p, email: e.target.value }))}
                placeholder="you@domain.com"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1.5">{t('help.subject')}</label>
              <input
                type="text" required
                value={ticket.subject}
                onChange={e => setTicket(p => ({ ...p, subject: e.target.value }))}
                placeholder={t('help.whatHelpPlaceholder')}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1.5">{t('help.message')}</label>
              <textarea
                required rows={4}
                value={ticket.message}
                onChange={e => setTicket(p => ({ ...p, message: e.target.value }))}
                placeholder={t('help.describeIssuePlaceholder')}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-emerald-400 resize-none"
              />
            </div>
            <button
              type="submit" disabled={submitting}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-3 rounded-xl transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submitting ? t('help.sending') : t('help.sendMessage')}
            </button>
          </form>
        )}
      </div>

      {/* Contact info */}
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-white shadow-sm">
        <Mail className="w-5 h-5 text-neutral-400 flex-shrink-0" />
        <div>
          <p className="text-xs font-bold text-neutral-900">{t('help.emailSupport')}</p>
          <p className="text-[10px] text-neutral-400">{t('help.supportHours')}</p>
        </div>
      </div>
    </div>
  )
}
