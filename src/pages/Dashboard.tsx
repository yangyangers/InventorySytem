import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, DollarSign, AlertTriangle, TrendingDown, ArrowUpRight, ArrowDownRight, RotateCcw, ShoppingCart } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Product, Transaction, BIZ, BizId } from '@/types'
import { php, txColor, txSign } from '@/lib/utils'
import { StatCard, SkeletonRows } from '@/components/ui'

export default function Dashboard() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [txns, setTxns]         = useState<Transaction[]>([])
  const [loading, setLoading]   = useState(true)

  async function load() {
    if (!user) return
    setLoading(true)
    const [p, t] = await Promise.all([
      sb.from('products').select('*').eq('business_id', user.business_id).eq('is_active', true),
      sb.from('transactions')
        .select('*, products(name,sku,unit), users(full_name,username)')
        .eq('business_id', user.business_id)
        .order('created_at', { ascending: false }).limit(8),
    ])
    setProducts(p.data as Product[] ?? [])
    setTxns(t.data as Transaction[] ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user])
  if (!user) return null

  const biz      = BIZ[user.business_id as BizId]
  const value    = products.reduce((s, p) => s + p.quantity * p.cost_price, 0)
  const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= p.reorder_level)
  const outStock = products.filter(p => p.quantity === 0)
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="anim-fade-up">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.04em', fontFamily: 'var(--font-head)' }}>
            {greeting}, {user.full_name.split(' ')[0]} 👋
          </h2>
          <p style={{ color: 'var(--c-text3)', fontSize: 14, marginTop: 4 }}>
            Here's an overview of <span style={{ color: biz.color, fontWeight: 700, fontFamily: 'var(--font-head)' }}>{biz.name}</span> today
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading} style={{ marginTop: 4 }}>
          <RotateCcw size={13} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid-4 stagger" style={{ marginBottom: 24 }}>
        <StatCard
          label="Total Products" value={loading ? '—' : products.length}
          icon={<Package size={22} />} color="#4e6b65" bg="#eff3f2" accentColor="#4e6b65"
          sub="active items in stock"
        />
        <StatCard
          label="Inventory Value" value={loading ? '—' : php(value)}
          icon={<DollarSign size={22} />} color="var(--green)" bg="var(--c-green-dim)" accentColor="#10b981"
          sub="at cost price"
        />
        <StatCard
          label="Low Stock" value={loading ? '—' : lowStock.length}
          icon={<AlertTriangle size={22} />} color="var(--amber)" bg="var(--c-amber-dim)" accentColor="#f59e0b"
          sub="items need reorder"
        />
        <StatCard
          label="Out of Stock" value={loading ? '—' : outStock.length}
          icon={<TrendingDown size={22} />} color="var(--red)" bg="var(--c-red-dim)" accentColor="#ef4444"
          sub="need immediate action"
        />
      </div>

      {/* Two columns */}
      <div className="dash-cols" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
        {/* Recent transactions */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={16} style={{ color: '#4e6b65' }} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>Recent Transactions</p>
                <p style={{ fontSize: 11.5, color: 'var(--c-text3)' }}>Latest stock movements</p>
              </div>
            </div>
            <Link to="/transactions" style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowUpRight size={13} />
            </Link>
          </div>
          <table className="table">
            <thead>
              <tr><th>Product</th><th>Type</th><th>Qty</th><th>Date</th></tr>
            </thead>
            <tbody>
              {loading
                ? <SkeletonRows cols={4} rows={5} />
                : txns.length === 0
                ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--c-text3)' }}>No transactions yet</td></tr>
                : txns.map(tx => (
                    <tr key={tx.id}>
                      <td>
                        <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13.5 }}>{tx.products?.name ?? '—'}</p>
                        <p style={{ fontSize: 11.5, color: 'var(--c-text3)', fontFamily: 'var(--mono)' }}>{tx.products?.sku}</p>
                      </td>
                      <td>
                        <span className={`badge ${tx.transaction_type === 'stock_in' ? 'badge-green' : tx.transaction_type === 'stock_out' ? 'badge-red' : 'badge-blue'}`} style={{ fontSize: 10.5 }}>
                          {tx.transaction_type === 'stock_in' ? '▲ In' : tx.transaction_type === 'stock_out' ? '▼ Out' : '⊙ Adj'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 800, color: txColor(tx.transaction_type), fontSize: 15, fontFamily: 'var(--font-head)' }}>
                        {txSign(tx.transaction_type)}{tx.quantity}
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-text3)', marginLeft: 3 }}>{tx.products?.unit}</span>
                      </td>
                      <td style={{ fontSize: 11.5, color: 'var(--c-text3)' }}>
                        {new Date(tx.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        {/* Stock alerts */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(239,68,68,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>
                  Stock Alerts
                  {(lowStock.length + outStock.length) > 0 && (
                    <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 10.5 }}>{lowStock.length + outStock.length}</span>
                  )}
                </p>
                <p style={{ fontSize: 11.5, color: 'var(--c-text3)' }}>Items needing attention</p>
              </div>
            </div>
            <Link to="/inventory" style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              Fix <ArrowUpRight size={13} />
            </Link>
          </div>
          {loading
            ? <div style={{ padding: 18 }}>
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skel" style={{ height: 42, marginBottom: 8, borderRadius: 10 }} />)}
              </div>
            : (outStock.length + lowStock.length) === 0
            ? <div style={{ padding: '52px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <p style={{ fontWeight: 700, color: 'var(--green)', fontSize: 14 }}>All products well-stocked!</p>
                <p style={{ fontSize: 12.5, color: 'var(--c-text3)', marginTop: 4 }}>No action needed right now.</p>
              </div>
            : [...outStock, ...lowStock].slice(0, 7).map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 22px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--c-text3)', fontFamily: 'var(--mono)' }}>{p.sku}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: p.quantity === 0 ? 'var(--red)' : 'var(--amber)', fontFamily: 'var(--font-head)' }}>
                    {p.quantity}
                  </span>
                  <span className={`badge ${p.quantity === 0 ? 'badge-red' : 'badge-amber'}`} style={{ fontSize: 10.5 }}>
                    {p.quantity === 0 ? 'Empty' : 'Low'}
                  </span>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}