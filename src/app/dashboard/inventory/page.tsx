'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, X, Package, AlertTriangle, Search, ShoppingCart,
  TrendingUp, TrendingDown, Edit2, Trash2, ArrowUpRight,
  ArrowDownLeft, RefreshCw, BarChart3,
} from 'lucide-react'
import { useBusiness } from '@/lib/contexts/BusinessContext'
import { useCurrency } from '@/lib/contexts/CurrencyContext'
import { useTranslation } from '@/lib/i18n'

interface InventoryItem {
  id: number
  name: string
  sku: string | null
  description: string | null
  category: string | null
  unit: string
  cost_price: number
  selling_price: number
  current_stock: number
  low_stock_threshold: number
  status: string
}

interface InventorySummary {
  total_items: number
  stock_value_cost: number
  stock_value_selling: number
  low_stock_count: number
  out_of_stock_count: number
}

interface Movement {
  id: number
  item_name: string
  item_sku: string | null
  type: string
  quantity: number
  unit_price: number | null
  total_amount: number | null
  notes: string | null
  created_at: string
}

function getMovementTypeLabels(t: (key: string) => string): Record<string, { label: string; cls: string; icon: typeof ArrowUpRight }> {
  return {
    purchase: { label: t('inventory.purchase'), cls: 'text-blue-700 bg-blue-100', icon: ArrowDownLeft },
    sale: { label: t('inventory.sale'), cls: 'text-lime-700 bg-lime-100', icon: ArrowUpRight },
    adjustment: { label: t('inventory.adjustment'), cls: 'text-amber-700 bg-amber-100', icon: RefreshCw },
    return: { label: t('inventory.return'), cls: 'text-purple-700 bg-purple-100', icon: ArrowDownLeft },
  }
}

