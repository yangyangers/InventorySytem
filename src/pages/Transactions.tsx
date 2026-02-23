// ── Transactions ─────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react'
import { ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Transaction, TX_LABEL, TxType } from '@/types'
import { dt, txColor, txSign } from '@/lib/utils'
import { SkeletonRows, Empty } from '@/components/ui'

const FILTER_TYPES = [
  { v: '', l: 'All' }, { v: 'stock_in', l: 'Stock In' },
  { v: 'stock_out', l: 'Stock Out' }, { v: 'adjustment', l: 'Adjustment' },
]

export function Transactions() {
  const { user } = useAuth()
  const [rows, setRows]     = useState<Transaction[]>([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [type, setType]     = useState('')
  const [loading, setLoading] = useState(true)
  const PER = 25

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    let q = sb.from('transactions')
      .select('*, products(name,sku,unit), users(full_name,username)', { count: 'exact' })
      .eq('business_id', user.business_id).order('created_at', { ascending: false })
      .range((page-1)*PER, page*PER-1)
    if (type) q = q.eq('transaction_type', type)
    const { data, count } = await q
    setRows(data as Transaction[] ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [user, page, type])

  useEffect(() => { load() }, [load])

  return (
    <div className="anim-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>Transactions</h2>
          <p style={{ color: 'var(--ink-3)', fontSize: 13.5, marginTop: 3 }}>{total} total records</p>
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTER_TYPES.map(f => (
          <button key={f.v} onClick={() => { setType(f.v); setPage(1) }}
            style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', border: '1.5px solid', fontFamily: 'var(--font)',
              borderColor: type === f.v ? 'var(--gold)' : 'var(--border)',
              background: type === f.v ? 'var(--gold)' : 'var(--white)',
              color: type === f.v ? '#fff' : 'var(--ink-3)',
            }}>
            {f.l}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Product</th><th>Type</th><th>Qty</th><th>Reference</th><th>By</th><th>Notes</th><th>Date</th></tr></thead>
            <tbody>
              {loading ? <SkeletonRows cols={7} rows={8} /> : rows.length === 0
                ? <tr><td colSpan={7}><Empty icon={<ArrowLeftRight size={38} />} text="No transactions found" /></td></tr>
                : rows.map(tx => (
                  <tr key={tx.id}>
                    <td>
                      <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13.5 }}>{tx.products?.name ?? '—'}</p>
                      <p style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{tx.products?.sku}</p>
                    </td>
                    <td>
                      <span className={`badge ${tx.transaction_type === 'stock_in' ? 'badge-green' : tx.transaction_type === 'stock_out' ? 'badge-red' : 'badge-blue'}`}>
                        {TX_LABEL[tx.transaction_type]}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: txColor(tx.transaction_type), fontSize: 14 }}>
                      {txSign(tx.transaction_type)}{tx.quantity} {tx.products?.unit}
                    </td>
                    <td>{tx.reference_number ? <span className="mono badge badge-navy" style={{ fontSize: 11.5 }}>{tx.reference_number}</span> : <span style={{ color: 'var(--ink-4)' }}>—</span>}</td>
                    <td style={{ fontSize: 13 }}>{tx.users?.full_name ?? '—'}</td>
                    <td style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.notes ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{dt(tx.created_at)}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        {total > PER && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>{(page-1)*PER+1}–{Math.min(page*PER,total)} of {total}</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm" disabled={page===1} onClick={() => setPage(p=>p-1)}><ChevronLeft size={13}/></button>
              <button className="btn btn-secondary btn-sm" disabled={page*PER>=total} onClick={() => setPage(p=>p+1)}><ChevronRight size={13}/></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Transactions
