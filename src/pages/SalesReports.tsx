// ── Sales Reports ─────────────────────────────────────────────
import { useEffect, useState, useMemo } from 'react'
import {
  ShoppingCart, TrendingUp, DollarSign, Package,
  Calendar, ChevronLeft, ChevronRight, BarChart3,
  ArrowUpRight, ArrowDownRight, Users, FileText,
  CreditCard, AlertCircle, MapPin,
} from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Transaction, Product, PAYMENT_METHOD_LABEL, PaymentMethod } from '@/types'
import { php } from '@/lib/utils'
import { StatCard, SkeletonRows } from '@/components/ui'

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface SaleRow extends Transaction {
  products?: { name: string; sku: string; unit: string; cost_price?: number; selling_price?: number } | null
}

function money(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n)
}
function moneyFull(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

function startOf(period: Period, date: Date): Date {
  const d = new Date(date)
  if (period === 'daily')   { d.setHours(0,0,0,0); return d }
  if (period === 'weekly')  { d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d }
  if (period === 'monthly') { d.setDate(1); d.setHours(0,0,0,0); return d }
  d.setMonth(0,1); d.setHours(0,0,0,0); return d
}
function endOf(period: Period, date: Date): Date {
  const d = new Date(date)
  if (period === 'daily')   { d.setHours(23,59,59,999); return d }
  if (period === 'weekly')  { d.setDate(d.getDate() + (6 - d.getDay())); d.setHours(23,59,59,999); return d }
  if (period === 'monthly') { d.setMonth(d.getMonth()+1,0); d.setHours(23,59,59,999); return d }
  d.setMonth(11,31); d.setHours(23,59,59,999); return d
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
    const start = startOf('weekly', date), end = endOf('weekly', date)
    return `${start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }
  if (period === 'monthly')
    return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long' })
  return date.getFullYear().toString()
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
  if (period === 'daily') {
    for (let h = 0; h < 24; h++) {
      const d = new Date(date); d.setHours(h,0,0,0)
      map.set(String(h), { key: String(h), label: d.toLocaleTimeString('en-PH', { hour: '2-digit', hour12: true }), revenue: 0, units: 0 })
    }
  } else if (period === 'weekly') {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOf('weekly', date)); d.setDate(d.getDate() + i)
      map.set(String(i), { key: String(i), label: `${days[i]} ${d.getDate()}`, revenue: 0, units: 0 })
    }
  } else if (period === 'monthly') {
    const days = new Date(date.getFullYear(), date.getMonth()+1, 0).getDate()
    for (let i = 1; i <= days; i++) map.set(String(i), { key: String(i), label: String(i), revenue: 0, units: 0 })
  } else {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    for (let i = 0; i < 12; i++) map.set(String(i), { key: String(i), label: months[i], revenue: 0, units: 0 })
  }
  for (const tx of rows) {
    const d = new Date(tx.date_of_sale || tx.created_at)
    const k = getGroupKey(period, d)
    const bar = map.get(k)
    if (bar) { bar.units += tx.quantity; bar.revenue += tx.quantity * (tx.products?.selling_price ?? 0) }
  }
  return Array.from(map.values())
}

export default function SalesReports() {
  const { user } = useAuth()
  const [period, setPeriod]     = useState<Period>('monthly')
  const [anchor, setAnchor]     = useState(new Date())
  const [sales, setSales]       = useState<SaleRow[]>([])
  const [prods, setProds]       = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [prevSales, setPrevSales] = useState<SaleRow[]>([])
  const isWellprintOrTC = user?.business_id === 'wellprint' || user?.business_id === 'tcchemical'

  useEffect(() => {
    if (!user) return
    sb.from('products').select('*').eq('business_id', user.business_id).then(({ data }) => setProds(data as Product[] ?? []))
  }, [user])

  const prodMap = useMemo(() => { const m = new Map<string, Product>(); for (const p of prods) m.set(p.id, p); return m }, [prods])

  useEffect(() => {
    if (!user || !prodMap.size) return
    setLoading(true)
    const start = startOf(period, anchor).toISOString(), end = endOf(period, anchor).toISOString()
    const prev  = shiftDate(period, anchor, -1)
    const pStart = startOf(period, prev).toISOString(), pEnd = endOf(period, prev).toISOString()

    Promise.all([
      sb.from('transactions').select('*, products(name,sku,unit), users(full_name,username)')
        .eq('business_id', user.business_id).eq('transaction_type', 'stock_out')
        .gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }),
      sb.from('transactions').select('*, products(name,sku,unit)')
        .eq('business_id', user.business_id).eq('transaction_type', 'stock_out')
        .gte('created_at', pStart).lte('created_at', pEnd),
    ]).then(([cur, prev]) => {
      const enrich = (rows: any[]): SaleRow[] => rows.map(tx => ({
        ...tx,
        products: tx.products ? { ...tx.products, ...(prodMap.get(tx.product_id) ? { cost_price: prodMap.get(tx.product_id)!.cost_price, selling_price: prodMap.get(tx.product_id)!.selling_price } : {}) } : null,
      }))
      setSales(enrich(cur.data ?? []))
      setPrevSales(enrich(prev.data ?? []))
      setLoading(false)
    })
  }, [user, period, anchor, prodMap])

  // KPIs
  const totalUnits      = sales.reduce((s, tx) => s + tx.quantity, 0)
  const totalRevenue    = sales.reduce((s, tx) => s + tx.quantity * (tx.products?.selling_price ?? 0), 0)
  const totalCost       = sales.reduce((s, tx) => s + tx.quantity * (tx.products?.cost_price ?? 0), 0)
  const grossProfit     = totalRevenue - totalCost
  const margin          = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0'
  const uniqueCustomers = new Set(sales.filter(tx => tx.customer_name).map(tx => tx.customer_name)).size
  const txCount         = sales.length
  const avgOrderValue   = txCount > 0 ? totalRevenue / txCount : 0

  // Growth vs prev period
  const prevRevenue = prevSales.reduce((s, tx) => s + tx.quantity * (tx.products?.selling_price ?? 0), 0)
  const prevUnits   = prevSales.reduce((s, tx) => s + tx.quantity, 0)
  const revGrowth   = prevRevenue > 0 ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : null
  const unitsGrowth = prevUnits > 0 ? (((totalUnits - prevUnits) / prevUnits) * 100).toFixed(1) : null

  // Chart bars
  const bars = useMemo(() => generateBars(period, anchor, sales), [period, anchor, sales])
  const maxRevenue = Math.max(...bars.map(b => b.revenue), 1)

  // Top products
  const productMap = new Map<string, { name: string; sku: string; units: number; revenue: number; profit: number }>()
  for (const tx of sales) {
    const rev = tx.quantity * (tx.products?.selling_price ?? 0)
    const cst = tx.quantity * (tx.products?.cost_price ?? 0)
    const e = productMap.get(tx.product_id)
    if (e) { e.units += tx.quantity; e.revenue += rev; e.profit += rev - cst }
    else productMap.set(tx.product_id, { name: tx.products?.name ?? 'Unknown', sku: tx.products?.sku ?? '', units: tx.quantity, revenue: rev, profit: rev - cst })
  }
  const topProducts = [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8)

  // Top customers
  const custMap = new Map<string, { name: string; phone: string | null; revenue: number; txCount: number; outstanding: number }>()
  for (const tx of sales) {
    if (!tx.customer_name) continue
    const rev = tx.quantity * (tx.products?.selling_price ?? 0)
    const e = custMap.get(tx.customer_name)
    if (e) { e.revenue += rev; e.txCount++ }
    else custMap.set(tx.customer_name, { name: tx.customer_name, phone: tx.customer_phone ?? null, revenue: rev, txCount: 1, outstanding: 0 })
  }
  const topCustomers = [...custMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6)

  // Payment method breakdown (wellprint/tcchemical)
  const payMethodMap = new Map<string, { count: number; revenue: number }>()
  if (isWellprintOrTC) {
    for (const tx of sales) {
      const method = tx.payment_method ?? 'unrecorded'
      const rev = tx.quantity * (tx.products?.selling_price ?? 0)
      const e = payMethodMap.get(method)
      if (e) { e.count++; e.revenue += rev }
      else payMethodMap.set(method, { count: 1, revenue: rev })
    }
  }
  const payMethods = [...payMethodMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue)

  // Outstanding collectibles summary (wellprint/tcchemical)
  const [outstandingTotal, setOutstandingTotal] = useState(0)
  useEffect(() => {
    if (!user || !isWellprintOrTC) return
    sb.from('transactions').select('reference_number, amount_paid, quantity, products(selling_price)')
      .eq('business_id', user.business_id).eq('transaction_type', 'stock_out')
      .not('reference_number', 'is', null)
      .then(({ data }) => {
        const rows = data ?? []
        const refMap = new Map<string, { total: number; paid: number | null }>()
        for (const r of rows as any[]) {
          const ref = r.reference_number as string
          if (!refMap.has(ref)) refMap.set(ref, { total: 0, paid: r.amount_paid ?? null })
          const e = refMap.get(ref)!
          e.total += (r.products?.selling_price ?? 0) * r.quantity
          if (e.paid === null && r.amount_paid !== null) e.paid = r.amount_paid
        }
        let outs = 0
        for (const [, v] of refMap) {
          if (v.paid !== null) outs += Math.max(0, v.total - v.paid)
          else outs += v.total
        }
        setOutstandingTotal(outs)
      })
  }, [user, isWellprintOrTC])

  const GrowthBadge = ({ val }: { val: string | null }) => {
    if (!val) return null
    const n = parseFloat(val), up = n >= 0
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
      <div className="section-head" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="page-title">Sales Reports</h2>
          <p className="page-sub">Period sales monitoring, trends & customer insights</p>
        </div>
      </div>

      {/* Period selector + navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
          {PERIODS.map(({ v, l }) => (
            <button key={v} onClick={() => { setPeriod(v); setAnchor(new Date()) }}
              style={{ padding: '6px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'var(--font)', transition: 'all .15s', background: period === v ? 'var(--c-white)' : 'transparent', color: period === v ? 'var(--ink)' : 'var(--c-text3)', boxShadow: period === v ? '0 1px 4px rgba(0,0,0,0.10)' : 'none' }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--c-white)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '5px 12px' }}>
          <button onClick={() => setAnchor(d => shiftDate(period, d, -1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text2)', display: 'flex', padding: 2, borderRadius: 5 }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Calendar size={14} style={{ color: 'var(--teal)' }} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{formatPeriodLabel(period, anchor)}</span>
          </div>
          <button onClick={() => setAnchor(d => shiftDate(period, d, 1))} disabled={shiftDate(period, anchor, 1) > new Date()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text2)', display: 'flex', padding: 2, borderRadius: 5, opacity: shiftDate(period, anchor, 1) > new Date() ? 0.3 : 1 }}>
            <ChevronRight size={16} />
          </button>
        </div>
        <button onClick={() => setAnchor(new Date())} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1.5px solid var(--border)', background: 'var(--c-white)', color: 'var(--c-text2)', fontFamily: 'var(--font)' }}>
          Today
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
        <StatCard label="Total Revenue"   value={loading ? '—' : money(totalRevenue)}
          icon={<DollarSign size={22} />} color="var(--green)" bg="var(--c-green-dim)" accentColor="#10b981"
          sub={<GrowthBadge val={revGrowth} />} />
        <StatCard label="Units Sold"      value={loading ? '—' : totalUnits.toLocaleString()}
          icon={<Package size={22} />}    color="var(--teal)"  bg="var(--c-teal-dim)"  accentColor="#5b9490"
          sub={<GrowthBadge val={unitsGrowth} />} />
        <StatCard label="Gross Profit"    value={loading ? '—' : money(grossProfit)}
          icon={<TrendingUp size={22} />} color="var(--gold)"  bg="var(--c-gold-dim)"  accentColor="var(--gold)"
          sub={loading ? '' : `Margin: ${margin}%`} />
        <StatCard label="Transactions"    value={loading ? '—' : txCount}
          icon={<FileText size={22} />}   color="#4e6b65"       bg="#eff3f2"             accentColor="#4e6b65"
          sub={loading ? '' : `${uniqueCustomers} customers`} />
        <StatCard label="Avg Order Value" value={loading ? '—' : money(avgOrderValue)}
          icon={<ShoppingCart size={22} />} color="#6366f1"    bg="#eef2ff"             accentColor="#6366f1"
          sub="per transaction" />
        {isWellprintOrTC && (
          <StatCard label="Outstanding"   value={loading ? '—' : money(outstandingTotal)}
            icon={<AlertCircle size={22} />} color="#d97706"   bg="#fef3c7"             accentColor="#d97706"
            sub="uncollected balance" />
        )}
      </div>

      {/* Chart + Top Products */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18, marginBottom: 20 }}>

        {/* Revenue Bar Chart */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>Revenue Overview</h3>
              <p style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 2 }}>{formatPeriodLabel(period, anchor)}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Peak</p>
              <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--teal)' }}>{loading ? '—' : money(Math.max(...bars.map(b => b.revenue)))}</p>
            </div>
          </div>
          {loading ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text4)' }}>Loading…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: period === 'monthly' ? 3 : 8, height: 180, minWidth: period === 'monthly' ? 400 : 'auto', paddingBottom: 28, position: 'relative' }}>
                {[0, 0.25, 0.5, 0.75, 1].map(pct => (
                  <div key={pct} style={{ position: 'absolute', left: 0, right: 0, bottom: 28 + pct * 152, borderTop: '1px dashed var(--border)', zIndex: 0 }}>
                    <span style={{ position: 'absolute', left: -2, top: -9, fontSize: 9.5, color: 'var(--c-text4)', transform: 'translateX(-100%)' }}>
                      {pct > 0 ? money(maxRevenue * pct) : '0'}
                    </span>
                  </div>
                ))}
                {bars.map(b => {
                  const pct = maxRevenue > 0 ? b.revenue / maxRevenue : 0
                  const barH = Math.max(pct * 152, b.revenue > 0 ? 4 : 0)
                  return (
                    <div key={b.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, minWidth: period === 'monthly' ? 10 : 'auto', position: 'relative' }}
                      title={`${b.label}: ${moneyFull(b.revenue)} · ${b.units} units`}>
                      <div style={{ width: '100%', maxWidth: period === 'monthly' ? 14 : 32, height: barH, borderRadius: '4px 4px 0 0', background: b.revenue > 0 ? 'linear-gradient(180deg,#5b9490,#3d7874)' : 'var(--bg)', transition: 'height .4s ease', cursor: 'pointer' }} />
                      {period !== 'monthly' && (
                        <span style={{ fontSize: 9.5, color: 'var(--c-text4)', whiteSpace: 'nowrap', transform: 'rotate(-30deg)', transformOrigin: 'top left', position: 'absolute', bottom: 2, lineHeight: 1 }}>{b.label}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 24, paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Revenue',    val: money(totalRevenue) },
              { label: 'Avg / Active Slot', val: money(bars.filter(b => b.revenue > 0).reduce((s, b) => s + b.revenue, 0) / (bars.filter(b => b.revenue > 0).length || 1)) },
              { label: 'Active Periods',   val: `${bars.filter(b => b.revenue > 0).length}` },
            ].map(({ label, val }) => (
              <div key={label}>
                <p style={{ fontSize: 10.5, color: 'var(--c-text4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</p>
                <p style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' }}>{loading ? '—' : val}</p>
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
          {loading ? <div style={{ color: 'var(--c-text4)', fontSize: 13 }}>Loading…</div>
            : topProducts.length === 0
              ? <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--c-text4)', fontSize: 13 }}>
                  <ShoppingCart size={32} style={{ opacity: 0.2, marginBottom: 8 }} /><br />No sales this period
                </div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topProducts.map((p, i) => {
                  const pct = topProducts[0].revenue > 0 ? Math.round((p.revenue / topProducts[0].revenue) * 100) : 0
                  return (
                    <div key={p.sku}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: i < 3 ? 'var(--gold)' : 'var(--c-text4)', width: 20, flexShrink: 0 }}>
                            {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                            <p style={{ fontSize: 10.5, color: 'var(--c-text4)', fontFamily: 'var(--mono)' }}>{p.units} units</p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--green)' }}>{money(p.revenue)}</p>
                          <p style={{ fontSize: 10.5, color: p.profit >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{money(p.profit)} profit</p>
                        </div>
                      </div>
                      <div style={{ height: 4, borderRadius: 99, background: 'var(--bg)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#5b9490,#7cb8b4)', borderRadius: 99 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
          }
        </div>
      </div>

      {/* Row 3: Top Customers + Payment Methods */}
      <div style={{ display: 'grid', gridTemplateColumns: isWellprintOrTC ? '1fr 1fr' : '1fr', gap: 18, marginBottom: 20 }}>

        {/* Top Customers */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--c-teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} style={{ color: 'var(--teal)' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>Top Customers</h3>
              <p style={{ fontSize: 12, color: 'var(--c-text3)' }}>By revenue this period</p>
            </div>
          </div>
          {loading ? <SkeletonRows cols={3} rows={5} />
            : topCustomers.length === 0
              ? <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--c-text4)', fontSize: 13 }}>No customer data this period</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topCustomers.map((c, i) => {
                  const pct = topCustomers[0].revenue > 0 ? Math.round((c.revenue / topCustomers[0].revenue) * 100) : 0
                  return (
                    <div key={c.name} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--c-teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--teal)', flexShrink: 0 }}>
                            {i < 3 ? ['🥇','🥈','🥉'][i] : c.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{c.name}</p>
                            {c.phone && <p style={{ fontSize: 11, color: 'var(--c-text4)' }}>{c.phone}</p>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--teal)' }}>{money(c.revenue)}</p>
                          <p style={{ fontSize: 11, color: 'var(--c-text4)' }}>{c.txCount} orders</p>
                        </div>
                      </div>
                      <div style={{ height: 4, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--teal)', borderRadius: 99 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
          }
        </div>

        {/* Payment Method Breakdown — WellPrint / TC Chemical only */}
        {isWellprintOrTC && (
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: '#eff3f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={16} style={{ color: '#4e6b65' }} />
              </div>
              <div>
                <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>Payment Methods</h3>
                <p style={{ fontSize: 12, color: 'var(--c-text3)' }}>How customers paid this period</p>
              </div>
            </div>
            {loading ? <SkeletonRows cols={2} rows={4} />
              : payMethods.length === 0
                ? <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--c-text4)', fontSize: 13 }}>No payment data this period</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {payMethods.map(([method, data], i) => {
                    const label = method === 'unrecorded' ? 'Not Recorded' : PAYMENT_METHOD_LABEL[method as PaymentMethod] ?? method
                    const pct = payMethods[0][1].revenue > 0 ? Math.round((data.revenue / payMethods[0][1].revenue) * 100) : 0
                    const colors = ['var(--teal)', '#4e6b65', '#d4a017', '#10b981', '#6366f1', '#f59e0b']
                    return (
                      <div key={method} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length] }} />
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{label}</span>
                            <span style={{ fontSize: 11.5, color: 'var(--c-text4)' }}>{data.count} txn{data.count !== 1 ? 's' : ''}</span>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 800, color: colors[i % colors.length] }}>{money(data.revenue)}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: colors[i % colors.length], borderRadius: 99 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        )}
      </div>

      {/* Sales transaction table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--c-teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={17} style={{ color: 'var(--teal)' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>Sales Transactions</h3>
              <p style={{ fontSize: 12, color: 'var(--c-text3)' }}>{txCount} records · {formatPeriodLabel(period, anchor)}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: 'Revenue', val: money(totalRevenue), color: 'var(--green)' },
              { label: 'Profit',  val: money(grossProfit),  color: 'var(--gold)'  },
              { label: 'Margin',  val: `${margin}%`,        color: 'var(--teal)'  },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10.5, color: 'var(--c-text4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</p>
                <p style={{ fontSize: 15, fontWeight: 800, color }}>{loading ? '—' : val}</p>
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
                <th>Ref #</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Revenue</th>
                <th>Cost</th>
                <th>Profit</th>
                {isWellprintOrTC && <th>Payment</th>}
                {isWellprintOrTC && <th>Outstanding</th>}
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <SkeletonRows cols={isWellprintOrTC ? 12 : 10} rows={6} />
                : sales.length === 0
                  ? (
                    <tr><td colSpan={isWellprintOrTC ? 12 : 10}>
                      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--c-text4)' }}>
                        <ShoppingCart size={36} style={{ opacity: 0.2, marginBottom: 10 }} />
                        <p style={{ fontSize: 14, fontWeight: 600 }}>No sales this period</p>
                        <p style={{ fontSize: 12, marginTop: 4 }}>Adjust the date range or record stock-out transactions</p>
                      </div>
                    </td></tr>
                  )
                  : sales.map(tx => {
                    const sp  = tx.products?.selling_price ?? 0
                    const cp  = tx.products?.cost_price ?? 0
                    const rev = tx.quantity * sp
                    const cst = tx.quantity * cp
                    const pft = rev - cst
                    const outstanding = isWellprintOrTC && tx.amount_paid !== null ? Math.max(0, rev - (tx.amount_paid ?? 0)) : null
                    return (
                      <tr key={tx.id}>
                        <td>
                          <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13.5 }}>{tx.products?.name ?? '—'}</p>
                          <p style={{ fontSize: 11, color: 'var(--c-text4)', fontFamily: 'var(--mono)' }}>{tx.products?.sku}</p>
                        </td>
                        <td style={{ fontSize: 12.5, color: 'var(--c-text2)', whiteSpace: 'nowrap' }}>
                          {new Date(tx.date_of_sale || tx.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
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
                          {tx.reference_number
                            ? <span className="mono badge badge-navy" style={{ fontSize: 11 }}>{tx.reference_number}</span>
                            : <span style={{ color: 'var(--c-text4)' }}>—</span>}
                        </td>
                        <td style={{ fontWeight: 700 }}>{tx.quantity} <span style={{ fontSize: 11, color: 'var(--c-text3)', fontWeight: 500 }}>{tx.products?.unit}</span></td>
                        <td style={{ fontSize: 13 }}>{moneyFull(sp)}</td>
                        <td style={{ fontWeight: 800, color: 'var(--green)', fontSize: 14 }}>{moneyFull(rev)}</td>
                        <td style={{ fontSize: 13, color: 'var(--c-text2)' }}>{moneyFull(cst)}</td>
                        <td style={{ fontWeight: 700, color: pft >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>{moneyFull(pft)}</td>
                        {isWellprintOrTC && (
                          <td style={{ fontSize: 12.5 }}>
                            {tx.payment_method
                              ? <span style={{ fontSize: 11.5, fontWeight: 700, background: 'var(--c-teal-dim)', color: 'var(--teal)', borderRadius: 5, padding: '2px 7px', display: 'inline-block' }}>
                                  {PAYMENT_METHOD_LABEL[tx.payment_method as PaymentMethod]}
                                </span>
                              : <span style={{ color: 'var(--c-text4)' }}>—</span>}
                            {tx.payment_reference && <p style={{ fontSize: 10.5, color: 'var(--c-text4)', fontFamily: 'var(--mono)', marginTop: 2 }}>{tx.payment_reference}</p>}
                          </td>
                        )}
                        {isWellprintOrTC && (
                          <td>
                            {outstanding !== null && outstanding > 0
                              ? <span style={{ fontSize: 13, fontWeight: 900, color: '#d97706' }}>{moneyFull(outstanding)}</span>
                              : tx.amount_paid !== null
                                ? <span style={{ fontSize: 11.5, fontWeight: 700, color: '#16a34a' }}>✓ Paid</span>
                                : <span style={{ color: 'var(--c-text4)' }}>—</span>}
                          </td>
                        )}
                        <td style={{ fontSize: 13, color: 'var(--c-text3)' }}>{(tx as any).users?.full_name ?? '—'}</td>
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
