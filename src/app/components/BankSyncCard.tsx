'use client'

import { useState, useEffect, useCallback } from 'react'
import { Building2, RefreshCw, Unlink, Smartphone, CheckCircle, Clock, AlertCircle, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'

interface BankConnection {
  id: number
  status: string
  bank_name: string | null
  masked_account_number: string | null
  account_type: string | null
  ifsc_code: string | null
  branch_name: string | null
  fip_id: string | null
  consent_expiry: string | null
  last_synced_at: string | null
  last_sync_error: string | null
  transactionCount: number
}

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/

const AA_BANKS = [
  'State Bank of India',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'IDFC FIRST Bank',
  'Yes Bank',
  'IndusInd Bank',
  'Bank of India',
  'Bank of Maharashtra',
  'Central Bank of India',
  'Indian Bank',
  'Indian Overseas Bank',
  'UCO Bank',
  'Punjab & Sind Bank',
  'Federal Bank',
  'South Indian Bank',
  'Karnataka Bank',
  'Karur Vysya Bank',
  'City Union Bank',
  'Tamilnad Mercantile Bank',
  'DCB Bank',
  'RBL Bank',
  'Bandhan Bank',
  'AU Small Finance Bank',
  'Equitas Small Finance Bank',
  'Ujjivan Small Finance Bank',
  'Jammu & Kashmir Bank',
  'Dhanlaxmi Bank',
  'Standard Chartered Bank',
  'Citibank',
  'HSBC Bank',
  'Deutsche Bank',
]

export function BankSyncCard() {
  const [connection, setConnection] = useState<BankConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [categorising, setCategorising] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showConnect, setShowConnect] = useState(false)
  const [connectMode, setConnectMode] = useState<'aa' | 'manual'>('aa')
  const [mobileNumber, setMobileNumber] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  // AA flow: bank selection + mobile OTP verification
  const [selectedBank, setSelectedBank] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [devOtp, setDevOtp] = useState<string | null>(null)

  // Manual bank account entry (IFSC-based)
  const [accountNumber, setAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [ifscPreview, setIfscPreview] = useState<{ bank: string; branch: string } | null>(null)
  const [ifscLoading, setIfscLoading] = useState(false)
  const [ifscError, setIfscError] = useState<string | null>(null)
  const [addingManual, setAddingManual] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const getToken = () => localStorage.getItem('moneylix_session_token') || ''

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/bank/connections', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
      const data = await res.json()
      const active = data.connections?.find((c: BankConnection) => c.status === 'active')
      const pending = data.connections?.find((c: BankConnection) => c.status === 'pending')
      setConnection(active || pending || null)
    } catch {
      // Silently fail — feature just won't show
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    
    // If redirected back from Setu consent page, poll for status update
    const params = new URLSearchParams(window.location.search)
    if (params.get('bank_consent') === 'success') {
      const pollInterval = setInterval(async () => {
        const res = await fetch('/api/bank/consent-status', {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
        const data = await res.json()
        if (data.status === 'active') {
          clearInterval(pollInterval)
          fetchStatus()
          showToast('Bank connected successfully!')
        }
      }, 3000)
      
      // Stop polling after 60 seconds
      setTimeout(() => clearInterval(pollInterval), 60000)
      
      // Clean URL
      window.history.replaceState({}, '', '/dashboard/settings')
    }
  }, [fetchStatus])

  const resetAaFlow = () => {
    setMobileNumber('')
    setSelectedBank('')
    setOtpSent(false)
    setOtp('')
    setDevOtp(null)
  }

  const handleSendOtp = async () => {
    if (!selectedBank) {
      showToast('Select your bank')
      return
    }
    if (!mobileNumber || !/^[6-9]\d{9}$/.test(mobileNumber)) {
      showToast('Enter a valid 10-digit mobile number')
      return
    }
    setSendingOtp(true)
    try {
      const res = await fetch('/api/bank/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ mobileNumber, bankName: selectedBank }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed to send OTP')
        return
      }
      setOtpSent(true)
      setDevOtp(data.devOtp || null)
      showToast(data.message)
    } catch {
      showToast('Something went wrong')
    } finally {
      setSendingOtp(false)
    }
  }

  const handleConnect = async () => {
    if (!otp || !/^\d{6}$/.test(otp)) {
      showToast('Enter the 6-digit OTP')
      return
    }
    setConnecting(true)
    try {
      const res = await fetch('/api/bank/create-consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ mobileNumber, bankName: selectedBank, otp }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed to connect')
        setConnecting(false)
        return
      }
      // Redirect to Setu consent page
      window.location.href = data.redirectUrl
    } catch {
      showToast('Something went wrong')
      setConnecting(false)
    }
  }

  // Live-preview bank name & branch as the user finishes typing their IFSC code
  useEffect(() => {
    const code = ifscCode.trim().toUpperCase()
    setIfscPreview(null)
    setIfscError(null)
    if (code.length !== 11) return
    if (!IFSC_REGEX.test(code)) {
      setIfscError('Invalid IFSC format')
      return
    }
    let cancelled = false
    setIfscLoading(true)
    fetch(`/api/bank/ifsc-lookup?code=${code}`)
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return
        if (!ok) {
          setIfscError(data.error || 'IFSC code not found')
          return
        }
        setIfscPreview({ bank: data.bank, branch: data.branch })
      })
      .catch(() => { if (!cancelled) setIfscError('Could not look up IFSC code') })
      .finally(() => { if (!cancelled) setIfscLoading(false) })
    return () => { cancelled = true }
  }, [ifscCode])

  const handleAddManual = async () => {
    if (!/^\d{9,18}$/.test(accountNumber)) {
      showToast('Enter a valid account number (9-18 digits)')
      return
    }
    if (!ifscPreview) {
      showToast('Enter a valid IFSC code')
      return
    }
    setAddingManual(true)
    try {
      const res = await fetch('/api/bank/add-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ accountNumber, ifscCode: ifscCode.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed to add bank account')
        return
      }
      showToast(`${data.bankName} account added`)
      setShowConnect(false)
      setAccountNumber('')
      setIfscCode('')
      setIfscPreview(null)
      fetchStatus()
    } catch {
      showToast('Something went wrong')
    } finally {
      setAddingManual(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/bank/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Sync failed')
      } else {
        showToast(data.message)
        fetchStatus()
      }
    } catch {
      showToast('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleCategorise = async () => {
    setCategorising(true)
    try {
      const res = await fetch('/api/bank/categorise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Categorisation failed')
      } else {
        showToast(data.message)
      }
    } catch {
      showToast('Categorisation failed')
    } finally {
      setCategorising(false)
    }
  }

  const handleDisconnect = async () => {
    if (!connection) return
    const confirmMsg = connection.fip_id === 'MANUAL'
      ? 'Remove this bank account?'
      : 'This will revoke bank access and delete all synced transactions. Continue?'
    if (!confirm(confirmMsg)) return
    
    setDisconnecting(true)
    try {
      const res = await fetch('/api/bank/connections', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ connectionId: connection.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed to disconnect')
      } else {
        showToast('Bank disconnected')
        setConnection(null)
      }
    } catch {
      showToast('Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
        <div className="h-4 w-32 bg-white/10 rounded mb-2" />
        <div className="h-3 w-48 bg-white/5 rounded" />
      </div>
    )
  }

  // Connected state
  if (connection && connection.status === 'active') {
    const expiryDate = connection.consent_expiry ? new Date(connection.consent_expiry) : null
    const isExpiringSoon = expiryDate && (expiryDate.getTime() - Date.now()) < 30 * 24 * 60 * 60 * 1000
    const isManual = connection.fip_id === 'MANUAL'

    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-white">{connection.bank_name || 'Bank Account'}</p>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-[10px] text-slate-400">
                {isManual
                  ? `${connection.masked_account_number || ''} · ${connection.ifsc_code || ''}`
                  : `${connection.masked_account_number || 'Connected'} · ${connection.transactionCount} transactions synced`}
              </p>
            </div>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-white/5 transition">
            {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
        </div>

        {!isManual && (
          /* Last sync info */
          <div className="flex items-center gap-4 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {connection.last_synced_at
                ? `Last sync: ${new Date(connection.last_synced_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                : 'Not synced yet'
              }
            </span>
            {isExpiringSoon && (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertCircle className="w-3 h-3" /> Consent expiring soon
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        {isManual ? (
          <div className="text-[10px] text-slate-400">
            {connection.branch_name && <p>Branch: {connection.branch_name}</p>}
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 font-semibold hover:bg-emerald-500/20 active:scale-95 transition-all disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              onClick={handleCategorise}
              disabled={categorising}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300 font-semibold hover:bg-violet-500/20 active:scale-95 transition-all disabled:opacity-40"
            >
              <Sparkles className={`w-3.5 h-3.5 ${categorising ? 'animate-pulse' : ''}`} />
              {categorising ? 'Categorising...' : 'AI Categorise'}
            </button>
          </div>
        )}

        {/* Expanded: disconnect option */}
        {expanded && (
          <div className="pt-2 border-t border-white/5">
            {connection.last_sync_error && (
              <p className="text-[10px] text-rose-400 mb-2">⚠️ Last error: {connection.last_sync_error}</p>
            )}
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition disabled:opacity-40"
            >
              <Unlink className="w-3 h-3" />
              {disconnecting ? (isManual ? 'Removing...' : 'Disconnecting...') : (isManual ? 'Remove Bank Account' : 'Disconnect Bank')}
            </button>
          </div>
        )}

        {toast && <div className="text-[10px] text-emerald-400 font-medium mt-1">{toast}</div>}
      </div>
    )
  }

  // Pending state
  if (connection && connection.status === 'pending') {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Waiting for Approval</p>
            <p className="text-[10px] text-slate-400">Complete consent approval on your bank&apos;s app to connect</p>
          </div>
        </div>
        <p className="text-[10px] text-slate-500">
          Check your mobile for a notification from your bank. Once approved, this will update automatically.
        </p>
      </div>
    )
  }

  // Not connected — show connect card
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <p className="text-xs font-bold text-white">Connect Bank Account</p>
          <p className="text-[10px] text-slate-400">Auto-import transactions via Account Aggregator</p>
        </div>
      </div>

      {!showConnect ? (
        <button
          onClick={() => setShowConnect(true)}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-300 font-semibold hover:bg-blue-500/20 active:scale-95 transition-all"
        >
          <Building2 className="w-3.5 h-3.5" /> Connect Bank
        </button>
      ) : (
        <div className="space-y-3">
          {/* Mode toggle */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
            <button
              onClick={() => setConnectMode('aa')}
              className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition ${connectMode === 'aa' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Account Aggregator
            </button>
            <button
              onClick={() => setConnectMode('manual')}
              className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition ${connectMode === 'manual' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Add Manually
            </button>
          </div>

          {connectMode === 'aa' ? (
            <>
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">Select your bank</label>
                <select
                  value={selectedBank}
                  onChange={e => setSelectedBank(e.target.value)}
                  disabled={otpSent}
                  className="w-full px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
                >
                  <option value="" className="bg-slate-800">Select your bank</option>
                  {AA_BANKS.map(b => (
                    <option key={b} value={b} className="bg-slate-800">{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">Mobile number linked to your bank</label>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-slate-400">
                    <Smartphone className="w-3.5 h-3.5" /> +91
                  </div>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    maxLength={10}
                    value={mobileNumber}
                    onChange={e => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                    disabled={otpSent}
                    className="flex-1 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
                    autoFocus
                  />
                </div>
              </div>

              {otpSent && (
                <div>
                  <label className="text-[10px] text-slate-400 mb-1 block">Enter OTP sent to +91 {mobileNumber}</label>
                  <input
                    type="tel"
                    placeholder="6-digit OTP"
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 tracking-widest"
                    autoFocus
                  />
                  {devOtp && (
                    <p className="text-[10px] text-amber-400 mt-1">Demo OTP: {devOtp} (no SMS gateway configured)</p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { if (otpSent) { setOtpSent(false); setOtp(''); setDevOtp(null) } else { setShowConnect(false); resetAaFlow() } }}
                  className="px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-slate-400 hover:bg-white/5 transition"
                >
                  {otpSent ? 'Change details' : 'Cancel'}
                </button>
                {!otpSent ? (
                  <button
                    onClick={handleSendOtp}
                    disabled={sendingOtp || !selectedBank || mobileNumber.length !== 10}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-xs font-bold text-blue-300 hover:bg-blue-500/30 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {sendingOtp ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending OTP...</>
                    ) : (
                      <>Send OTP</>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleConnect}
                    disabled={connecting || otp.length !== 6}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-xs font-bold text-blue-300 hover:bg-blue-500/30 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {connecting ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Connecting...</>
                    ) : (
                      <><Building2 className="w-3.5 h-3.5" /> Verify & Connect</>
                    )}
                  </button>
                )}
              </div>
              <p className="text-[9px] text-slate-500 leading-relaxed">
                🔒 Your data is fetched securely via RBI-licensed Account Aggregator framework. We never see your banking credentials.
                Consent can be revoked anytime.
              </p>
            </>
          ) : (
            <>
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">Account number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 123456789012"
                  maxLength={18}
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">IFSC code</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC0000001"
                  maxLength={11}
                  value={ifscCode}
                  onChange={e => setIfscCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  className="w-full px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white uppercase placeholder:text-slate-500 placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                {ifscLoading && <p className="text-[10px] text-slate-500 mt-1">Looking up bank...</p>}
                {ifscError && <p className="text-[10px] text-rose-400 mt-1">{ifscError}</p>}
                {ifscPreview && (
                  <p className="text-[10px] text-emerald-400 mt-1">
                    {ifscPreview.bank} · {ifscPreview.branch}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowConnect(false); setAccountNumber(''); setIfscCode(''); setIfscPreview(null) }}
                  className="px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-slate-400 hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddManual}
                  disabled={addingManual || !ifscPreview || !/^\d{9,18}$/.test(accountNumber)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-xs font-bold text-blue-300 hover:bg-blue-500/30 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {addingManual ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Adding...</>
                  ) : (
                    <><Building2 className="w-3.5 h-3.5" /> Add Bank Account</>
                  )}
                </button>
              </div>
              <p className="text-[9px] text-slate-500 leading-relaxed">
                Bank name and branch are fetched automatically from your IFSC code.
              </p>
            </>
          )}
        </div>
      )}

      {toast && <div className="text-[10px] text-rose-400 font-medium mt-1">{toast}</div>}
    </div>
  )
}
