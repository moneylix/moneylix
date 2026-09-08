'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, MessageSquare, Mail, HelpCircle, BookOpen, Zap, CreditCard, Shield, Send, Check } from 'lucide-react'

const faqs = [
  {
    category: 'Getting Started',
    icon: Zap,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    items: [
      { q: 'How do I add a transaction?', a: 'Click the + button in the top right, or press the "A" key anywhere in the dashboard. Fill in type (credit/debit), amount, category, and date.' },
      { q: 'What is a Business?', a: 'A Business is a separate ledger for tracking finances. Free plan allows 1, Pro allows 3, Premium allows unlimited. Switch between businesses using the switcher in the sidebar.' },
      { q: 'How do I switch between businesses?', a: 'Use the business switcher at the top of the sidebar. Click it to see all your businesses or create a new one.' },
    ]
  },
  {
    category: 'Payments & Plans',
    icon: CreditCard,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    items: [
      { q: 'How do I upgrade my plan?', a: 'Go to Plans & Pricing in the sidebar. Click Upgrade to Pro or Premium, complete the Razorpay checkout. Your plan activates instantly after payment.' },
      { q: 'When does my plan expire?', a: 'Plans are billed monthly from the date of purchase. You will see an expiry warning banner on the dashboard when your plan is within 7 days of expiry.' },
      { q: 'Can I get a refund?', a: 'Contact support within 7 days of purchase for a full refund. Refunds are processed within 5-7 business days to your original payment method.' },
      { q: 'What payment methods are accepted?', a: 'We accept all major credit/debit cards, UPI, net banking, and wallets through Razorpay.' },
    ]
  },
  {
    category: 'Data & Security',
    icon: Shield,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    items: [
      { q: 'How do I export my data?', a: 'Go to Settings → Export Data. Choose CSV or JSON format. Pro and Premium plans support CSV export; Premium supports both CSV and JSON.' },
      { q: 'How do I import transactions?', a: 'Go to Settings → Import CSV. Upload a CSV file with columns: Date, Type, Amount, Category, Note, Method, Tags.' },
      { q: 'Is my data secure?', a: 'Yes. All data is stored on our private server with encrypted connections (HTTPS). We never share your financial data with third parties.' },
      { q: 'Can I delete my account?', a: 'Contact support at the email below to request account deletion. All your data will be permanently removed within 30 days.' },
    ]
  },
  {
    category: 'Features',
    icon: BookOpen,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    items: [
      { q: 'What is the AI Advisor?', a: 'The AI Advisor (Premium only) analyzes your spending patterns and gives personalized financial recommendations using Claude AI.' },
      { q: 'What is the OCR Scanner?', a: 'Scan paper receipts or bills with your camera (Premium only). The AI reads the amount, date, and category automatically.' },
      { q: 'What are Receivables?', a: 'Receivables track money others owe you (Pro/Premium). Mark transactions as pending and get reminders when due dates approach.' },
      { q: 'How do keyboard shortcuts work?', a: 'Press "A" to open the Add Transaction modal. Press "/" to focus the search bar. Press "Esc" to close any modal.' },
    ]
  },
]

export default function HelpPage() {
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
      if (!res.ok) throw new Error('Failed')
      setSubmitted(true)
    } catch {
      alert('Failed to send. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white">Help Center</h1>
        <p className="text-sm text-slate-400 mt-1">Find answers or contact our support team</p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Zap, label: 'Quick Start', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { icon: CreditCard, label: 'Billing', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
          { icon: Shield, label: 'Security', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
          { icon: MessageSquare, label: 'Contact Us', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
        ].map(({ icon: Icon, label, color, bg }) => (
          <div key={label} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border ${bg} cursor-pointer hover:opacity-80 transition`}>
            <Icon className={`w-5 h-5 ${color}`} />
            <span className="text-xs font-bold text-white">{label}</span>
          </div>
        ))}
      </div>

      {/* FAQ sections */}
      {faqs.map(({ category, icon: Icon, color, bg, items }) => (
        <div key={category} className="rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
            <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <h2 className="text-sm font-black text-white">{category}</h2>
          </div>
          <div className="divide-y divide-white/5">
            {items.map((item, i) => {
              const key = `${category}-${i}`
              const isOpen = openItems[key]
              return (
                <div key={key}>
                  <button
                    onClick={() => toggle(key)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition"
                  >
                    <span className="text-sm font-semibold text-white pr-4">{item.q}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4">
                      <p className="text-sm text-slate-400 leading-relaxed">{item.a}</p>
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
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white">Contact Support</h2>
            <p className="text-[10px] text-slate-500">We reply within 24 hours</p>
          </div>
        </div>

        {submitted ? (
          <div className="px-5 py-8 text-center">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-white font-black">Message Sent!</p>
            <p className="text-slate-400 text-sm mt-1">We&apos;ll get back to you within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Your Email</label>
              <input
                type="email" required
                value={ticket.email}
                onChange={e => setTicket(p => ({ ...p, email: e.target.value }))}
                placeholder="you@domain.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Subject</label>
              <input
                type="text" required
                value={ticket.subject}
                onChange={e => setTicket(p => ({ ...p, subject: e.target.value }))}
                placeholder="What do you need help with?"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Message</label>
              <textarea
                required rows={4}
                value={ticket.message}
                onChange={e => setTicket(p => ({ ...p, message: e.target.value }))}
                placeholder="Describe your issue in detail..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>
            <button
              type="submit" disabled={submitting}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-3 rounded-xl transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        )}
      </div>

      {/* Contact info */}
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-white shadow-sm">
        <Mail className="w-5 h-5 text-slate-400 flex-shrink-0" />
        <div>
          <p className="text-xs font-bold text-white">Email Support</p>
          <p className="text-[10px] text-slate-500">support@moneylix.app — Mon to Sat, 9am to 6pm IST</p>
        </div>
      </div>
    </div>
  )
}
