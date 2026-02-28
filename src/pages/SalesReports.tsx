// ── Sales Reports ─────────────────────────────────────────────
import { useEffect, useState, useMemo } from 'react'
import {
  ShoppingCart, TrendingUp, DollarSign, Package,
  Calendar, ChevronLeft, ChevronRight, BarChart3,
  ArrowUpRight, ArrowDownRight, Users, FileText,
} from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Transaction, Product } from '@/types'
import { php } from '@/lib/utils'
import { StatCard, SkeletonRows } from '@/components/ui'

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface SaleRow extends Transaction {
  products?: { name: string; sku: string; unit: string; cost_price?: number; selling_price?: number } | null
}

function startOf(period: Period, date: Date): Date {
  const d = new Date(date)
  if (period === 'daily')   { d.setHours(0,0,0,0); return d }
  if (period === 'weekly')  { const day = d.getDay(); d.setDate(d.getDate() - day); d.setHours(0,0,0,0); return d }
  if (period === 'monthly') { d.setDate(1); d.setHours(0,0,0,0); return d }
  d.setMonth(0, 1); d.setHours(0,0,0,0); return d
}

function endOf(period: Period, date: Date): Date {
  const d = new Date(date)
  if (period === 'daily')   { d.setHours(23,59,59,999); return d }
  if (period === 'weekly')  { const day = d.getDay(); d.setDate(d.getDate() + (6 - day)); d.setHours(23,59,59,999); return d }
  if (period === 'monthly') { d.setMonth(d.getMonth()+1, 0); d.setHours(23,59,59,999); return d }
  d.setMonth(11, 31); d.setHours(23,59,59,999); return d
}

function shiftDate(period: Period, date: Date, dir: number): Date {
  const d = new Date(date)
  if (period === 'daily')   d.setDate(d.getDate() + dir)
  if (period === 'weekly')  d.setDate(d.getDate() + dir * 7)
  if (period === 'monthly') d.setMonth(d.getMonth() + dir)
  if (period === 'yearly')  d.setFullYear(d.getFullYear() + dir)
  return d
}

