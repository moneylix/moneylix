'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Download, FileText, FileSpreadsheet, FileCode, ArrowLeft,
  Calendar, Building2, Eye, Loader2, CheckCircle2, AlertCircle, Lock,
} from 'lucide-react'
import { useBusiness } from '@/lib/contexts/BusinessContext'
import { useCurrency } from '@/lib/contexts/CurrencyContext'
import { usePlan } from '@/lib/contexts/PlanContext'

interface ReportPreview {
  type: string
  data: Record<string, unknown> | null
  loading: boolean
  error: string | null
}

const REPORT_TYPES = [
  {
    id: 'tally',
    name: 'Tally XML Export',
    description: 'Tally-compatible voucher format. Import directly into Tally ERP for bookkeeping.',
    icon: FileCode,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    format: 'XML',
    endpoint: '/api/export/tally',
  },
  {
    id: 'tax-report',
    name: 'Tax-Ready Report',
    description: 'Comprehensive JSON report with P&L, GST summary, TDS, category breakdowns. Share with your CA.',
    icon: FileText,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    format: 'JSON',
    endpoint: '/api/export/tax-report',
  },
  {
    id: 'excel-report',
    name: 'Excel / CSV Report',
    description: 'Multi-section CSV with transactions, category summary, monthly summary, and GST breakdown. Opens in Excel/Sheets.',
    icon: FileSpreadsheet,
    color: 'bg-lime-50 text-lime-700 border-lime-200',
    format: 'CSV',
    endpoint: '/api/export/excel-report',
  },
]

function getFinancialYearDates(fy: string): { start: string; end: string } {
  const startYear = parseInt(fy.split('-')[0], 10)
  return { start: `${startYear}-04-01`, end: `${startYear + 1}-03-31` }
}

function getFinancialYearOptions(): string[] {
  const now = new Date()
  const m = now.getMonth()
  const y = now.getFullYear()
  const startYear = m >= 3 ? y : y - 1
  const years: string[] = []
  for (let yr = startYear; yr >= startYear - 5; yr--) {
    years.push(`${yr}-${String(yr + 1).slice(2)}`)
  }
  return years
}

