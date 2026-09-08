"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Wallet, Receipt, BarChart3, Sparkles, TrendingUp, Brain, Shield, Lock,
  CheckCircle, Globe, ArrowRight, Check, Menu, X, ChevronRight,
  Users, Building2, PieChart, Banknote, Bell, FileText, Zap, Crown, Star,
  Landmark, Package, Clock, GitCompareArrows, Moon, Sun,
} from "lucide-react"

// ── Theme palettes (explicit hex so global CSS overrides can't touch them) ──
const GRAD = "linear-gradient(135deg,#10b981,#22d3ee)"

const THEMES = {
  dark: {
    BG: "#0a0e1a", BG2: "#0f1524", CARD: "#131a2c",
    BORDER: "rgba(255,255,255,0.08)", BORDER2: "rgba(255,255,255,0.14)",
    TXT: "#f8fafc", MUT: "#94a3b8", MUT2: "#64748b",
    CARDSHADOW: "0 30px 80px rgba(0,0,0,0.5)",
  },
  light: {
    BG: "#f8fafc", BG2: "#eef2f7", CARD: "#ffffff",
    BORDER: "rgba(15,23,42,0.10)", BORDER2: "rgba(15,23,42,0.16)",
    TXT: "#0f172a", MUT: "#475569", MUT2: "#94a3b8",
    CARDSHADOW: "0 20px 50px rgba(15,23,42,0.10)",
  },
} as const