function formatPeriodLabel(period: Period, date: Date): string {
  if (period === 'daily')
    return date.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  if (period === 'weekly') {
    const start = startOf('weekly', date)
    const end   = endOf('weekly', date)
    return `${start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }
  if (period === 'monthly')
    return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long' })
  return date.getFullYear().toString()
}

function groupByLabel(period: Period, date: Date): string {
  if (period === 'daily')   return date.toLocaleTimeString('en-PH', { hour: '2-digit', hour12: true })
  if (period === 'weekly')  return date.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
  if (period === 'monthly') return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  return date.toLocaleDateString('en-PH', { month: 'short' })
}

function getGroupKey(period: Period, date: Date): string {
  if (period === 'daily')   return String(date.getHours())
  if (period === 'weekly')  return String(date.getDay())
  if (period === 'monthly') return String(date.getDate())
  return String(date.getMonth())
}

interface ChartBar { label: string; revenue: number; units: number; key: string }

function generateBars(period: Period, date: Date, rows: SaleRow[]): ChartBar[] {
  const map = new Map<string, ChartBar>()

  // Pre-populate all expected slots
  if (period === 'daily') {
    for (let h = 0; h < 24; h++) {
      const d = new Date(date); d.setHours(h, 0, 0, 0)
      map.set(String(h), { key: String(h), label: d.toLocaleTimeString('en-PH', { hour: '2-digit', hour12: true }), revenue: 0, units: 0 })
    }
  } else if (period === 'weekly') {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOf('weekly', date)); d.setDate(d.getDate() + i)
      map.set(String(i), { key: String(i), label: `${days[i]} ${d.getDate()}`, revenue: 0, units: 0 })
    }
  } else if (period === 'monthly') {
    const daysInMonth = new Date(date.getFullYear(), date.getMonth()+1, 0).getDate()
    for (let i = 1; i <= daysInMonth; i++) {
      map.set(String(i), { key: String(i), label: String(i), revenue: 0, units: 0 })
    }
  } else {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    for (let i = 0; i < 12; i++) {
      map.set(String(i), { key: String(i), label: months[i], revenue: 0, units: 0 })
    }
  }

  for (const tx of rows) {
    const d = new Date(tx.date_of_sale || tx.created_at)
    const k = getGroupKey(period, d)
    const bar = map.get(k)
    if (bar) {
      bar.units += tx.quantity
      bar.revenue += tx.quantity * (tx.products?.selling_price ?? 0)
    }
  }

  return Array.from(map.values())
}

export default function SalesReports() {
  const { user } = useAuth()
  const [period, setPeriod]   = useState<Period>('daily')
  const [anchor, setAnchor]   = useState(new Date())
  const [sales, setSales]     = useState<SaleRow[]>([])
  const [prods, setProds]     = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [prevSales, setPrevSales] = useState<SaleRow[]>([])

  // Fetch products for cost/selling price enrichment
  useEffect(() => {
    if (!user) return
    sb.from('products').select('*').eq('business_id', user.business_id).then(({ data }) => {
      setProds(data as Product[] ?? [])
    })
  }, [user])

  const prodMap = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of prods) m.set(p.id, p)
    return m
  }, [prods])

  // Fetch sales for current and previous period
  useEffect(() => {
    if (!user || !prodMap.size) return
    setLoading(true)

    const start = startOf(period, anchor).toISOString()
    const end   = endOf(period, anchor).toISOString()
    const prevAnchor = shiftDate(period, anchor, -1)
    const pStart = startOf(period, prevAnchor).toISOString()
    const pEnd   = endOf(period, prevAnchor).toISOString()

    Promise.all([
      sb.from('transactions')
        .select('*, products(name,sku,unit)')
        .eq('business_id', user.business_id)
        .eq('transaction_type', 'stock_out')
        .gte('created_at', start).lte('created_at', end)
        .order('created_at', { ascending: false }),
      sb.from('transactions')
        .select('*, products(name,sku,unit)')
        .eq('business_id', user.business_id)
        .eq('transaction_type', 'stock_out')
        .gte('created_at', pStart).lte('created_at', pEnd),
    ]).then(([cur, prev]) => {
      const enrich = (rows: any[]): SaleRow[] => rows.map(tx => ({
        ...tx,
        products: tx.products
          ? { ...tx.products, ...(prodMap.get(tx.product_id) ? { cost_price: prodMap.get(tx.product_id)!.cost_price, selling_price: prodMap.get(tx.product_id)!.selling_price } : {}) }
          : null,
      }))
      setSales(enrich(cur.data ?? []))
      setPrevSales(enrich(prev.data ?? []))
      setLoading(false)
    })
  }, [user, period, anchor, prodMap])

  // KPIs
  const totalUnits    = sales.reduce((s, tx) => s + tx.quantity, 0)
  const totalRevenue  = sales.reduce((s, tx) => s + tx.quantity * (tx.products?.selling_price ?? 0), 0)
  const totalCost     = sales.reduce((s, tx) => s + tx.quantity * (tx.products?.cost_price ?? 0), 0)
  const grossProfit   = totalRevenue - totalCost
  const margin        = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0'
  const uniqueCustomers = new Set(sales.filter(tx => tx.customer_name).map(tx => tx.customer_name)).size
  const txCount       = sales.length

  // Previous period KPIs
  const prevRevenue   = prevSales.reduce((s, tx) => s + tx.quantity * (tx.products?.selling_price ?? 0), 0)
  const prevUnits     = prevSales.reduce((s, tx) => s + tx.quantity, 0)
  const revGrowth     = prevRevenue > 0 ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : null
  const unitsGrowth   = prevUnits > 0 ? (((totalUnits - prevUnits) / prevUnits) * 100).toFixed(1) : null

  const bars = useMemo(() => generateBars(period, anchor, sales), [period, anchor, sales])
  const maxRevenue = Math.max(...bars.map(b => b.revenue), 1)

  // Top products
  const productMap = new Map<string, { name: string; sku: string; units: number; revenue: number; profit: number }>()
  for (const tx of sales) {
    const name = tx.products?.name ?? 'Unknown'
    const sku  = tx.products?.sku  ?? ''
    const rev  = tx.quantity * (tx.products?.selling_price ?? 0)
    const cost = tx.quantity * (tx.products?.cost_price ?? 0)
    const existing = productMap.get(tx.product_id)
    if (existing) { existing.units += tx.quantity; existing.revenue += rev; existing.profit += rev - cost }
    else productMap.set(tx.product_id, { name, sku, units: tx.quantity, revenue: rev, profit: rev - cost })
  }
  const topProducts = [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8)

  const GrowthBadge = ({ val }: { val: string | null }) => {
    if (!val) return null
    const n = parseFloat(val)
    const up = n >= 0
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 700, color: up ? 'var(--green)' : 'var(--red)', background: up ? 'var(--c-green-dim)' : 'var(--c-red-dim)', padding: '2px 7px', borderRadius: 20 }}>
        {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{Math.abs(n)}% vs prev
      </span>
    )
  }

  const PERIODS: { v: Period; l: string }[] = [
    { v: 'daily', l: 'Daily' }, { v: 'weekly', l: 'Weekly' },
    { v: 'monthly', l: 'Monthly' }, { v: 'yearly', l: 'Yearly' },
  ]

  return (
    <div className="anim-fade-up">
      {/* Header */}
      <div className="section-head" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="page-title">Sales Reports</h2>
          <p className="page-sub">Daily inventory sales monitoring & period comparison</p>
        </div>
      </div>

      {/* Period selector + navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
        {/* Period pills */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--c-bg2)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
          {PERIODS.map(({ v, l }) => (
            <button key={v} onClick={() => { setPeriod(v); setAnchor(new Date()) }}
              style={{
                padding: '6px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', border: 'none', fontFamily: 'var(--font)', transition: 'all .15s',
                background: period === v ? 'var(--c-white)' : 'transparent',
                color: period === v ? 'var(--ink)' : 'var(--c-text3)',
                boxShadow: period === v ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
              }}>
              {l}
            </button>
          ))}
        </div>

        {/* Date navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--c-white)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '5px 12px' }}>
          <button onClick={() => setAnchor(d => shiftDate(period, d, -1))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text2)', display: 'flex', alignItems: 'center', padding: 2, borderRadius: 5 }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Calendar size={14} style={{ color: 'var(--teal)' }} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
              {formatPeriodLabel(period, anchor)}
            </span>
          </div>
          <button
            onClick={() => setAnchor(d => shiftDate(period, d, 1))}
            disabled={shiftDate(period, anchor, 1) > new Date()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text2)', display: 'flex', alignItems: 'center', padding: 2, borderRadius: 5, opacity: shiftDate(period, anchor, 1) > new Date() ? 0.3 : 1 }}>
            <ChevronRight size={16} />
          </button>
        </div>

        <button onClick={() => setAnchor(new Date())}
          style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1.5px solid var(--border)', background: 'var(--c-white)', color: 'var(--c-text2)', fontFamily: 'var(--font)' }}>
          Today
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid-4 stagger" style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <StatCard label="Total Revenue" value={loading ? '—' : php(totalRevenue)}
            icon={<DollarSign size={22} />} color="var(--green)" bg="var(--c-green-dim)" accentColor="#10b981"
            sub={loading ? '' : <><GrowthBadge val={revGrowth} /></>} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <StatCard label="Units Sold" value={loading ? '—' : totalUnits.toLocaleString()}
            icon={<Package size={22} />} color="var(--teal)" bg="var(--c-teal-dim)" accentColor="#5b9490"
            sub={loading ? '' : <><GrowthBadge val={unitsGrowth} /></>} />
        </div>
        <StatCard label="Gross Profit" value={loading ? '—' : php(grossProfit)}
          icon={<TrendingUp size={22} />} color="var(--gold)" bg="var(--c-gold-dim)" accentColor="var(--gold)"
          sub={loading ? '' : `Margin: ${margin}%`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <StatCard label="Transactions" value={loading ? '—' : txCount}
            icon={<FileText size={22} />} color="#4e6b65" bg="#eff3f2" accentColor="#4e6b65"
            sub={loading ? '' : `${uniqueCustomers} unique customers`} />
        </div>
      </div>

      {/* Bar chart + Top Products */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18, marginBottom: 20 }}>
        {/* Revenue Bar Chart */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>Revenue Overview</h3>
              <p style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 2 }}>{formatPeriodLabel(period, anchor)}</p>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--c-text3)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: 'linear-gradient(135deg,#5b9490,#7cb8b4)' }} />Revenue
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text4)' }}>Loading…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: period === 'monthly' ? 3 : period === 'yearly' ? 12 : 6, height: 180, minWidth: period === 'monthly' ? 400 : 'auto', paddingBottom: 28, position: 'relative' }}>
                {/* Y-axis gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map(pct => (
                  <div key={pct} style={{ position: 'absolute', left: 0, right: 0, bottom: 28 + pct * 152, borderTop: `1px dashed var(--border)`, zIndex: 0 }}>
                    <span style={{ position: 'absolute', left: -2, top: -9, fontSize: 9.5, color: 'var(--c-text4)', transform: 'translateX(-100%)' }}>
                      {pct > 0 ? `${php(maxRevenue * pct).replace('₱', '₱')}` : '0'}
                    </span>
                  </div>
                ))}
                {bars.map((b) => {
                  const pct = maxRevenue > 0 ? b.revenue / maxRevenue : 0
                  const barH = Math.max(pct * 152, b.revenue > 0 ? 4 : 0)
                  return (
                    <div key={b.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: 1, minWidth: period === 'monthly' ? 10 : 'auto' }}
                      title={`${b.label}: ${php(b.revenue)} · ${b.units} units`}>
                      <div style={{
                        width: '100%', maxWidth: period === 'monthly' ? 14 : 28,
                        height: barH, borderRadius: '4px 4px 0 0',
                        background: b.revenue > 0 ? 'linear-gradient(180deg,#5b9490,#3d7874)' : 'var(--c-bg2)',
                        transition: 'height .4s ease',
                        cursor: 'pointer', position: 'relative',
                      }} />
                      {period !== 'monthly' && (
                        <span style={{ fontSize: 9.5, color: 'var(--c-text4)', whiteSpace: 'nowrap', transform: 'rotate(-30deg)', transformOrigin: 'top left', position: 'absolute', bottom: 2, lineHeight: 1 }}>
                          {b.label}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Summary row */}
          <div style={{ display: 'flex', gap: 20, paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 8 }}>
            {[
              { label: 'Peak', val: loading ? '—' : php(Math.max(...bars.map(b => b.revenue))) },
              { label: 'Avg / Slot', val: loading ? '—' : php(bars.filter(b => b.revenue > 0).reduce((s, b) => s + b.revenue, 0) / (bars.filter(b => b.revenue > 0).length || 1)) },
              { label: 'Active Periods', val: loading ? '—' : `${bars.filter(b => b.revenue > 0).length}` },
            ].map(({ label, val }) => (
              <div key={label}>
                <p style={{ fontSize: 10.5, color: 'var(--c-text4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</p>
                <p style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>Top Products</h3>
            <p style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 2 }}>By revenue this period</p>
          </div>
          {loading ? (
            <div style={{ color: 'var(--c-text4)', fontSize: 13 }}>Loading…</div>
          ) : topProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--c-text4)', fontSize: 13 }}>
              <ShoppingCart size={32} style={{ opacity: 0.25, marginBottom: 8 }} /><br />No sales this period
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topProducts.map((p, i) => {
                const maxR = topProducts[0].revenue
                const pct  = maxR > 0 ? Math.round((p.revenue / maxR) * 100) : 0
                return (
                  <div key={p.sku}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: i < 3 ? 'var(--gold)' : 'var(--c-text4)', width: 18, flexShrink: 0 }}>
                          {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'baseline' }}>
                        <span style={{ fontSize: 11.5, color: 'var(--c-text3)' }}>{p.units} units</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{php(p.revenue)}</span>
                      </div>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#5b9490,#7cb8b4)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sales transaction table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--c-teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={17} style={{ color: 'var(--teal)' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>Sales Transactions</h3>
              <p style={{ fontSize: 12, color: 'var(--c-text3)' }}>{txCount} records · {formatPeriodLabel(period, anchor)}</p>
            </div>
          </div>

          {/* Quick stats strip */}
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: 'Revenue', val: php(totalRevenue), color: 'var(--green)' },
              { label: 'Profit', val: php(grossProfit), color: 'var(--gold)' },
              { label: 'Margin', val: `${margin}%`, color: 'var(--teal)' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10.5, color: 'var(--c-text4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</p>
                <p style={{ fontSize: 15, fontWeight: 800, color, fontFamily: 'var(--font-head)' }}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Date of Sale</th>
                <th>Customer</th>
                <th>Voucher</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Revenue</th>
                <th>Cost</th>
                <th>Profit</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <SkeletonRows cols={10} rows={6} />
                : sales.length === 0
                  ? (
                    <tr>
                      <td colSpan={10}>
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--c-text4)' }}>
                          <ShoppingCart size={36} style={{ opacity: 0.2, marginBottom: 10 }} />
                          <p style={{ fontSize: 14, fontWeight: 600 }}>No sales recorded for this period</p>
                          <p style={{ fontSize: 12, marginTop: 4 }}>Adjust the date range or record stock-out transactions</p>
                        </div>
                      </td>
                    </tr>
                  )
                  : sales.map(tx => {
                    const sp  = tx.products?.selling_price ?? 0
                    const cp  = tx.products?.cost_price ?? 0
                    const rev = tx.quantity * sp
                    const cst = tx.quantity * cp
                    const pft = rev - cst
                    return (
                      <tr key={tx.id}>
                        <td>
                          <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13.5 }}>{tx.products?.name ?? '—'}</p>
                          <p style={{ fontSize: 11.5, color: 'var(--c-text3)', fontFamily: 'var(--mono)' }}>{tx.products?.sku}</p>
                        </td>
                        <td style={{ fontSize: 12.5, color: 'var(--c-text2)', whiteSpace: 'nowrap' }}>
                          {tx.date_of_sale
                            ? new Date(tx.date_of_sale).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                            : new Date(tx.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td>
                          {tx.customer_name
                            ? <div>
                                <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{tx.customer_name}</p>
                                {tx.customer_phone && <p style={{ fontSize: 11.5, color: 'var(--c-text3)' }}>{tx.customer_phone}</p>}
                              </div>
                            : <span style={{ color: 'var(--c-text4)' }}>Walk-in</span>}
                        </td>
                        <td>
                          {tx.voucher_number
                            ? <span className="mono badge badge-navy" style={{ fontSize: 11.5 }}>{tx.voucher_number}</span>
                            : <span style={{ color: 'var(--c-text4)' }}>—</span>}
                        </td>
                        <td style={{ fontWeight: 700 }}>
                          {tx.quantity} <span style={{ fontSize: 12, color: 'var(--c-text3)', fontWeight: 500 }}>{tx.products?.unit}</span>
                        </td>
                        <td style={{ fontSize: 13 }}>{php(sp)}</td>
                        <td style={{ fontWeight: 800, color: 'var(--green)', fontSize: 14, fontFamily: 'var(--font-head)' }}>{php(rev)}</td>
                        <td style={{ fontSize: 13, color: 'var(--c-text2)' }}>{php(cst)}</td>
                        <td style={{ fontWeight: 700, color: pft >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>{php(pft)}</td>
                        <td style={{ fontSize: 13, color: 'var(--c-text3)' }}>{tx.users?.full_name ?? '—'}</td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