export default function InventoryPage() {
  const { t } = useTranslation()
  const movementTypeLabels = getMovementTypeLabels(t)
  const { activeBusiness } = useBusiness()
  const { currentCurrency, currencies } = useCurrency()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showLowStock, setShowLowStock] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [tab, setTab] = useState<'items' | 'movements'>('items')
  const [isMounted, setIsMounted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [itemForm, setItemForm] = useState({
    name: '', sku: '', description: '', category: '', unit: 'pcs',
    cost_price: '', selling_price: '', current_stock: '', low_stock_threshold: '10',
  })
  const [moveForm, setMoveForm] = useState({
    item_id: '', type: 'purchase' as string, quantity: '', unit_price: '',
    reference: '', notes: '', create_transaction: false,
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

      const [itemsRes, summaryRes, movementsRes] = await Promise.all([
        fetch(`/api/inventory/items?businessId=${bId}${search ? `&search=${encodeURIComponent(search)}` : ''}${showLowStock ? '&lowStock=true' : ''}`, { headers }),
        fetch(`/api/inventory/summary?businessId=${bId}`, { headers }),
        fetch(`/api/inventory/movements?businessId=${bId}&limit=30`, { headers }),
      ])

      const itemsData = await itemsRes.json()
      const summaryData = await summaryRes.json()
      const movementsData = await movementsRes.json()

      setItems(itemsData.items || [])
      setSummary(summaryData)
      setMovements(movementsData.movements || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [activeBusiness, search, showLowStock])

  useEffect(() => { fetchData() }, [fetchData])

  const resetItemForm = () => setItemForm({ name: '', sku: '', description: '', category: '', unit: 'pcs', cost_price: '', selling_price: '', current_stock: '', low_stock_threshold: '10' })

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      const url = editingItem ? `/api/inventory/items/${editingItem.id}` : '/api/inventory/items'
      await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          business_id: activeBusiness?.id,
          name: itemForm.name,
          sku: itemForm.sku || null,
          description: itemForm.description || null,
          category: itemForm.category || null,
          unit: itemForm.unit,
          cost_price: parseFloat(itemForm.cost_price) || 0,
          selling_price: parseFloat(itemForm.selling_price) || 0,
          current_stock: parseFloat(itemForm.current_stock) || 0,
          low_stock_threshold: parseFloat(itemForm.low_stock_threshold) || 10,
        }),
      })
      setShowItemModal(false)
      setEditingItem(null)
      resetItemForm()
      fetchData()
    } catch (e) { console.error(e) }
    finally { setSubmitting(false) }
  }

  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const token = localStorage.getItem('moneylix_session_token') ?? ''
      await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          item_id: parseInt(moveForm.item_id),
          business_id: activeBusiness?.id,
          type: moveForm.type,
          quantity: parseFloat(moveForm.quantity) || 0,
          unit_price: parseFloat(moveForm.unit_price) || undefined,
          reference: moveForm.reference || null,
          notes: moveForm.notes || null,
          create_transaction: moveForm.create_transaction,
        }),
      })
      setShowMoveModal(false)
      setMoveForm({ item_id: '', type: 'purchase', quantity: '', unit_price: '', reference: '', notes: '', create_transaction: false })
      fetchData()
    } catch (e) { console.error(e) }
    finally { setSubmitting(false) }
  }

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item)
    setItemForm({
      name: item.name, sku: item.sku || '', description: item.description || '',
      category: item.category || '', unit: item.unit, cost_price: item.cost_price.toString(),
      selling_price: item.selling_price.toString(), current_stock: item.current_stock.toString(),
      low_stock_threshold: item.low_stock_threshold.toString(),
    })
    setShowItemModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('inventory.deleteConfirm'))) return
    const token = localStorage.getItem('moneylix_session_token') ?? ''
    await fetch(`/api/inventory/items/${id}`, {
      method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    fetchData()
  }

  const getStockColor = (item: InventoryItem) => {
    if (item.current_stock <= 0) return 'text-rose-700 bg-rose-50'
    if (item.current_stock <= item.low_stock_threshold) return 'text-amber-700 bg-amber-50'
    return 'text-lime-700 bg-lime-50'
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-bold text-neutral-900">{t('inventory.title')}</h1>
          <p className="text-[10px] text-neutral-400">{t('inventory.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowMoveModal(true)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition font-bold">
            <RefreshCw className="w-3 h-3" /> {t('inventory.recordMovement')}
          </button>
          <button onClick={() => { resetItemForm(); setEditingItem(null); setShowItemModal(true) }} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-lime-400 text-neutral-900 hover:bg-lime-300 transition font-bold">
            <Plus className="w-3 h-3" /> {t('inventory.addItem')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-50 text-blue-700">
            <Package className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-neutral-400">{t('inventory.totalItems')}</p>
              <p className="text-sm font-bold">{summary.total_items}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-lime-50 text-lime-700">
            <BarChart3 className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-neutral-400">{t('inventory.stockValue')}</p>
              <p className="text-sm font-bold font-mono">{fmt(summary.stock_value_selling)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 text-amber-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-neutral-400">{t('inventory.lowStock')}</p>
              <p className="text-sm font-bold">{summary.low_stock_count}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-rose-50 text-rose-700">
            <ShoppingCart className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-neutral-400">{t('inventory.outOfStock')}</p>
              <p className="text-sm font-bold">{summary.out_of_stock_count}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {(['items', 'movements'] as const).map(tb => (
            <button key={tb} onClick={() => setTab(tb)} className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition ${tab === tb ? 'bg-lime-100 text-lime-700' : 'bg-white text-neutral-400 hover:text-neutral-900'}`}>
              {tb === 'items' ? t('inventory.items') : t('inventory.movements')}
            </button>
          ))}
        </div>
        {tab === 'items' && (
          <>
            <div className="relative flex-1 min-w-[150px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`${t('common.search')} ${t('inventory.items').toLowerCase()}...`} className="w-full pl-7 pr-3 py-1.5 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
            </div>
            <button onClick={() => setShowLowStock(v => !v)} className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition ${showLowStock ? 'bg-amber-100 text-amber-700' : 'bg-white text-neutral-400 border border-neutral-200 hover:text-neutral-900'}`}>
              {t('inventory.lowStockOnly')}
            </button>
          </>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'items' ? (
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          {items.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-xs text-neutral-400">{t('inventory.noItemsYet')}</p>
              <button onClick={() => { resetItemForm(); setShowItemModal(true) }} className="mt-2 text-xs text-lime-700 font-semibold">{t('inventory.addFirstItem')}</button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:mx-0"><table className="w-full text-xs">
              <thead className="border-b border-black/5 bg-neutral-50">
                <tr>
                  {[t('inventory.itemCol'), t('inventory.sku'), t('budgets.category'), t('inventory.cost'), t('inventory.price'), t('inventory.stock'), t('inventory.value'), ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-neutral-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {items.map(item => {
                  const stockColor = getStockColor(item)
                  return (
                    <tr key={item.id} className="hover:bg-neutral-50 transition">
                      <td className="px-3 py-2 font-bold text-neutral-900">{item.name}</td>
                      <td className="px-3 py-2 font-mono text-neutral-500">{item.sku || '—'}</td>
                      <td className="px-3 py-2 text-neutral-500">{item.category || '—'}</td>
                      <td className="px-3 py-2 font-mono">{fmt(item.cost_price)}</td>
                      <td className="px-3 py-2 font-mono">{fmt(item.selling_price)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${stockColor}`}>
                          {item.current_stock} {item.unit}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono font-bold">{fmt(item.current_stock * item.selling_price)}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(item)} className="p-1 text-neutral-400 hover:text-blue-600 transition"><Edit2 className="w-3 h-3" /></button>
                          <button onClick={() => handleDelete(item.id)} className="p-1 text-neutral-400 hover:text-rose-600 transition"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          {movements.length === 0 ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-xs text-neutral-400">{t('inventory.noMovementsYet')}</p>
            </div>
          ) : (
            <div className="divide-y divide-black/5">
              {movements.map(m => {
                const cfg = movementTypeLabels[m.type] || movementTypeLabels.adjustment
                const Icon = cfg.icon
                return (
                  <div key={m.id} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cfg.cls}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-neutral-900">{m.item_name}</p>
                        <p className="text-[10px] text-neutral-400">{m.notes || cfg.label} &middot; {m.created_at?.split('T')[0]}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold font-mono">
                        {m.type === 'sale' ? '-' : '+'}{Math.abs(m.quantity)} {m.item_sku ? `(${m.item_sku})` : ''}
                      </p>
                      {m.total_amount ? <p className="text-[10px] text-neutral-400 font-mono">{fmt(m.total_amount)}</p> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Item Modal */}
      {showItemModal && isMounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowItemModal(false); setEditingItem(null) }} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-neutral-900">{editingItem ? t('inventory.editItem') : t('inventory.addItem')}</h2>
              <button onClick={() => { setShowItemModal(false); setEditingItem(null) }} className="p-1 text-neutral-400 hover:text-neutral-900"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleItemSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-medium text-neutral-500">{t('inventory.itemName')} *</label>
                <input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} required className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">{t('inventory.sku')}</label>
                  <input value={itemForm.sku} onChange={e => setItemForm(f => ({ ...f, sku: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">{t('budgets.category')}</label>
                  <input value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">{t('inventory.unit')}</label>
                  <select value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none">
                    {['pcs', 'kg', 'ltr', 'mtr', 'box', 'pack', 'set', 'pair'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">{t('inventory.costPrice')}</label>
                  <input type="number" step="0.01" value={itemForm.cost_price} onChange={e => setItemForm(f => ({ ...f, cost_price: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">{t('inventory.sellingPrice')}</label>
                  <input type="number" step="0.01" value={itemForm.selling_price} onChange={e => setItemForm(f => ({ ...f, selling_price: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">{t('inventory.initialStock')}</label>
                  <input type="number" step="0.01" value={itemForm.current_stock} onChange={e => setItemForm(f => ({ ...f, current_stock: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">{t('inventory.lowStockAlert')}</label>
                  <input type="number" step="0.01" value={itemForm.low_stock_threshold} onChange={e => setItemForm(f => ({ ...f, low_stock_threshold: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-neutral-500">{t('invoices.description')}</label>
                <textarea value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none resize-none" rows={2} />
              </div>
              <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-xl bg-lime-400 text-neutral-900 text-xs font-bold hover:bg-lime-300 transition disabled:opacity-50">
                {submitting ? t('inventory.saving') : (editingItem ? t('inventory.updateItem') : t('inventory.addItem'))}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Record Movement Modal */}
      {showMoveModal && isMounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMoveModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-neutral-900">{t('inventory.recordMovement')}</h2>
              <button onClick={() => setShowMoveModal(false)} className="p-1 text-neutral-400 hover:text-neutral-900"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleMoveSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-medium text-neutral-500">{t('inventory.itemCol')} *</label>
                <select value={moveForm.item_id} onChange={e => setMoveForm(f => ({ ...f, item_id: e.target.value }))} required className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none">
                  <option value="">{t('inventory.selectItem')}</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>{item.name} {item.sku ? `(${item.sku})` : ''} — {item.current_stock} {item.unit}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">{t('common.type')} *</label>
                  <select value={moveForm.type} onChange={e => setMoveForm(f => ({ ...f, type: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none">
                    <option value="purchase">{t('inventory.purchase')} ({t('inventory.stockIn')})</option>
                    <option value="sale">{t('inventory.sale')} ({t('inventory.stockOut')})</option>
                    <option value="adjustment">{t('inventory.adjustment')}</option>
                    <option value="return">{t('inventory.return')} ({t('inventory.stockIn')})</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">{t('invoices.quantity')} *</label>
                  <input type="number" step="0.01" value={moveForm.quantity} onChange={e => setMoveForm(f => ({ ...f, quantity: e.target.value }))} required className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">{t('inventory.unitPrice')}</label>
                  <input type="number" step="0.01" value={moveForm.unit_price} onChange={e => setMoveForm(f => ({ ...f, unit_price: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-neutral-500">{t('inventory.reference')}</label>
                  <input value={moveForm.reference} onChange={e => setMoveForm(f => ({ ...f, reference: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" placeholder="Invoice #..." />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-neutral-500">{t('common.notes')}</label>
                <input value={moveForm.notes} onChange={e => setMoveForm(f => ({ ...f, notes: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-lime-400 outline-none" />
              </div>
              <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer">
                <input type="checkbox" checked={moveForm.create_transaction} onChange={e => setMoveForm(f => ({ ...f, create_transaction: e.target.checked }))} className="rounded border-neutral-300 text-lime-500 focus:ring-lime-400" />
                {t('inventory.alsoCreateTransaction')}
              </label>
              <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-xl bg-lime-400 text-neutral-900 text-xs font-bold hover:bg-lime-300 transition disabled:opacity-50">
                {submitting ? t('inventory.recording') : t('inventory.recordMovement')}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
