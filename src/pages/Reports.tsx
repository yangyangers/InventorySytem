import { useEffect, useState } from 'react'
import { Package, DollarSign, TrendingUp, BarChart3, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Product } from '@/types'
import { php, bizColor } from '@/lib/utils'
import { StatCard, SkeletonRows } from '@/components/ui'

export default function Reports() {
  const { user } = useAuth()
  const [prods, setProds]   = useState<Product[]>([])
  const [txData, setTxData] = useState({ in: 0, out: 0, adj: 0, total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      sb.from('products').select('*, categories(name)').eq('business_id', user.business_id).eq('is_active', true),
      sb.from('transactions').select('transaction_type, quantity').eq('business_id', user.business_id),
    ]).then(([p, t]) => {
      setProds(p.data as Product[] ?? [])
      const rows = t.data ?? []
      setTxData({
        in:    rows.filter((r: any) => r.transaction_type === 'stock_in').reduce((s: number, r: any) => s + r.quantity, 0),
        out:   rows.filter((r: any) => r.transaction_type === 'stock_out').reduce((s: number, r: any) => s + r.quantity, 0),
        adj:   rows.filter((r: any) => r.transaction_type === 'adjustment').length,
        total: rows.length,
      })
      setLoading(false)
    })
  }, [user])

  const cost    = prods.reduce((s, p) => s + p.quantity * p.cost_price, 0)
  const retail  = prods.reduce((s, p) => s + p.quantity * p.selling_price, 0)
  const profit  = retail - cost
  const margin  = cost > 0 ? ((profit / retail) * 100).toFixed(1) : '0.0'
  const healthy = prods.filter(p => p.quantity > p.reorder_level)
  const low     = prods.filter(p => p.quantity > 0 && p.quantity <= p.reorder_level)
  const out     = prods.filter(p => p.quantity === 0)
  const top10   = [...prods].sort((a, b) => (b.quantity * b.cost_price) - (a.quantity * a.cost_price)).slice(0, 10)
  const maxVal  = top10[0] ? top10[0].quantity * top10[0].cost_price : 1

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
        <StatCard label="Products" value={loading ? '—' : prods.length}
          icon={<Package size={22} />} color="#4e6b65" bg="#eff3f2" accentColor="#4e6b65" sub="active items" />
        <StatCard label="Inventory Cost" value={loading ? '—' : php(cost)}
          icon={<DollarSign size={22} />} color="var(--green)" bg="var(--green-l)" accentColor="#10b981" sub="at cost price" />
        <StatCard label="Retail Value" value={loading ? '—' : php(retail)}
          icon={<TrendingUp size={22} />} color="var(--teal)" bg="var(--teal-l)" accentColor="#5b9490" sub="at selling price" />
        <StatCard label="Gross Margin" value={loading ? '—' : `${margin}%`}
          icon={<BarChart3 size={22} />} color="var(--gold)" bg="var(--gold-l)" accentColor="var(--gold)"
          sub={loading ? '' : `${php(profit)} potential profit`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 18, marginBottom: 20 }}>
        {/* Transaction breakdown */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 18, fontFamily: 'var(--font-head)' }}>Transaction Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Total Units Received', val: txData.in, sign: '+', color: 'var(--green)', bg: 'var(--green-l)', border: '#86efac', Icon: ArrowUpRight },
              { label: 'Total Units Dispatched', val: txData.out, sign: '−', color: 'var(--red)', bg: 'var(--red-l)', border: '#fca5a5', Icon: ArrowDownRight },
              { label: 'Adjustments Made', val: txData.adj, sign: '⊙', color: 'var(--teal)', bg: 'var(--teal-l)', border: '#67e8f9', Icon: Layers },
            ].map(({ label, val, sign, color, bg, border, Icon }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', borderRadius: 12,
                background: bg, border: `1.5px solid ${border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <span style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 600 }}>{label}</span>
                </div>
                <span style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'var(--font-head)' }}>
                  {sign}{val.toLocaleString()}
                </span>
              </div>
            ))}
            <div style={{ padding: '12px 18px', borderRadius: 12, background: 'var(--bg)', border: '1.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 600 }}>Total Transactions</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{txData.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Stock health */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 18, fontFamily: 'var(--font-head)' }}>Stock Health</h3>
          {[
            { label: 'Healthy Stock', count: healthy.length, color: 'var(--green)', bar: '#10b981' },
            { label: 'Low Stock',     count: low.length,     color: 'var(--amber)', bar: '#f59e0b' },
            { label: 'Out of Stock',  count: out.length,     color: 'var(--red)',   bar: '#ef4444' },
          ].map(({ label, count, color, bar }) => {
            const pct = prods.length ? Math.round((count / prods.length) * 100) : 0
            return (
              <div key={label} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 600 }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'var(--font-head)' }}>{count}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{pct}%</span>
                  </div>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: bar }} />
                </div>
              </div>
            )
          })}

          {/* Summary donut-like bar */}
          <div style={{ marginTop: 24, padding: '16px', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 10, letterSpacing: '.04em', textTransform: 'uppercase' }}>Composition</p>
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
              {[
                { count: healthy.length, color: '#10b981' },
                { count: low.length,     color: '#f59e0b' },
                { count: out.length,     color: '#ef4444' },
              ].map(({ count, color }, i) => (
                prods.length > 0 && <div key={i} style={{ flex: count, background: color, minWidth: count > 0 ? 4 : 0 }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
              {[['#10b981','Healthy'],['#f59e0b','Low'],['#ef4444','Empty']].map(([c,l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--ink-3)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c as string }} />{l}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top 10 table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(99,102,241,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={17} style={{ color: '#5b9490' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>Top Products by Inventory Value</h3>
            <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>Ranked by quantity × cost price</p>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr><th>#</th><th>Product</th><th>Category</th><th>Qty</th><th>Cost</th><th>Value</th><th>Retail Value</th><th>Value Bar</th></tr>
            </thead>
            <tbody>
              {loading
                ? <SkeletonRows cols={8} rows={5} />
                : top10.map((p, i) => {
                  const v = p.quantity * p.cost_price
                  const pct = Math.round((v / maxVal) * 100)
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 800, color: i < 3 ? 'var(--gold)' : 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 12, width: 36 }}>
                        {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 14 }}>{p.name}</td>
                      <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{(p as any).categories?.name ?? '—'}</td>
                      <td style={{ fontWeight: 700 }}>{p.quantity} <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>{p.unit}</span></td>
                      <td style={{ fontSize: 13 }}>{php(p.cost_price)}</td>
                      <td style={{ fontWeight: 800, color: 'var(--green)', fontSize: 14, fontFamily: 'var(--font-head)' }}>{php(v)}</td>
                      <td style={{ fontSize: 13, color: 'var(--ink-2)' }}>{php(p.quantity * p.selling_price)}</td>
                      <td style={{ width: 120 }}>
                        <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-2)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: 'linear-gradient(90deg, #5b9490, #7cb8b4)', transition: 'width .6s ease' }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