export default function ExportCenterPage() {
  const { activeBusiness } = useBusiness()
  const { currentCurrency, currencies } = useCurrency()
  const { can } = usePlan()

  const [dateMode, setDateMode] = useState<'fy' | 'custom'>('fy')
  const [fy, setFy] = useState(() => {
    const now = new Date()
    const m = now.getMonth()
    const y = now.getFullYear()
    const startYear = m >= 3 ? y : y - 1
    return `${startYear}-${String(startYear + 1).slice(2)}`
  })
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [preview, setPreview] = useState<ReportPreview>({ type: '', data: null, loading: false, error: null })
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null)

  const fyOptions = getFinancialYearOptions()

  const getDateParams = useCallback(() => {
    if (dateMode === 'fy') {
      const dates = getFinancialYearDates(fy)
      return { startDate: dates.start, endDate: dates.end }
    }
    return { startDate, endDate }
  }, [dateMode, fy, startDate, endDate])

  const handleDownload = async (reportType: typeof REPORT_TYPES[0]) => {
    if (!activeBusiness) return
    setDownloading(reportType.id)
    setDownloadSuccess(null)

    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const dates = getDateParams()

      const params = new URLSearchParams({
        businessId: String(activeBusiness.id),
      })

      if (reportType.id === 'tax-report') {
        params.set('financialYear', fy)
      } else {
        if (dates.startDate) params.set('startDate', dates.startDate)
        if (dates.endDate) params.set('endDate', dates.endDate)
      }

      const res = await fetch(`${reportType.endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Download failed' }))
        throw new Error(errData.error || 'Download failed')
      }

      // Get filename from Content-Disposition or generate one
      const disposition = res.headers.get('Content-Disposition')
      let filename = `moneylix_export.${reportType.format.toLowerCase()}`
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/)
        if (match) filename = match[1]
      }

      // Download as blob
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setDownloadSuccess(reportType.id)
      setTimeout(() => setDownloadSuccess(null), 3000)
    } catch (err: any) {
      console.error('Download error:', err)
      alert(err.message || 'Failed to download report')
    } finally {
      setDownloading(null)
    }
  }

  const handlePreview = async (reportType: typeof REPORT_TYPES[0]) => {
    if (!activeBusiness || reportType.id !== 'tax-report') return
    setPreview({ type: reportType.id, data: null, loading: true, error: null })

    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const params = new URLSearchParams({
        businessId: String(activeBusiness.id),
        financialYear: fy,
      })

      const res = await fetch(`${reportType.endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) throw new Error('Failed to load preview')
      const data = await res.json()
      setPreview({ type: reportType.id, data, loading: false, error: null })
    } catch (err: any) {
      setPreview({ type: reportType.id, data: null, loading: false, error: err.message })
    }
  }

  const fmt = useCallback(
    (n: number) => {
      const sym = currencies.find((c) => c.code === currentCurrency)?.symbol ?? '₹'
      return `${sym}${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    },
    [currencies, currentCurrency],
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/tax" className="p-1.5 rounded-lg hover:bg-neutral-100 transition text-neutral-400">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-neutral-900">Export Center</h1>
          <p className="text-[10px] text-neutral-400">Download tax reports and Tally-compatible exports</p>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white shadow-sm rounded-2xl p-4">
        <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">Report Period</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-neutral-100 rounded-lg p-0.5">
            <button
              onClick={() => setDateMode('fy')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${dateMode === 'fy' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500'}`}
            >
              Financial Year
            </button>
            <button
              onClick={() => setDateMode('custom')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${dateMode === 'custom' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500'}`}
            >
              Custom Range
            </button>
          </div>

          {dateMode === 'fy' ? (
            <select
              value={fy}
              onChange={(e) => setFy(e.target.value)}
              className="text-xs border border-neutral-200 rounded-lg px-3 py-1.5 bg-white text-neutral-700"
            >
              {fyOptions.map((y) => (
                <option key={y} value={y}>FY {y}</option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs border border-neutral-200 rounded-lg px-3 py-1.5 bg-white text-neutral-700"
              />
              <span className="text-xs text-neutral-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs border border-neutral-200 rounded-lg px-3 py-1.5 bg-white text-neutral-700"
              />
            </div>
          )}
        </div>
      </div>

      {/* Report Type Cards */}
      <div className="grid gap-3">
        {REPORT_TYPES.map((report) => {
          const Icon = report.icon
          const isDownloading = downloading === report.id
          const isSuccess = downloadSuccess === report.id
          const isLocked = report.id === 'tally' && !can('tallyExport')

          return (
            <div key={report.id} className={`bg-white shadow-sm rounded-2xl p-4 border transition-all ${isSuccess ? 'border-lime-300' : 'border-transparent'} ${isLocked ? 'opacity-60 grayscale' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl border ${report.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xs font-bold text-neutral-900">{report.name}</h3>
                    <span className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded font-mono">{report.format}</span>
                    {isLocked && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
                        <Lock className="w-2.5 h-2.5" /> Enterprise
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-relaxed">{report.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isLocked ? (
                    <Link
                      href="/dashboard/pricing"
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold transition bg-violet-100 text-violet-700 hover:bg-violet-200"
                    >
                      Upgrade
                    </Link>
                  ) : (
                    <>
                      {report.id === 'tax-report' && (
                        <button
                          onClick={() => handlePreview(report)}
                          disabled={!activeBusiness || preview.loading}
                          className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition font-medium disabled:opacity-50"
                        >
                          <Eye className="w-3 h-3" /> Preview
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(report)}
                        disabled={!activeBusiness || isDownloading}
                        className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold transition disabled:opacity-50 ${
                          isSuccess
                            ? 'bg-lime-100 text-lime-700'
                            : 'bg-lime-400 text-neutral-900 hover:bg-lime-300'
                        }`}
                      >
                        {isDownloading ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
                        ) : isSuccess ? (
                          <><CheckCircle2 className="w-3 h-3" /> Downloaded</>
                        ) : (
                          <><Download className="w-3 h-3" /> Download</>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Preview Panel */}
      {preview.type && (
        <div className="bg-white shadow-sm rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-neutral-900">Report Preview</h3>
            <button onClick={() => setPreview({ type: '', data: null, loading: false, error: null })} className="text-[10px] text-neutral-400 hover:text-neutral-600">
              Close
            </button>
          </div>

          {preview.loading && (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {preview.error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 rounded-xl text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4" />
              {preview.error}
            </div>
          )}

          {preview.data && (
            <div className="space-y-4">
              {/* P&L Summary */}
              {(preview.data as any).profitAndLoss && (
                <div>
                  <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Profit & Loss</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <PreviewStat label="Total Income" value={fmt((preview.data as any).profitAndLoss.totalIncome)} />
                    <PreviewStat label="Total Expense" value={fmt((preview.data as any).profitAndLoss.totalExpense)} />
                    <PreviewStat label="Net Profit" value={fmt((preview.data as any).profitAndLoss.netProfit)} highlight={(preview.data as any).profitAndLoss.netProfit < 0} />
                    <PreviewStat label="Margin" value={`${(preview.data as any).profitAndLoss.profitMargin}%`} />
                  </div>
                </div>
              )}

              {/* GST Summary */}
              {(preview.data as any).gstSummary && (
                <div>
                  <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">GST Summary</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <PreviewStat label="GST Collected" value={fmt((preview.data as any).gstSummary.gstCollected)} />
                    <PreviewStat label="GST Paid" value={fmt((preview.data as any).gstSummary.gstPaid)} />
                    <PreviewStat label={`Net ${(preview.data as any).gstSummary.netStatus}`} value={fmt(Math.abs((preview.data as any).gstSummary.netGST))} />
                    <PreviewStat label="Tax Rate" value={`${(preview.data as any).gstSummary.taxRate}%`} />
                  </div>
                </div>
              )}

              {/* Income Categories */}
              {(preview.data as any).incomeByCategory?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Income by Category ({(preview.data as any).incomeByCategory.length})
                  </p>
                  <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-100 overflow-hidden">
                    {(preview.data as any).incomeByCategory.slice(0, 8).map((cat: any, i: number) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs text-neutral-700">{cat.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-neutral-400">{cat.transactions} txns</span>
                          <span className="text-xs font-bold font-mono text-lime-700">{fmt(cat.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expense Categories */}
              {(preview.data as any).expenseByCategory?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Expenses by Category ({(preview.data as any).expenseByCategory.length})
                  </p>
                  <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-100 overflow-hidden">
                    {(preview.data as any).expenseByCategory.slice(0, 8).map((cat: any, i: number) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs text-neutral-700">{cat.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-neutral-400">{cat.transactions} txns</span>
                          <span className="text-xs font-bold font-mono text-rose-600">{fmt(cat.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-neutral-400 text-center pt-2">
                Download the full report for complete details including monthly breakdowns and TDS summary.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info Notes */}
      <div className="bg-neutral-50 rounded-2xl p-4 space-y-2">
        <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Notes for your CA</p>
        <ul className="text-[10px] text-neutral-500 space-y-1 list-disc list-inside">
          <li><strong>Tally XML:</strong> Import via Gateway of Tally → Import Data → select the downloaded XML file.</li>
          <li><strong>Tax Report (JSON):</strong> Machine-readable format. Can be parsed by accounting software or shared as-is with your CA.</li>
          <li><strong>Excel/CSV:</strong> Opens directly in Microsoft Excel, Google Sheets, or LibreOffice. Contains all sections in a single file.</li>
          <li>GST amounts are estimated from transaction totals using the configured tax rate. Verify with actual invoice GST breakdowns.</li>
          <li>Only completed transactions are included. Pending/draft items are excluded.</li>
        </ul>
      </div>
    </div>
  )
}

function PreviewStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-2 rounded-lg ${highlight ? 'bg-rose-50' : 'bg-neutral-50'}`}>
      <p className="text-[10px] text-neutral-500">{label}</p>
      <p className={`text-xs font-bold font-mono ${highlight ? 'text-rose-700' : 'text-neutral-900'}`}>{value}</p>
    </div>
  )
}
