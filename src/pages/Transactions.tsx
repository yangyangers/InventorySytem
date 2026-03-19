// ── Transactions ─────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react'
import { ArrowLeftRight, ChevronLeft, ChevronRight, User, Phone, Receipt, Calendar } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Transaction, TX_LABEL, TxType, PAYMENT_METHOD_LABEL, STOCK_LOCATION_LABEL, PaymentMethod, StockLocation } from '@/types'
import { dt, txColor, txSign } from '@/lib/utils'
import { SkeletonRows, Empty } from '@/components/ui'

const FILTER_TYPES = [
  { v: '', l: 'All' }, { v: 'stock_in', l: 'Stock In' },
  { v: 'stock_out', l: 'Stock Out' }, { v: 'adjustment', l: 'Adjustment' },
]

export function Transactions() {
  const { user } = useAuth()
  const [rows, setRows]       = useState<Transaction[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [type, setType]       = useState('')
  const [loading, setLoading] = useState(true)
  // ref# → { groupTotal, amountPaid, outstanding } for wellprint/tcchemical
  const [refBalanceMap, setRefBalanceMap] = useState<Map<string, { groupTotal: number; amountPaid: number | null; outstanding: number }>>(new Map())
  const PER = 25

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    let q = sb.from('transactions')
      .select('*, products(name,sku,unit,selling_price), users(full_name,username)', { count: 'exact' })
      .eq('business_id', user.business_id).order('created_at', { ascending: false })
      .range((page-1)*PER, page*PER-1)
    if (type) q = q.eq('transaction_type', type)
    const { data, count } = await q
    const fetched = (data as Transaction[]) ?? []
    setRows(fetched)
    setTotal(count ?? 0)

    // Build ref→balance map for wellprint / tcchemical
    const isWP = user.business_id === 'wellprint' || user.business_id === 'tcchemical'
    if (isWP) {
      // Collect unique reference numbers from this page that are stock_out
      const refs = [...new Set(
        fetched
          .filter(r => r.transaction_type === 'stock_out' && r.reference_number)
          .map(r => r.reference_number!)
      )]
      if (refs.length > 0) {
        // Fetch ALL rows sharing those ref numbers (not just current page)
        const { data: allRef } = await sb
          .from('transactions')
          .select('reference_number, amount_paid, quantity, products(selling_price)')
          .eq('business_id', user.business_id)
          .eq('transaction_type', 'stock_out')
          .in('reference_number', refs)
        const allRefRows = (allRef as any[]) ?? []
        // Group by ref#
        const map = new Map<string, { groupTotal: number; amountPaid: number | null; outstanding: number }>()
        for (const r of allRefRows) {
          const ref = r.reference_number as string
          if (!map.has(ref)) map.set(ref, { groupTotal: 0, amountPaid: r.amount_paid ?? null, outstanding: 0 })
          const entry = map.get(ref)!
          const price = (r.products as any)?.selling_price ?? 0
          entry.groupTotal += price * r.quantity
          // amount_paid is same for all rows in a group — keep first non-null
          if (entry.amountPaid === null && r.amount_paid !== null) entry.amountPaid = r.amount_paid
        }
        // Compute outstanding per group
        for (const [, v] of map) {
          v.outstanding = v.amountPaid !== null ? Math.max(0, v.groupTotal - v.amountPaid) : v.groupTotal
        }
        setRefBalanceMap(map)
      } else {
        setRefBalanceMap(new Map())
      }
    }

    setLoading(false)
  }, [user, page, type])

  useEffect(() => { load() }, [load])

  const showSaleCols = !type || type === 'stock_out'
  const isWellprintOrTC = user?.business_id === 'wellprint' || user?.business_id === 'tcchemical'
  const showExtraCols = showSaleCols && isWellprintOrTC
  const colSpan = showSaleCols ? (showExtraCols ? 12 : 9) : (showExtraCols ? 8 : 6)

  function money(n: number) {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
  }

  return (
    <div className="anim-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>Transactions</h2>
          <p style={{ color: 'var(--c-text3)', fontSize: 13.5, marginTop: 3 }}>{total} total records</p>
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTER_TYPES.map(f => (
          <button key={f.v} onClick={() => { setType(f.v); setPage(1) }}
            className={`tx-filter-pill${type === f.v ? ' active' : ''}`}
            style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'var(--font)',
              borderColor: type === f.v ? 'var(--gold)' : 'var(--border)',
              background: type === f.v ? 'var(--gold)' : 'var(--c-white)',
              color: type === f.v ? 'var(--c-white)' : 'var(--c-text3)',
            }}>
            {f.l}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Type</th>
                <th>Qty</th>
                {showSaleCols && <th style={{ whiteSpace: 'nowrap' }}><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Receipt size={12} />Doc / Ref #</span></th>}
                {showSaleCols && <th style={{ whiteSpace: 'nowrap' }}><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Calendar size={12} />Date of Sale</span></th>}
                {showSaleCols && <th style={{ whiteSpace: 'nowrap' }}><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><User size={12} />Customer</span></th>}
                {showExtraCols && <th style={{ whiteSpace: 'nowrap' }}>Payment</th>}
                {isWellprintOrTC && <th style={{ whiteSpace: 'nowrap' }}>Location</th>}
                {showExtraCols && <th style={{ whiteSpace: 'nowrap' }}>Outstanding</th>}
                <th>By</th>
                <th>Notes</th>
                <th>Recorded</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows cols={colSpan} rows={8} /> : rows.length === 0
                ? <tr><td colSpan={colSpan}><Empty icon={<ArrowLeftRight size={38} />} text="No transactions found" /></td></tr>
                : rows.map(tx => {
                  const isOut = tx.transaction_type === 'stock_out'
                  // Look up balance by reference number (group-level, not per-row)
                  const refBalance = (isOut && tx.reference_number)
                    ? refBalanceMap.get(tx.reference_number) ?? null
                    : null
                  const hasAmountPaid = refBalance?.amountPaid !== null && refBalance?.amountPaid !== undefined
                  const outstanding   = hasAmountPaid ? refBalance!.outstanding : null
                  return (
                    <tr key={tx.id}>
                      <td>
                        <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13.5 }}>{tx.products?.name ?? '—'}</p>
                        <p style={{ fontSize: 11.5, color: 'var(--c-text3)', fontFamily: 'var(--mono)' }}>{tx.products?.sku}</p>
                      </td>
                      <td>
                        <span className={`badge ${tx.transaction_type === 'stock_in' ? 'badge-green' : tx.transaction_type === 'stock_out' ? 'badge-red' : 'badge-blue'}`}>
                          {TX_LABEL[tx.transaction_type]}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: txColor(tx.transaction_type), fontSize: 14 }}>
                        {txSign(tx.transaction_type)}{tx.quantity} {tx.products?.unit}
                      </td>
                      {showSaleCols && (
                        <td>
                          {tx.transaction_type === 'stock_in' && tx.voucher_number
                            ? <span className="mono badge badge-blue" style={{ fontSize: 11.5 }}>{tx.voucher_number}</span>
                            : tx.transaction_type === 'stock_out' && tx.reference_number
                            ? <span className="mono badge badge-navy" style={{ fontSize: 11.5 }}>{tx.reference_number}</span>
                            : <span style={{ color: 'var(--c-text4)' }}>—</span>}
                        </td>
                      )}
                      {showSaleCols && (
                        <td style={{ fontSize: 12.5, color: 'var(--c-text2)', whiteSpace: 'nowrap' }}>
                          {isOut
                            ? tx.date_of_sale
                              ? new Date(tx.date_of_sale).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                              : <span style={{ color: 'var(--c-text4)' }}>—</span>
                            : null}
                        </td>
                      )}
                      {showSaleCols && (
                        <td>
                          {isOut
                            ? tx.customer_name
                              ? <div>
                                  <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{tx.customer_name}</p>
                                  {tx.customer_phone && (
                                    <p style={{ fontSize: 11.5, color: 'var(--c-text3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                      <Phone size={10} />{tx.customer_phone}
                                    </p>
                                  )}
                                </div>
                              : <span style={{ color: 'var(--c-text4)' }}>—</span>
                            : null}
                        </td>
                      )}
                      {showExtraCols && (
                        <td>
                          {isOut && tx.payment_method
                            ? <div>
                                <span style={{ fontSize: 11.5, fontWeight: 700, background: 'var(--c-teal-dim)', color: 'var(--teal)', borderRadius: 5, padding: '2px 7px', display: 'inline-block' }}>
                                  {PAYMENT_METHOD_LABEL[tx.payment_method as PaymentMethod]}
                                </span>
                                {tx.payment_reference && (
                                  <p style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--c-text4)', marginTop: 2 }}>{tx.payment_reference}</p>
                                )}
                              </div>
                            : <span style={{ color: 'var(--c-text4)' }}>—</span>}
                        </td>
                      )}
                      {isWellprintOrTC && (
                        <td style={{ fontSize: 12.5, color: 'var(--c-text2)' }}>
                          {tx.stock_location
                            ? STOCK_LOCATION_LABEL[tx.stock_location as StockLocation]
                            : <span style={{ color: 'var(--c-text4)' }}>—</span>}
                        </td>
                      )}
                      {showExtraCols && (
                        <td>
                          {isOut && refBalance !== null && refBalance.outstanding > 0
                            ? <span style={{
                                fontSize: 13.5, fontWeight: 900,
                                color: '#d97706',
                              }}>
                                {money(refBalance.outstanding)}
                              </span>
                            : <span style={{ color: 'var(--c-text4)' }}>—</span>}
                        </td>
                      )}
                      <td style={{ fontSize: 13 }}>{tx.users?.full_name ?? '—'}</td>
                      <td style={{ fontSize: 13, color: 'var(--c-text3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.notes ?? '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--c-text3)', whiteSpace: 'nowrap' }}>{dt(tx.created_at)}</td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
        {total > PER && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 13, color: 'var(--c-text3)' }}>{(page-1)*PER+1}–{Math.min(page*PER,total)} of {total}</p>
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
