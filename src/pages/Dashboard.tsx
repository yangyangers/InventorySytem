import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Package, AlertTriangle, TrendingDown, ArrowUpRight,
  RotateCcw, ShoppingCart, BoxSelect, PhilippinePeso,
  BarChart3, ArrowDown, ArrowUp, Minus,
} from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Product, Transaction, BIZ, BizId } from '@/types'
import { php, txColor, txSign } from '@/lib/utils'
import { SkeletonRows } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'

function StatCard({
  label, value, sub, icon, color, bg, accentColor, trend,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ReactNode; color: string; bg: string; accentColor: string
  trend?: { val: string; up: boolean; neutral?: boolean }
}) {
  return (
    <div
      style={{
        background: 'var(--c-white)', borderRadius: 18, padding: '22px 24px',
        border: '1px solid var(--border)', borderTop: `3px solid ${accentColor}`,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        transition: 'box-shadow .2s, transform .2s', cursor: 'default',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(0,0,0,0.09)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${color}30` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        {trend && (
          <span style={{
            fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
            background: trend.neutral ? 'var(--bg)' : trend.up ? 'var(--c-green-dim)' : 'var(--c-red-dim)',
            color: trend.neutral ? 'var(--c-text3)' : trend.up ? 'var(--green)' : 'var(--red)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {trend.neutral ? <Minus size={10} /> : trend.up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            {trend.val}
          </span>
        )}
      </div>
      <p style={{ fontSize: 30, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-.04em', lineHeight: 1, fontFamily: 'var(--font-head)' }}>{value}</p>
      <p style={{ fontSize: 13.5, color: 'var(--c-text2)', fontWeight: 700, marginTop: 10 }}>{label}</p>
      {sub && <p style={{ fontSize: 12, color: 'var(--c-text4)', marginTop: 3 }}>{sub}</p>}
    </div>
  )
}

function TxTypeBadge({ type }: { type: string }) {
  const cfg = type === 'stock_in'
    ? { label: 'Stock In',    bg: 'var(--c-green-dim)', color: 'var(--green)', icon: <ArrowUp size={10} /> }
    : type === 'stock_out'
    ? { label: 'Stock Out',   bg: 'var(--c-red-dim)',   color: 'var(--red)',   icon: <ArrowDown size={10} /> }
    : { label: 'Adjustment',  bg: 'var(--c-teal-dim)',  color: 'var(--teal)',  icon: <Minus size={10} /> }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [txns, setTxns]         = useState<Transaction[]>([])
  const [loading, setLoading]   = useState(true)
  const isFirstLoad = useRef(true)

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      const [p, t] = await Promise.all([
        sb.from('products').select('*').eq('business_id', user.business_id).eq('is_active', true),
        sb.from('transactions')
          .select('*, products(name,sku,unit,selling_price), users(full_name,username)')
          .eq('business_id', user.business_id)
          .order('created_at', { ascending: false }).limit(8),
      ])
      if (p.error) throw p.error
      if (t.error) throw t.error
      setProducts(p.data as Product[] ?? [])
      setTxns(t.data as Transaction[] ?? [])
      if (!isFirstLoad.current) toast.success('Dashboard refreshed', 'Data is up to date')
      isFirstLoad.current = false
    } catch (err: any) {
      toast.error('Failed to load data', err?.message ?? 'Check your connection and try again')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user])
  if (!user) return null

  const biz         = BIZ[user.business_id as BizId]
  const costValue   = products.reduce((s, p) => s + p.quantity * p.cost_price, 0)
  const retailValue = products.reduce((s, p) => s + p.quantity * p.selling_price, 0)
  const lowStock    = products.filter(p => p.quantity > 0 && p.quantity <= p.reorder_level)
  const outStock    = products.filter(p => p.quantity === 0)
  const inStock     = products.filter(p => p.quantity > p.reorder_level)
  const hour        = new Date().getHours()
  const greeting    = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const today       = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const todayTxns   = txns.filter(t => {
    const d = new Date(t.created_at), now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  })

  return (
    <div className="anim-fade-up" style={{ paddingBottom: 32 }}>

      {/* Header */}
      <div className="dash-greeting" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, paddingBottom: 22, borderBottom: '1px solid var(--border)' }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text4)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 5 }}>{today}</p>
          <h2 style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-.04em', fontFamily: 'var(--font-head)', lineHeight: 1.1 }}>
            {greeting}, {user.full_name.split(' ')[0]} <span className="dash-greeting-wave">👋</span>
          </h2>
          <p style={{ color: 'var(--c-text3)', fontSize: 14, marginTop: 5 }}>
            Here's what's happening at{' '}
            <span style={{ color: biz?.color ?? 'var(--teal)', fontWeight: 800, fontFamily: 'var(--font-head)' }}>{biz?.name}</span>
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading} style={{ marginTop: 4 }}>
          <RotateCcw size={13} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <StatCard
          label="Total Products" value={loading ? '—' : products.length}
          icon={<Package size={22} />} color="#4e6b65" bg="#eff3f2" accentColor="#4e6b65"
          sub={loading ? '' : `${inStock.length} healthy, ${lowStock.length} low`}
        />
        <StatCard
          label="Inventory Value" value={loading ? '—' : php(costValue)}
          icon={<PhilippinePeso size={22} />} color="var(--green)" bg="var(--c-green-dim)" accentColor="#10b981"
          sub={loading ? '' : `Retail value: ${php(retailValue)}`}
        />
        <StatCard
          label="Low Stock" value={loading ? '—' : lowStock.length}
          icon={<AlertTriangle size={22} />} color="var(--amber)" bg="var(--c-amber-dim)" accentColor="#f59e0b"
          sub="items need reorder"
          trend={!loading ? (lowStock.length > 0 ? { val: 'Needs attention', up: false } : { val: 'All good', up: true }) : undefined}
        />
        <StatCard
          label="Out of Stock" value={loading ? '—' : outStock.length}
          icon={<TrendingDown size={22} />} color="var(--red)" bg="var(--c-red-dim)" accentColor="#ef4444"
          sub="need immediate action"
          trend={!loading ? (outStock.length > 0 ? { val: 'Critical', up: false } : { val: 'All stocked', up: true }) : undefined}
        />
      </div>

      {/* Secondary stats strip */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: "Today's Transactions", value: todayTxns.length, icon: <BarChart3 size={16} />, color: 'var(--teal)' },
            { label: 'Categories in Use',    value: [...new Set(products.map(p => p.category_id).filter(Boolean))].length, icon: <BoxSelect size={16} />, color: '#8b5cf6' },
            { label: 'Potential Profit',     value: php(retailValue - costValue), icon: <PhilippinePeso size={16} />, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} className="dash-mini-stat" style={{ background: 'var(--c-white)', borderRadius: 14, padding: '14px 18px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="dash-mini-icon" style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'transform .22s' }}>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
              <div>
                <p style={{ fontSize: 11.5, color: 'var(--c-text3)', fontWeight: 600, marginBottom: 2 }}>{s.label}</p>
                <p style={{ fontSize: 19, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-.02em', fontFamily: 'var(--font-head)' }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>

        {/* Recent Transactions */}
        <div style={{ background: 'var(--c-white)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(78,107,101,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={17} style={{ color: '#4e6b65' }} />
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>Recent Transactions</p>
                <p style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 1 }}>Latest stock movements</p>
              </div>
            </div>
            <Link to="/transactions" style={{ fontSize: 12.5, color: 'var(--teal)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
              View all <ArrowUpRight size={13} />
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th><th>Type</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <SkeletonRows cols={4} rows={5} />
                  : txns.length === 0
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--c-text3)', fontSize: 13 }}>No transactions yet</td></tr>
                  : txns.map(tx => (
                    <tr key={tx.id}>
                      <td>
                        <p style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13.5 }}>{tx.products?.name ?? '—'}</p>
                        <p style={{ fontSize: 11, color: 'var(--c-text4)', fontFamily: 'var(--mono)', marginTop: 1 }}>{tx.products?.sku}</p>
                      </td>
                      <td><TxTypeBadge type={tx.transaction_type} /></td>
                      <td style={{ textAlign: 'center', fontWeight: 900, color: txColor(tx.transaction_type), fontSize: 15, fontFamily: 'var(--font-head)' }}>
                        {txSign(tx.transaction_type)}{tx.quantity}
                        <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--c-text3)', marginLeft: 2 }}>{tx.products?.unit}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--c-text3)', whiteSpace: 'nowrap' }}>
                        {new Date(tx.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        <br />
                        <span style={{ fontSize: 11, color: 'var(--c-text4)' }}>
                          {new Date(tx.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stock Alerts */}
        <div style={{ background: 'var(--c-white)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(239,68,68,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={17} style={{ color: 'var(--red)' }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>Stock Alerts</p>
                  {(lowStock.length + outStock.length) > 0 && !loading && (
                    <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: 'var(--c-red-dim)', color: 'var(--red)' }}>
                      {lowStock.length + outStock.length}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 1 }}>Items needing attention</p>
              </div>
            </div>
            <Link to="/inventory" style={{ fontSize: 12.5, color: 'var(--teal)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
              Manage <ArrowUpRight size={13} />
            </Link>
          </div>

          {loading
            ? <div style={{ padding: 18 }}>{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skel" style={{ height: 52, marginBottom: 8, borderRadius: 12 }} />)}</div>
            : (outStock.length + lowStock.length) === 0
            ? <div style={{ padding: '52px 20px', textAlign: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--c-green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <span style={{ fontSize: 28 }}>✅</span>
                </div>
                <p style={{ fontWeight: 800, color: 'var(--green)', fontSize: 14.5 }}>All products well-stocked!</p>
                <p style={{ fontSize: 12.5, color: 'var(--c-text3)', marginTop: 5 }}>No action needed right now.</p>
              </div>
            : <div style={{ overflowY: 'auto', maxHeight: 380 }}>
                {outStock.length > 0 && (
                  <div style={{ padding: '10px 20px 6px', borderBottom: outStock.length > 0 && lowStock.length > 0 ? '1px solid var(--border)' : undefined }}>
                    <p style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--red)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                      Out of Stock — {outStock.length}
                    </p>
                    {outStock.slice(0, 4).map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                          <p style={{ fontSize: 10.5, color: 'var(--c-text4)', fontFamily: 'var(--mono)', marginTop: 1 }}>{p.sku}</p>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: 'var(--c-red-dim)', color: 'var(--red)', flexShrink: 0, marginLeft: 10 }}>Empty</span>
                      </div>
                    ))}
                  </div>
                )}
                {lowStock.length > 0 && (
                  <div style={{ padding: '10px 20px 6px' }}>
                    <p style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--amber)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                      Low Stock — {lowStock.length}
                    </p>
                    {lowStock.slice(0, 5).map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                          <p style={{ fontSize: 10.5, color: 'var(--c-text4)', fontFamily: 'var(--mono)', marginTop: 1 }}>{p.sku}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--amber)', fontFamily: 'var(--font-head)' }}>{p.quantity}</span>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: 'var(--c-amber-dim)', color: 'var(--amber)' }}>Low</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          }
        </div>
      </div>
    </div>
  )
}