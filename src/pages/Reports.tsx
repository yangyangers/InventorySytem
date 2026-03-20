import { useEffect, useState } from 'react'
import {
  Package, DollarSign, TrendingUp, BarChart3,
  ArrowUpRight, ArrowDownRight, Layers, AlertTriangle,
  Tag, Truck, Activity,
} from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Product } from '@/types'
import { php } from '@/lib/utils'
import { StatCard, SkeletonRows } from '@/components/ui'

function money(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n)
}

export default function Reports() {
  const { user } = useAuth()
  const [prods, setProds]     = useState<Product[]>([])
  const [txData, setTxData]   = useState({ in: 0, out: 0, adj: 0, total: 0, recentIn: 0, recentOut: 0 })
  const [catData, setCatData] = useState<{ name: string; count: number; value: number }[]>([])
  const [supData, setSupData] = useState<{ name: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      sb.from('products').select('*, categories(name), suppliers(name)').eq('business_id', user.business_id).eq('is_active', true),
      sb.from('transactions').select('transaction_type, quantity, created_at').eq('business_id', user.business_id),
    ]).then(([p, t]) => {
      const products = p.data as Product[] ?? []
      setProds(products)

      const rows = t.data ?? []
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const recent = rows.filter((r: any) => r.created_at >= thirtyDaysAgo)

      setTxData({
        in:    rows.filter((r: any) => r.transaction_type === 'stock_in').reduce((s: number, r: any) => s + r.quantity, 0),
        out:   rows.filter((r: any) => r.transaction_type === 'stock_out').reduce((s: number, r: any) => s + r.quantity, 0),
        adj:   rows.filter((r: any) => r.transaction_type === 'adjustment').length,
        total: rows.length,
        recentIn:  recent.filter((r: any) => r.transaction_type === 'stock_in').reduce((s: number, r: any) => s + r.quantity, 0),
        recentOut: recent.filter((r: any) => r.transaction_type === 'stock_out').reduce((s: number, r: any) => s + r.quantity, 0),
      })

      // Category breakdown
      const catMap = new Map<string, { count: number; value: number }>()
      for (const prod of products) {
        const cat = (prod as any).categories?.name ?? 'Uncategorized'
        const val = prod.quantity * prod.cost_price
        const e = catMap.get(cat) ?? { count: 0, value: 0 }
        e.count++; e.value += val
        catMap.set(cat, e)
      }
      setCatData(Array.from(catMap.entries()).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.value - a.value).slice(0, 8))

      // Supplier breakdown
      const supMap = new Map<string, number>()
      for (const prod of products) {
        const sup = (prod as any).suppliers?.name ?? 'No Supplier'
        supMap.set(sup, (supMap.get(sup) ?? 0) + 1)
      }
      setSupData(Array.from(supMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6))

      setLoading(false)
    })
  }, [user])

  const cost    = prods.reduce((s, p) => s + p.quantity * p.cost_price, 0)
  const retail  = prods.reduce((s, p) => s + p.quantity * p.selling_price, 0)
  const profit  = retail - cost
  const margin  = retail > 0 ? ((profit / retail) * 100).toFixed(1) : '0.0'
  const healthy = prods.filter(p => p.quantity > p.reorder_level)
  const low     = prods.filter(p => p.quantity > 0 && p.quantity <= p.reorder_level)
  const out     = prods.filter(p => p.quantity === 0)
  const top10   = [...prods].sort((a, b) => (b.quantity * b.cost_price) - (a.quantity * a.cost_price)).slice(0, 10)
  const maxVal  = top10[0] ? top10[0].quantity * top10[0].cost_price : 1
  const turnover = txData.in > 0 ? ((txData.out / txData.in) * 100).toFixed(0) : '0'
  const CAT_COLORS = ['#5b9490','#4e6b65','#d4a017','#10b981','#f59e0b','#6366f1','#ec4899','#ef4444']

  return (
    <div className="anim-fade-up">
      <div className="section-head">
        <div>
          <h2 className="page-title">Reports & Analytics</h2>
          <p className="page-sub">Inventory performance overview · live data</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid-4 stagger" style={{ marginBottom: 22 }}>
        <StatCard label="Active Products"  value={loading ? '—' : prods.length}
          icon={<Package size={22} />}    color="#4e6b65"      bg="#eff3f2"           accentColor="#4e6b65"
          sub={loading ? '' : `${out.length} out of stock · ${low.length} low`} />
        <StatCard label="Inventory Cost"   value={loading ? '—' : money(cost)}
          icon={<DollarSign size={22} />} color="var(--green)" bg="var(--c-green-dim)" accentColor="#10b981"
          sub="at cost price" />
        <StatCard label="Retail Value"     value={loading ? '—' : money(retail)}
          icon={<TrendingUp size={22} />} color="var(--teal)"  bg="var(--c-teal-dim)"  accentColor="#5b9490"
          sub="at selling price" />
        <StatCard label="Gross Margin"     value={loading ? '—' : `${margin}%`}
          icon={<BarChart3 size={22} />}  color="var(--gold)"  bg="var(--c-gold-dim)"  accentColor="var(--gold)"
          sub={loading ? '' : `${money(profit)} potential profit`} />
      </div>

      {/* Row 2: Transactions + Stock Health */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 18, marginBottom: 20 }}>

        {/* Transaction breakdown */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--c-teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={16} style={{ color: 'var(--teal)' }} />
              </div>
              <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>Transaction Breakdown</h3>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Units Received',   val: txData.in,  recent: txData.recentIn,  sign: '+', color: 'var(--green)', bg: '#f0fdf4', border: '#bbf7d0', Icon: ArrowUpRight },
              { label: 'Units Dispatched', val: txData.out, recent: txData.recentOut, sign: '−', color: 'var(--red)',   bg: '#fff1f2', border: '#fecdd3', Icon: ArrowDownRight },
              { label: 'Adjustments',      val: txData.adj, recent: 0,               sign: '⊙', color: 'var(--teal)', bg: 'var(--c-teal-dim)', border: 'rgba(91,148,144,.3)', Icon: Layers },
            ].map(({ label, val, recent, sign, color, bg, border, Icon }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 12, background: bg, border: `1.5px solid ${border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--c-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.06)' }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13.5, color: 'var(--c-text2)', fontWeight: 600 }}>{label}</p>
                    {recent > 0 && <p style={{ fontSize: 11, color, fontWeight: 600, marginTop: 1 }}>{recent.toLocaleString()} in last 30 days</p>}
                  </div>
                </div>
                <span style={{ fontSize: 22, fontWeight: 900, color, fontFamily: 'var(--font-head)', letterSpacing: '-.02em' }}>
                  {sign}{val.toLocaleString()}
                </span>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--bg)', border: '1.5px solid var(--border)', textAlign: 'center' }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>Total Transactions</p>
                <p style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{txData.total.toLocaleString()}</p>
              </div>
              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--c-teal-dim)', border: '1.5px solid rgba(91,148,144,.3)', textAlign: 'center' }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>Stock Turnover</p>
                <p style={{ fontSize: 22, fontWeight: 900, color: 'var(--teal)', fontFamily: 'var(--font-head)' }}>{turnover}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stock health */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={16} style={{ color: '#16a34a' }} />
              </div>
              <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>Stock Health</h3>
            </div>
            {out.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--red)', background: '#fff1f2', padding: '3px 10px', borderRadius: 20, border: '1px solid #fecdd3' }}>
                <AlertTriangle size={11} /> {out.length} empty
              </span>
            )}
          </div>

          {[
            { label: 'Healthy Stock', count: healthy.length, color: '#16a34a', bar: '#10b981', bg: '#f0fdf4', border: '#bbf7d0' },
            { label: 'Low Stock',     count: low.length,     color: '#d97706', bar: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
            { label: 'Out of Stock',  count: out.length,     color: '#dc2626', bar: '#ef4444', bg: '#fff1f2', border: '#fecdd3' },
          ].map(({ label, count, color, bar, bg, border }) => {
            const pct = prods.length ? Math.round((count / prods.length) * 100) : 0
            return (
              <div key={label} style={{ marginBottom: 12, padding: '12px 16px', borderRadius: 12, background: bg, border: `1px solid ${border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13.5, color: 'var(--c-text2)', fontWeight: 700 }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color, fontFamily: 'var(--font-head)' }}>{count}</span>
                    <span style={{ fontSize: 12, color: 'var(--c-text3)', fontWeight: 600 }}>{pct}%</span>
                  </div>
                </div>
                <div style={{ height: 6, borderRadius: 99, background: 'rgba(0,0,0,.07)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: bar, borderRadius: 99, transition: 'width .6s ease' }} />
                </div>
              </div>
            )
          })}

          {low.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>⚠ Low Stock Items</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 130, overflowY: 'auto' }}>
                {low.slice(0, 5).map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: 'var(--c-white)', border: '1px solid #fde68a' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{p.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#d97706', flexShrink: 0 }}>{p.quantity} {p.unit}</span>
                  </div>
                ))}
                {low.length > 5 && <p style={{ fontSize: 11.5, color: 'var(--c-text4)', textAlign: 'center', paddingTop: 4 }}>+{low.length - 5} more</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Category + Supplier */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--c-gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tag size={16} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>By Category</h3>
              <p style={{ fontSize: 11.5, color: 'var(--c-text3)' }}>Inventory value distribution</p>
            </div>
          </div>
          {loading ? <SkeletonRows cols={3} rows={5} /> : catData.length === 0
            ? <p style={{ color: 'var(--c-text4)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No categories yet</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {catData.map((c, i) => {
                const pct = catData[0].value > 0 ? Math.round((c.value / catData[0].value) * 100) : 0
                return (
                  <div key={c.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[i % CAT_COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{c.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--c-text4)', flexShrink: 0 }}>{c.count} items</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text2)', flexShrink: 0 }}>{money(c.value)}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: 'var(--bg)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: CAT_COLORS[i % CAT_COLORS.length], borderRadius: 99, transition: 'width .6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          }
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--c-teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={16} style={{ color: 'var(--teal)' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>By Supplier</h3>
              <p style={{ fontSize: 11.5, color: 'var(--c-text3)' }}>Products per supplier</p>
            </div>
          </div>
          {loading ? <SkeletonRows cols={2} rows={5} /> : supData.length === 0
            ? <p style={{ color: 'var(--c-text4)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No suppliers yet</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {supData.map((s, i) => {
                const pct = supData[0].count > 0 ? Math.round((s.count / supData[0].count) * 100) : 0
                return (
                  <div key={s.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--c-teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 800, color: 'var(--teal)' }}>
                          {s.name[0]?.toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      </div>
                      <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--teal)', flexShrink: 0, marginLeft: 8 }}>{s.count} products</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: 'var(--bg)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--teal)', borderRadius: 99, opacity: i === 0 ? 1 : 0.6, transition: 'width .6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          }
        </div>
      </div>

      {/* Top 10 table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--c-teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={17} style={{ color: 'var(--teal)' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>Top Products by Inventory Value</h3>
              <p style={{ fontSize: 12, color: 'var(--c-text3)' }}>Ranked by quantity × cost price</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: 'Total Cost',   val: money(cost),   color: 'var(--green)' },
              { label: 'Total Retail', val: money(retail), color: 'var(--teal)'  },
              { label: 'Margin',       val: `${margin}%`,  color: 'var(--gold)'  },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</p>
                <p style={{ fontSize: 15, fontWeight: 800, color }}>{val}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>Product</th><th>Category</th><th>Supplier</th>
                <th>Qty</th><th>Cost</th><th>Inventory Value</th><th>Retail Value</th><th>Potential Profit</th>
                <th style={{ width: 100 }}>Bar</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <SkeletonRows cols={10} rows={5} />
                : top10.map((p, i) => {
                  const v   = p.quantity * p.cost_price
                  const rv  = p.quantity * p.selling_price
                  const pft = rv - v
                  const pct = Math.round((v / maxVal) * 100)
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 800, color: i < 3 ? 'var(--gold)' : 'var(--c-text3)', fontSize: 12, width: 36 }}>
                        {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}
                      </td>
                      <td>
                        <p style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13.5 }}>{p.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--c-text4)', fontFamily: 'var(--mono)' }}>{p.sku}</p>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--c-text3)' }}>{(p as any).categories?.name ?? '—'}</td>
                      <td style={{ fontSize: 13, color: 'var(--c-text3)' }}>{(p as any).suppliers?.name ?? '—'}</td>
                      <td style={{ fontWeight: 700 }}>{p.quantity} <span style={{ fontSize: 11, color: 'var(--c-text3)', fontWeight: 500 }}>{p.unit}</span></td>
                      <td style={{ fontSize: 13 }}>{php(p.cost_price)}</td>
                      <td style={{ fontWeight: 800, color: 'var(--green)', fontSize: 14 }}>{money(v)}</td>
                      <td style={{ fontSize: 13, color: 'var(--c-text2)' }}>{money(rv)}</td>
                      <td style={{ fontWeight: 700, color: pft >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>{money(pft)}</td>
                      <td>
                        <div style={{ height: 6, borderRadius: 3, background: 'var(--bg)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: 'linear-gradient(90deg,#5b9490,#7cb8b4)', transition: 'width .6s ease' }} />
                        </div>
                        <p style={{ fontSize: 10, color: 'var(--c-text4)', marginTop: 2 }}>{pct}%</p>
                      </td>
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