const colorMap: Record<string, string> = {
  emerald: "#10b981", cyan: "#22d3ee", amber: "#f59e0b", violet: "#a78bfa", rose: "#fb7185",
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [yearly, setYearly] = useState(false)
  const [faq, setFaq] = useState<number | null>(0)
  const [theme, setTheme] = useState<"dark" | "light">("dark")

  // Load saved theme preference
  useEffect(() => {
    const saved = localStorage.getItem("moneylix_landing_theme")
    if (saved === "light" || saved === "dark") setTheme(saved)
  }, [])
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    localStorage.setItem("moneylix_landing_theme", next)
  }
  // Active palette — same names the rest of the JSX already uses
  const { BG, BG2, CARD, BORDER, BORDER2, TXT, MUT, MUT2 } = THEMES[theme]

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const capabilities = [
    { icon: Brain, title: "AI in Accounting", desc: "Ask questions in plain English, auto-categorize transactions, and get investment advice — powered by Gemini AI.", c: "violet" },
    { icon: Receipt, title: "GST Compliance", desc: "Generate GST invoices with CGST/SGST/IGST, calculate liabilities automatically, and export tax-ready reports.", c: "emerald" },
    { icon: Wallet, title: "UPI Bank Sync", desc: "Connect via RBI-regulated Setu Account Aggregator. Fetch UPI & bank feeds and reconcile effortlessly.", c: "cyan" },
    { icon: Building2, title: "Multi-Business", desc: "Switch between ventures with isolated data. Free (1), Pro (3), Premium (unlimited) — plus cross-business view.", c: "amber" },
    { icon: Sparkles, title: "AI Advisor", desc: "Personalized SIP, Gold, and FD recommendations based on your income and savings pattern.", c: "violet" },
    { icon: Bell, title: "Smart Alerts", desc: "Automatic reminders for low balance, upcoming dues, unusual spend, and budget overspend.", c: "rose" },
  ]

  const modules = [
    { tag: "Receivables & Invoicing", title: "Get paid faster with GST invoices", desc: "Raise tax-compliant invoices, share Razorpay payment links, and watch payments auto-confirm and reconcile. No manual follow-ups.", bullets: ["GST-ready invoices (CGST/SGST/IGST)", "Razorpay payment links + auto-confirm", "Client portal share links", "Automated payment reminders"], c: "emerald" },
    { tag: "Banking & Reconciliation", title: "Every transaction, sorted for you", desc: "RBI-regulated Account Aggregator pulls in UPI & bank transactions automatically. AI categorizes each one and matches them to your records.", bullets: ["Setu Account Aggregator (RBI)", "AI auto-categorization", "Weighted reconciliation engine", "Bank feed matching & discrepancy flags"], c: "cyan" },
    { tag: "Reports & Forecasting", title: "Know where your money is going", desc: "Cash flow charts, spending splits, savings rate, and 30/60/90-day forecasts across all your businesses — updated in real time.", bullets: ["Cash flow & P&L insights", "30/60/90-day forecasting", "Per-business budgeting & goals", "CA / Tally-ready exports"], c: "amber" },
  ]

  const allFeatures = [
    { icon: Building2, label: "Multi-Business" }, { icon: Wallet, label: "Bank Sync" },
    { icon: Brain, label: "AI Categorization" }, { icon: Receipt, label: "GST Invoicing" },
    { icon: FileText, label: "Payment Links" }, { icon: GitCompareArrows, label: "Reconciliation" },
    { icon: PieChart, label: "Budgeting" }, { icon: TrendingUp, label: "Forecasting" },
    { icon: Banknote, label: "Loan / EMI" }, { icon: Users, label: "Payroll" },
    { icon: Package, label: "Inventory" }, { icon: Clock, label: "Time Tracking" },
    { icon: Sparkles, label: "AI Advisor" }, { icon: Bell, label: "Smart Alerts" },
    { icon: Globe, label: "Multi-Language" }, { icon: BarChart3, label: "Analytics" },
  ]

  const testimonials = [
    { quote: "I stopped chasing payments in spreadsheets. UPI transactions sort themselves and I invoice clients in seconds.", name: "Freelancers & Consultants", role: "Designers, developers, writers", icon: Sparkles, c: "emerald" },
    { quote: "Two businesses, one app. I switch between my cafe and my side venture without ever mixing up the books.", name: "Multi-Business Owners", role: "Cafe, retail & side ventures", icon: Building2, c: "cyan" },
    { quote: "Payroll, inventory, GST invoicing and team roles — everything my small team needs, in one place.", name: "Small Teams & Agencies", role: "Studios, shops & agencies", icon: Users, c: "violet" },
  ]

  const plans = [
    { name: "Free", pm: "₹0", py: "₹0", per: "forever", icon: Zap, c: "#94a3b8",
      feats: ["1 Business", "Dashboard & Transactions", "Budgets & Goals", "Notifications", "Calculator"],
      locked: ["Bank Sync", "Invoicing", "AI Advisor"], cta: "Get Started Free", pop: false },
    { name: "Pro", pm: "₹199", py: "₹149", per: "/mo", icon: Crown, c: "#22d3ee", badge: "POPULAR",
      feats: ["3 Businesses", "Bank Sync (Setu AA)", "GST Invoicing + Links", "Reconciliation", "Cash Flow Forecast", "Loan / EMI", "Time Tracking", "Export CSV"],
      locked: ["AI Advisor", "Payroll & Inventory"], cta: "Get Pro", pop: true,
      noteM: "or ₹1,788/yr — save ₹600", noteY: "₹1,788 billed yearly — save ₹600" },
    { name: "Premium", pm: "₹499", py: "₹299", per: "/mo", icon: Sparkles, c: "#f59e0b", badge: "BEST VALUE",
      feats: ["Unlimited Businesses", "All Pro Features", "AI Investment Advisor", "Payroll & Staff", "Inventory", "Team Roles", "OCR Receipts", "Export CSV & JSON"],
      locked: [], cta: "Get Premium", pop: false,
      noteM: "or ₹3,588/yr — save ₹2,400", noteY: "₹3,588 billed yearly — save ₹2,400" },
  ]

  const segments = [
    { icon: Sparkles, title: "Freelancers", desc: "Invoice clients, track income across gigs, and get AI advice on where to invest your savings.", c: "emerald" },
    { icon: Building2, title: "Multi-Business Owners", desc: "Run a cafe and a side hustle? Keep books separate with a cross-business overview.", c: "cyan" },
    { icon: Users, title: "Small Teams & Agencies", desc: "Payroll, team roles, inventory, and GST invoicing for growing studios and shops.", c: "violet" },
    { icon: Landmark, title: "Accountants & CAs", desc: "Tally-compatible exports and tax-ready reports make client books effortless.", c: "amber" },
  ]

  const faqs = [
    { q: "Is my bank data safe with Moneylix?", a: "Yes. Bank data flows through Setu, an RBI-licensed Account Aggregator. You grant consent per account and can revoke it anytime. We never store bank login credentials, and all data is SSL-encrypted." },
    { q: "Do I have to enter transactions manually?", a: "No. Once you connect your bank via Account Aggregator, UPI and bank transactions flow in automatically. Gemini AI categorizes each one — you just review and confirm." },
    { q: "Can I manage multiple businesses in one account?", a: "Yes. Switch between businesses with isolated data on Free (1), Pro (3), or Premium (unlimited). Each keeps its own transactions, invoices, and reports, plus a cross-business overview." },
    { q: "Does Moneylix handle GST?", a: "Yes. Create GST-compliant invoices with automatic CGST/SGST/IGST based on place of supply, and export tax-ready reports including Tally-compatible format for your CA." },
    { q: "Is there a free plan?", a: "Yes — Free forever. It includes 1 business, transactions, budgets, notifications, and the calculator. Upgrade anytime for bank sync, invoicing, and AI features." },
    { q: "Is there a mobile app?", a: "Yes. Moneylix works on web, iOS, and Android with real-time sync across devices, and installs as a PWA too." },
    { q: "Can I cancel anytime?", a: "Yes. No lock-in. Cancel or downgrade whenever — your data stays exportable in CSV, JSON, and Tally format." },
  ]

  return (
    <div style={{ background: BG, color: TXT, minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* ── ANNOUNCEMENT BAR ── */}
      <div style={{ background: GRAD, color: "#04121e" }} className="text-center text-[12px] font-bold py-2 px-4">
        🇮🇳 India-first finance platform · UPI-native bank sync + AI advisor · Start free — no card needed
      </div>

      {/* ── NAVBAR ── */}
      <nav style={{ background: scrolled ? (theme === "dark" ? "rgba(10,14,26,0.9)" : "rgba(248,250,252,0.9)") : "transparent", borderBottom: `1px solid ${scrolled ? BORDER : "transparent"}`, backdropFilter: scrolled ? "blur(12px)" : "none" }} className="sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div style={{ background: GRAD }} className="w-9 h-9 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5" style={{ color: "#04121e" }} />
            </div>
            <span className="text-lg font-black" style={{ color: TXT }}>moneylix</span>
          </Link>
          <div className="hidden lg:flex items-center gap-8 text-sm font-semibold" style={{ color: MUT }}>
            <a href="#features" className="hover:opacity-70 transition">Features</a>
            <a href="#how" className="hover:opacity-70 transition">How it works</a>
            <a href="#pricing" className="hover:opacity-70 transition">Pricing</a>
            <a href="#faq" className="hover:opacity-70 transition">FAQ</a>
          </div>
          <div className="hidden lg:flex items-center gap-3">
            <button onClick={toggleTheme} aria-label="Toggle theme"
              style={{ background: CARD, border: `1px solid ${BORDER}`, color: TXT }}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:opacity-80 transition">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link href="/auth/login" className="text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-70 transition" style={{ color: TXT }}>Log in</Link>
            <Link href="/auth/register" style={{ background: GRAD, color: "#04121e" }} className="text-sm font-black px-5 py-2.5 rounded-xl hover:opacity-90 transition">Start Free</Link>
          </div>
          <div className="lg:hidden flex items-center gap-2">
          <button onClick={toggleTheme} aria-label="Toggle theme" style={{ color: TXT }} className="w-9 h-9 flex items-center justify-center">
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button className="lg:hidden" onClick={() => setMenuOpen(!menuOpen)} style={{ color: TXT }}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          </div>
        </div>
        {menuOpen && (
          <div style={{ background: BG2, borderTop: `1px solid ${BORDER}` }} className="lg:hidden px-6 py-4 space-y-3">
            {[["Features","#features"],["How it works","#how"],["Pricing","#pricing"],["FAQ","#faq"]].map(([l,h]) => (
              <a key={h} href={h} onClick={() => setMenuOpen(false)} className="block text-sm font-semibold" style={{ color: MUT }}>{l}</a>
            ))}
            <Link href="/auth/register" onClick={() => setMenuOpen(false)} style={{ background: GRAD, color: "#04121e" }} className="block text-center text-sm font-black px-5 py-3 rounded-xl">Start Free</Link>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div style={{ background: "radial-gradient(600px 300px at 70% 20%, rgba(16,185,129,0.12), transparent)" }} className="absolute inset-0 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center relative">
          {/* Left copy */}
          <div>
            <div style={{ background: CARD, border: `1px solid ${BORDER}` }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6">
              <span style={{ background: EMERGREEN() }} className="w-1.5 h-1.5 rounded-full" />
              <span className="text-[11px] font-bold" style={{ color: MUT }}>RBI-regulated Account Aggregator</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight">
              AI-ready finance platform for <span style={{ background: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Indian businesses</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed max-w-lg" style={{ color: MUT }}>
              Manage end-to-end money — from UPI bank sync & GST invoicing to payroll, inventory & an AI advisor. The only India-first app that does it all in one place.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/auth/register" style={{ background: GRAD, color: "#04121e" }} className="inline-flex items-center gap-2 px-7 py-4 rounded-xl font-black text-base hover:opacity-90 transition active:scale-95">
                Start Free <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#pricing" style={{ border: `1px solid ${BORDER2}`, color: TXT }} className="px-7 py-4 rounded-xl font-bold text-base hover:opacity-70 transition">View Pricing</a>
            </div>
            <p className="mt-5 text-xs" style={{ color: MUT2 }}>No credit card required · Free plan forever · 🇮🇳 Made for India</p>
          </div>
          {/* Right: floating product cards (Zoho style) */}
          <div className="relative h-[440px] hidden lg:block">
            {/* Invoice card */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }} className="absolute top-0 right-0 w-64 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black" style={{ color: TXT }}>Invoice #INV-0042</span>
                <span style={{ background: "rgba(16,185,129,0.15)", color: EMERGREEN() }} className="text-[8px] font-bold px-2 py-0.5 rounded-full">GST Ready</span>
              </div>
              {[["Subtotal","₹50,000"],["CGST 9%","₹4,500"],["SGST 9%","₹4,500"]].map(([l,v]) => (
                <div key={l} className="flex justify-between text-[11px] py-0.5" style={{ color: MUT }}><span>{l}</span><span>{v}</span></div>
              ))}
              <div className="flex justify-between text-sm font-black mt-2 pt-2" style={{ borderTop: `1px solid ${BORDER}`, color: EMERGREEN() }}><span style={{ color: TXT }}>Total</span><span>₹59,000</span></div>
            </div>
            {/* Bank sync card */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }} className="absolute top-40 left-0 w-60 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div style={{ background: "rgba(34,211,238,0.15)" }} className="w-6 h-6 rounded-lg flex items-center justify-center"><Wallet className="w-3.5 h-3.5" style={{ color: CYANC() }} /></div>
                <span className="text-xs font-black" style={{ color: TXT }}>Bank Sync · Setu AA</span>
              </div>
              {[["UPI/SWIGGY","Food · 98%","-₹480"],["UPI/SALARY","Income · 99%","+₹85,000"]].map(([l,c,a]) => (
                <div key={l} className="flex items-center gap-2 py-1.5">
                  <span style={{ background: CYANC() }} className="w-1.5 h-1.5 rounded-full" />
                  <div className="flex-1"><p className="text-[10px] font-semibold" style={{ color: TXT }}>{l}</p><p className="text-[8px]" style={{ color: CYANC() }}>{c}</p></div>
                  <span className="text-[10px] font-black" style={{ color: a.startsWith("+") ? EMERGREEN() : "#fb7185" }}>{a}</span>
                </div>
              ))}
            </div>
            {/* Forecast card */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }} className="absolute bottom-0 right-6 w-56 rounded-2xl p-4">
              <p className="text-[10px] font-bold mb-2" style={{ color: MUT }}>Cash Flow · 90 days</p>
              <div className="flex items-end gap-1 h-16">
                {[40,55,45,65,60,75,70,85,80].map((h,i) => (
                  <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i >= 6 ? EMERGREEN() : "rgba(16,185,129,0.25)" }} />
                ))}
              </div>
              <p className="text-lg font-black mt-2" style={{ color: TXT }}>₹1,45,230 <span className="text-[10px]" style={{ color: EMERGREEN() }}>↑ 12.5%</span></p>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* ── TRUST STRIP ── */}
      <section style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, background: BG2 }} className="py-8 px-6 lg:px-10">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-center">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: MUT2 }}>Powered by</p>
          {["Setu AA · RBI","Razorpay","Google Gemini AI","SSL Encrypted"].map(x => (
            <span key={x} className="text-sm font-black" style={{ color: MUT }}>{x}</span>
          ))}
        </div>
      </section>

      {/* ── CAPABILITIES GRID ── */}
      <section id="features" className="py-24 px-6 lg:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-black text-xs uppercase tracking-[0.3em] mb-3" style={{ color: EMERGREEN() }}>Engineered for growth</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Everything you need to run the money side</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {capabilities.map(({ icon: Icon, title, desc, c }) => (
              <div key={title} style={{ background: CARD, border: `1px solid ${BORDER}` }} className="rounded-2xl p-6 hover:-translate-y-1 transition-transform">
                <div style={{ background: `${colorMap[c]}1a`, border: `1px solid ${colorMap[c]}33` }} className="w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6" style={{ color: colorMap[c] }} />
                </div>
                <p className="text-base font-black" style={{ color: TXT }}>{title}</p>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: MUT }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ background: BG2, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }} className="py-24 px-6 lg:px-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-black text-xs uppercase tracking-[0.3em] mb-3" style={{ color: EMERGREEN() }}>How it works</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Set up in 3 simple steps</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "01", icon: Wallet, t: "Connect your bank", d: "Link via RBI-regulated Setu Account Aggregator. You control consent — revoke anytime.", c: "emerald" },
              { n: "02", icon: Brain, t: "AI sorts everything", d: "UPI & bank transactions flow in automatically and Gemini AI categorizes them for you.", c: "cyan" },
              { n: "03", icon: TrendingUp, t: "You decide & grow", d: "See clear dashboards, forecasts, and AI investment advice to make smarter decisions.", c: "violet" },
            ].map(({ n, icon: Icon, t, d, c }) => (
              <div key={n} style={{ background: CARD, border: `1px solid ${BORDER}` }} className="rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div style={{ background: `${colorMap[c]}1a`, border: `1px solid ${colorMap[c]}33` }} className="w-12 h-12 rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6" style={{ color: colorMap[c] }} />
                  </div>
                  <span className="text-4xl font-black" style={{ color: "rgba(255,255,255,0.06)" }}>{n}</span>
                </div>
                <p className="text-lg font-black" style={{ color: TXT }}>{t}</p>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: MUT }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURE MODULES (alternating) ── */}
      <section className="py-8 px-6 lg:px-10">
        <div className="max-w-6xl mx-auto space-y-6 py-16">
          {modules.map((m, i) => (
            <div key={m.tag} className={`grid lg:grid-cols-2 gap-10 items-center ${i % 2 ? "lg:[direction:rtl]" : ""}`}>
              <div className="lg:[direction:ltr]">
                <span style={{ background: `${colorMap[m.c]}1a`, color: colorMap[m.c], border: `1px solid ${colorMap[m.c]}33` }} className="text-[11px] font-bold px-3 py-1 rounded-full">{m.tag}</span>
                <h3 className="text-2xl md:text-3xl font-black mt-4 tracking-tight" style={{ color: TXT }}>{m.title}</h3>
                <p className="mt-3 text-base leading-relaxed" style={{ color: MUT }}>{m.desc}</p>
                <div className="mt-5 space-y-2.5">
                  {m.bullets.map(b => (
                    <div key={b} className="flex items-center gap-2.5 text-sm" style={{ color: TXT }}>
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: colorMap[m.c] }} />{b}
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:[direction:ltr]">
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, boxShadow: "0 30px 70px rgba(0,0,0,0.4)" }} className="rounded-2xl p-6 h-56 flex items-center justify-center">
                  <div style={{ background: `${colorMap[m.c]}12`, border: `1px solid ${colorMap[m.c]}22` }} className="w-full h-full rounded-xl flex items-center justify-center">
                    {(() => { const Icn = m.c === "emerald" ? Receipt : m.c === "cyan" ? GitCompareArrows : BarChart3; return <Icn className="w-16 h-16" style={{ color: colorMap[m.c], opacity: 0.7 }} /> })()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ALL FEATURES GRID ── */}
      <section style={{ background: BG2, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }} className="py-24 px-6 lg:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="font-black text-xs uppercase tracking-[0.3em] mb-3" style={{ color: EMERGREEN() }}>All in one place</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">One app. Every finance need.</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {allFeatures.map(({ icon: Icon, label }) => (
              <div key={label} style={{ background: CARD, border: `1px solid ${BORDER}` }} className="rounded-xl p-4 flex items-center gap-3 hover:-translate-y-0.5 transition-transform">
                <div style={{ background: "rgba(16,185,129,0.12)" }} className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4.5 h-4.5" style={{ color: EMERGREEN(), width: 18, height: 18 }} />
                </div>
                <span className="text-sm font-bold" style={{ color: TXT }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24 px-6 lg:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-black text-xs uppercase tracking-[0.3em] mb-3" style={{ color: EMERGREEN() }}>Built for people like you</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Made for every kind of hustle</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(({ quote, name, role, icon: Icon, c }) => (
              <div key={name} style={{ background: CARD, border: `1px solid ${BORDER}` }} className="rounded-2xl p-6 flex flex-col">
                <div className="flex gap-1 mb-4">{[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4" style={{ color: "#f59e0b", fill: "#f59e0b" }} />)}</div>
                <p className="text-sm leading-relaxed flex-1" style={{ color: MUT }}>&ldquo;{quote}&rdquo;</p>
                <div className="flex items-center gap-3 mt-6 pt-6" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <div style={{ background: `${colorMap[c]}1a`, border: `1px solid ${colorMap[c]}33` }} className="w-11 h-11 rounded-xl flex items-center justify-center">
                    <Icon className="w-5 h-5" style={{ color: colorMap[c] }} />
                  </div>
                  <div><p className="text-sm font-black" style={{ color: TXT }}>{name}</p><p className="text-[11px]" style={{ color: MUT2 }}>{role}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEGMENTS ── */}
      <section style={{ background: BG2, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }} className="py-24 px-6 lg:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-black text-xs uppercase tracking-[0.3em] mb-3" style={{ color: EMERGREEN() }}>For every need</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">A solution for every business</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {segments.map(({ icon: Icon, title, desc, c }) => (
              <div key={title} style={{ background: CARD, border: `1px solid ${BORDER}` }} className="rounded-2xl p-6">
                <div style={{ background: `${colorMap[c]}1a`, border: `1px solid ${colorMap[c]}33` }} className="w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6" style={{ color: colorMap[c] }} />
                </div>
                <p className="text-base font-black" style={{ color: TXT }}>{title}</p>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: MUT }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-6 lg:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-black text-xs uppercase tracking-[0.3em] mb-3" style={{ color: EMERGREEN() }}>Pricing</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">The perfect balance of features & affordability</h2>
            <p className="mt-3 text-base" style={{ color: MUT }}>Up to 5× cheaper than Zoho Books. Cancel anytime.</p>
            <div style={{ background: CARD, border: `1px solid ${BORDER}` }} className="inline-flex items-center gap-1 mt-7 p-1 rounded-full">
              <button onClick={() => setYearly(false)} style={{ background: !yearly ? "#fff" : "transparent", color: !yearly ? "#04121e" : MUT }} className="px-5 py-2 rounded-full text-xs font-black transition">Monthly</button>
              <button onClick={() => setYearly(true)} style={{ background: yearly ? "#fff" : "transparent", color: yearly ? "#04121e" : MUT }} className="px-5 py-2 rounded-full text-xs font-black transition flex items-center gap-2">
                Yearly <span style={{ background: "rgba(16,185,129,0.2)", color: EMERGREEN() }} className="text-[9px] px-1.5 py-0.5 rounded-full">Save 25%</span>
              </button>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map(p => (
              <div key={p.name} style={{ background: CARD, border: `1px solid ${p.pop ? p.c + "66" : BORDER}`, boxShadow: p.pop ? `0 20px 60px ${p.c}22` : "none" }} className="relative rounded-2xl p-7 flex flex-col gap-5">
                {p.badge && <div style={{ background: p.c, color: "#04121e" }} className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">{p.badge}</div>}
                <div className="flex items-center gap-3 mt-1">
                  <div style={{ background: `${p.c}1a`, border: `1px solid ${p.c}33` }} className="w-10 h-10 rounded-xl flex items-center justify-center"><p.icon className="w-5 h-5" style={{ color: p.c }} /></div>
                  <p className="text-sm font-black uppercase tracking-widest" style={{ color: p.c }}>{p.name}</p>
                </div>
                <div>
                  <div className="flex items-end gap-1.5">
                    <span className="text-4xl font-black" style={{ color: TXT }}>{yearly ? p.py : p.pm}</span>
                    <span className="text-sm mb-1.5" style={{ color: MUT2 }}>{p.name === "Free" ? p.per : (yearly ? "/mo billed yearly" : p.per)}</span>
                  </div>
                  {(yearly ? p.noteY : p.noteM) && <p className="text-xs font-semibold mt-1.5" style={{ color: EMERGREEN() }}>{yearly ? p.noteY : p.noteM}</p>}
                </div>
                <div className="flex-1 space-y-2.5">
                  {p.feats.map(f => <div key={f} className="flex items-center gap-2.5 text-sm" style={{ color: TXT }}><Check className="w-4 h-4 flex-shrink-0" style={{ color: p.c }} />{f}</div>)}
                  {p.locked.map(f => <div key={f} className="flex items-center gap-2.5 text-sm line-through" style={{ color: MUT2 }}><div style={{ border: `1px solid ${MUT2}` }} className="w-4 h-4 rounded-full flex-shrink-0" />{f}</div>)}
                </div>
                <Link href="/auth/register" style={{ background: p.pop ? p.c : "transparent", border: p.pop ? "none" : `1px solid ${BORDER2}`, color: p.pop ? "#04121e" : TXT }} className="w-full py-3.5 rounded-xl text-sm font-black text-center hover:opacity-90 transition">{p.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SWITCH BANNER ── */}
      <section className="py-16 px-6 lg:px-10">
        <div style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.12),rgba(34,211,238,0.05))", border: "1px solid rgba(16,185,129,0.2)" }} className="max-w-4xl mx-auto rounded-3xl p-10 text-center">
          <p className="font-black text-xs uppercase tracking-[0.3em] mb-3" style={{ color: EMERGREEN() }}>Switching over?</p>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: TXT }}>Coming from Zoho, Tally, or Vyapar?</h2>
          <p className="mt-4 text-base max-w-2xl mx-auto" style={{ color: MUT }}>Moneylix is up to <span style={{ color: TXT }} className="font-bold">5× cheaper</span> than Zoho Books, with UPI-native bank sync they don&apos;t offer. Already on Tally? Export in Tally-compatible format anytime — no lock-in.</p>
          <Link href="/auth/register" style={{ background: GRAD, color: "#04121e" }} className="inline-flex items-center gap-2 mt-7 px-7 py-3.5 rounded-xl font-black text-sm hover:opacity-90 transition">Start Free — No Card Needed <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ background: BG2, borderTop: `1px solid ${BORDER}` }} className="py-24 px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="font-black text-xs uppercase tracking-[0.3em] mb-3" style={{ color: EMERGREEN() }}>FAQ</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Questions? Answered.</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((item, i) => (
              <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}` }} className="rounded-2xl overflow-hidden">
                <button onClick={() => setFaq(faq === i ? null : i)} className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left">
                  <span className="text-sm md:text-base font-bold" style={{ color: TXT }}>{item.q}</span>
                  <ChevronRight className="w-5 h-5 flex-shrink-0 transition-transform" style={{ color: EMERGREEN(), transform: faq === i ? "rotate(90deg)" : "none" }} />
                </button>
                {faq === i && <div className="px-6 pb-5 -mt-1"><p className="text-sm leading-relaxed" style={{ color: MUT }}>{item.a}</p></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-28 px-6 lg:px-10 text-center relative overflow-hidden">
        <div style={{ background: "radial-gradient(500px 250px at 50% 50%, rgba(16,185,129,0.12), transparent)" }} className="absolute inset-0 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">Take control of your <span style={{ background: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>financial future.</span></h2>
          <p className="mt-5 text-lg" style={{ color: MUT }}>Join freelancers and business owners who use Moneylix to track, save, and grow.</p>
          <Link href="/auth/register" style={{ background: GRAD, color: "#04121e" }} className="inline-flex items-center gap-2 mt-8 px-9 py-4 rounded-xl font-black text-lg hover:opacity-90 transition active:scale-95">Create Free Account <ArrowRight className="w-5 h-5" /></Link>
          <p className="mt-5 text-xs" style={{ color: MUT2 }}>No credit card required · Free plan forever · 🇮🇳 Made for India</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `1px solid ${BORDER}` }} className="py-12 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div style={{ background: GRAD }} className="w-8 h-8 rounded-lg flex items-center justify-center"><Wallet className="w-4 h-4" style={{ color: "#04121e" }} /></div>
            <span className="text-base font-black" style={{ color: TXT }}>moneylix</span>
          </Link>
          <div className="flex items-center gap-7 text-sm" style={{ color: MUT }}>
            <a href="#features" className="hover:opacity-70 transition">Features</a>
            <a href="#pricing" className="hover:opacity-70 transition">Pricing</a>
            <a href="#faq" className="hover:opacity-70 transition">FAQ</a>
            <Link href="/auth/login" className="hover:opacity-70 transition">Login</Link>
          </div>
          <p className="text-sm flex items-center gap-2" style={{ color: MUT2 }}><Globe className="w-4 h-4" /> www.moneylix.in · 🇮🇳</p>
        </div>
        <div style={{ borderTop: `1px solid ${BORDER}`, color: MUT2 }} className="max-w-7xl mx-auto mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p>© 2026 Moneylix. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:opacity-70 transition">Privacy</Link>
            <Link href="/terms" className="hover:opacity-70 transition">Terms</Link>
            <Link href="/cookie-policy" className="hover:opacity-70 transition">Cookies</Link>
          </div>
          <p className="flex items-center gap-1.5"><Shield className="w-3 h-3" style={{ color: EMERGREEN() }} /> Secured by Razorpay · SSL</p>
        </div>
      </footer>
    </div>
  )
}

// Helper color fns (avoid repeating literals in JSX)
function EMERGREEN() { return "#10b981" }
function CYANC() { return "#22d3ee" }
