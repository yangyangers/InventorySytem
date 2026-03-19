// ── Outstanding Collectibles ──────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react'
import {
  AlertCircle, CheckCircle2, Hash, Calendar, User, Phone,
  CreditCard, MapPin, ChevronDown, ChevronUp, Package, Wallet, Clock, Plus,
} from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Transaction, PAYMENT_METHOD_LABEL, STOCK_LOCATION_LABEL, PaymentMethod, StockLocation } from '@/types'
import { SkeletonRows, Empty, Modal, Alert, Field } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'

interface CollectibleGroup {
  refNumber:        string
  date:             string
  checkedOutAt:     string
  customerName:     string
  customerPhone:    string | null
  items:            Transaction[]
  total:            number
  amountPaid:       number | null
  outstanding:      number
  paymentMethod:    string | null
  paymentReference: string | null
  stockLocation:    string | null
}

interface CustomerBalance {
  name:        string
  phone:       string | null
  totalDue:    number
  totalPaid:   number
  outstanding: number
  txCount:     number
}

type Tab = 'all' | 'partial' | 'no_payment' | 'balance'

function money(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Collectibles() {
  const { user } = useAuth()
  const toast   = useToast()
  const [groups, setGroups]   = useState<CollectibleGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<Tab>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  // ── Record Payment modal ─────────────────────────────────────────────────
  const [payModal, setPayModal]   = useState<CollectibleGroup | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod | ''>('')
  const [payRef, setPayRef]       = useState('')
  const [payErr, setPayErr]       = useState('')
  const [paySaving, setPaySaving] = useState(false)

  function openPayModal(g: CollectibleGroup) {
    setPayModal(g)
    setPayAmount('')
    setPayMethod(g.paymentMethod as PaymentMethod | '' ?? '')
    setPayRef(g.paymentReference ?? '')
    setPayErr('')
  }

  async function savePayment() {
    if (!payModal || !user) return
    const amount = Number(payAmount)
    if (!payAmount || isNaN(amount) || amount <= 0) {
      setPayErr('Please enter a valid payment amount.'); return
    }
    if (amount > payModal.outstanding) {
      setPayErr(`Amount exceeds outstanding balance of ${money(payModal.outstanding)}.`); return
    }
    setPaySaving(true); setPayErr('')
    try {
      // New total paid = previous amount paid + this payment
      const prevPaid    = payModal.amountPaid ?? 0
      const newAmtPaid  = prevPaid + amount

      // Update amount_paid (and optionally method/ref) on ALL rows sharing this ref#
      const { error } = await sb
        .from('transactions')
        .update({
          amount_paid:       newAmtPaid,
          payment_method:    payMethod   || payModal.paymentMethod   || null,
          payment_reference: payRef.trim() || payModal.paymentReference || null,
        })
        .eq('business_id', user.business_id)
        .eq('transaction_type', 'stock_out')
        .eq('reference_number', payModal.refNumber)

      if (error) { setPayErr(error.message); return }

      const isFullyPaid = newAmtPaid >= payModal.total
      toast.success(
        isFullyPaid ? 'Fully paid! 🎉' : 'Payment recorded!',
        isFullyPaid
          ? `${payModal.customerName}'s balance is now cleared.`
          : `${money(amount)} recorded. Remaining: ${money(payModal.total - newAmtPaid)}`
      )
      setPayModal(null)
      load()
    } finally {
      setPaySaving(false)
    }
  }

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await sb
      .from('transactions')
      .select('*, products(name,sku,unit,selling_price)')
      .eq('business_id', user.business_id)
      .eq('transaction_type', 'stock_out')
      .order('created_at', { ascending: false })
      .limit(2000)

    const rows = (data as any as Transaction[]) ?? []

    const map = new Map<string, Transaction[]>()
    for (const r of rows) {
      const key = r.reference_number || r.voucher_number || r.id
      const arr = map.get(key) ?? []
      arr.push(r)
      map.set(key, arr)
    }

    const built: CollectibleGroup[] = []
    for (const [refNumber, txs] of map.entries()) {
      const sorted      = [...txs].sort((a, b) => b.created_at.localeCompare(a.created_at))
      const first       = sorted[0]
      const total       = sorted.reduce((s, t) => s + ((t.products as any)?.selling_price ?? 0) * t.quantity, 0)
      const amountPaid  = first.amount_paid ?? null
      const outstanding = amountPaid !== null ? Math.max(0, total - amountPaid) : total

      if (outstanding <= 0) continue

      built.push({
        refNumber,
        date:             first.date_of_sale || first.created_at,
        checkedOutAt:     first.created_at,
        customerName:     first.customer_name ?? '—',
        customerPhone:    first.customer_phone ?? null,
        items:            sorted,
        total,
        amountPaid,
        outstanding,
        paymentMethod:    first.payment_method ?? null,
        paymentReference: first.payment_reference ?? null,
        stockLocation:    first.stock_location ?? null,
      })
    }

    built.sort((a, b) => a.date.localeCompare(b.date))
    setGroups(built)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // ── Derived slices ───────────────────────────────────────────────────────
  const allGroups     = groups
  const partialGroups = groups.filter(g => g.amountPaid !== null && g.amountPaid > 0)
  const noPayGroups   = groups.filter(g => g.amountPaid === null || g.amountPaid === 0)

  // Remaining Balance — rolled up per customer
  const custMap = new Map<string, CustomerBalance>()
  for (const g of groups) {
    if (!custMap.has(g.customerName)) {
      custMap.set(g.customerName, { name: g.customerName, phone: g.customerPhone, totalDue: 0, totalPaid: 0, outstanding: 0, txCount: 0 })
    }
    const c = custMap.get(g.customerName)!
    c.totalDue   += g.total
    c.totalPaid  += g.amountPaid ?? 0
    c.outstanding += g.outstanding
    c.txCount    += 1
  }
  const customers = Array.from(custMap.values()).sort((a, b) => b.outstanding - a.outstanding)

  const currentGroups = tab === 'partial' ? partialGroups : tab === 'no_payment' ? noPayGroups : allGroups
  const grandOutstanding = currentGroups.reduce((s, g) => s + g.outstanding, 0)
  const grandCollected   = currentGroups.reduce((s, g) => s + (g.amountPaid ?? 0), 0)

  const TABS: { id: Tab; label: string; count: number; color: string; activeBg: string; activeBorder: string }[] = [
    { id: 'all',        label: 'All Balances',      count: allGroups.length,     color: 'var(--teal)', activeBg: 'var(--c-teal-dim)', activeBorder: 'rgba(91,148,144,.5)' },
    { id: 'partial',    label: 'Partial Payment',   count: partialGroups.length, color: '#d97706',     activeBg: '#fef3c7',           activeBorder: '#fbbf24'            },
    { id: 'no_payment', label: 'No Payment Yet',    count: noPayGroups.length,   color: '#dc2626',     activeBg: '#fee2e2',           activeBorder: '#fca5a5'            },
    { id: 'balance',    label: 'Remaining Balance', count: customers.length,     color: 'var(--teal)',     activeBg: 'var(--c-teal-dim)',           activeBorder: 'rgba(91,148,144,.4)'            },
  ]

  return (
    <div className="anim-fade-up">
      {/* Page header */}
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>
          Outstanding Collectibles
        </h2>
        <p style={{ color: 'var(--c-text3)', fontSize: 13.5, marginTop: 3 }}>
          Transactions with unpaid or partial balances
        </p>
      </div>

      {/* ── Tab bar ── */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 24,
        borderBottom: '2px solid var(--border)',
        overflowX: 'auto',
      }}>
        {TABS.map(t => {
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setExpanded(null) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font)', fontSize: 13.5,
                fontWeight: isActive ? 800 : 600,
                color: isActive ? t.color : 'var(--c-text3)',
                background: 'transparent',
                borderBottom: `2.5px solid ${isActive ? t.color : 'transparent'}`,
                marginBottom: '-2px',
                transition: 'all .15s',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
              <span style={{
                fontSize: 11, fontWeight: 700,
                minWidth: 20, textAlign: 'center',
                padding: '1px 7px', borderRadius: 99,
                background: isActive ? t.activeBg : 'var(--bg)',
                color: isActive ? t.color : 'var(--c-text4)',
                border: `1px solid ${isActive ? t.activeBorder : 'var(--border)'}`,
                transition: 'all .15s',
              }}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── REMAINING BALANCE TAB ── */}
      {tab === 'balance' ? (
        <BalanceTab groups={groups} customers={customers} loading={loading} openPayModal={openPayModal} />
      ) : (
        /* ── ALL / PARTIAL / NO PAYMENT TABS ── */
        <>
          {!loading && currentGroups.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, marginBottom: 20 }}>
              <SummaryCard label="Balance Due"       value={money(grandOutstanding)} color="#d97706"     bg="#fef3c7"           border="#fbbf24"            icon={<AlertCircle size={18} />}  />
              <SummaryCard label="Amount Collected"  value={money(grandCollected)}   color="#16a34a"     bg="#dcfce7"           border="#86efac"            icon={<CheckCircle2 size={18} />} />
              <SummaryCard label="Open Transactions" value={String(currentGroups.length)} color="var(--teal)" bg="var(--c-teal-dim)" border="rgba(91,148,144,.3)" icon={<CreditCard size={18} />}  />
            </div>
          )}
          <TransactionList groups={currentGroups} loading={loading} expanded={expanded} setExpanded={setExpanded} custMap={custMap} openPayModal={openPayModal} />
        </>
      )}

      {/* ── Record Payment Modal ── */}
      {payModal && (
        <Modal
          title="Record Payment"
          subtitle={`${payModal.customerName} · Ref# ${payModal.refNumber}`}
          onClose={() => setPayModal(null)}
          width={440}
          icon={<Wallet size={18} />}
          iconBg="var(--c-teal-dim)"
          iconColor="var(--teal)"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setPayModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={savePayment} disabled={paySaving}>
                {paySaving ? 'Saving…' : 'Record Payment'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {payErr && <Alert msg={payErr} type="err" />}

            {/* Balance summary strip */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Total</p>
                <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>{money(payModal.total)}</p>
              </div>
              <div style={{ background: '#dcfce7', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Already Paid</p>
                <p style={{ fontWeight: 800, fontSize: 14, color: '#16a34a' }}>{money(payModal.amountPaid ?? 0)}</p>
              </div>
              <div style={{ background: '#fef3c7', borderRadius: 10, padding: '10px 12px', textAlign: 'center', border: '1.5px solid #fbbf24' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Remaining</p>
                <p style={{ fontWeight: 900, fontSize: 16, color: '#d97706' }}>{money(payModal.outstanding)}</p>
              </div>
            </div>

            <Field label="Amount Being Paid (₱)" required>
              <input
                className="input"
                type="number" min={0.01} step="0.01"
                placeholder={`Max: ${money(payModal.outstanding)}`}
                value={payAmount}
                onChange={e => { setPayAmount(e.target.value); setPayErr('') }}
                autoFocus
              />
            </Field>

            {/* Live preview of new balance */}
            {payAmount !== '' && Number(payAmount) > 0 && Number(payAmount) <= payModal.outstanding && (
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: Number(payAmount) >= payModal.outstanding ? '#dcfce7' : 'var(--c-teal-dim)',
                border: `1.5px solid ${Number(payAmount) >= payModal.outstanding ? '#86efac' : 'rgba(91,148,144,.4)'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: Number(payAmount) >= payModal.outstanding ? '#16a34a' : 'var(--teal)' }}>
                  {Number(payAmount) >= payModal.outstanding ? '✓ Fully settled!' : 'New remaining balance'}
                </span>
                <span style={{ fontSize: 15, fontWeight: 900, color: Number(payAmount) >= payModal.outstanding ? '#16a34a' : 'var(--teal)' }}>
                  {Number(payAmount) >= payModal.outstanding ? '₱0.00' : money(payModal.outstanding - Number(payAmount))}
                </span>
              </div>
            )}

            <Field label="Payment Method">
              <select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod | '')}>
                <option value="">— Select method —</option>
                {(Object.entries(PAYMENT_METHOD_LABEL) as [PaymentMethod, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>

            {payMethod && payMethod !== 'cash' && (
              <Field label="Payment Reference #" hint="GCash ref, card approval code, etc.">
                <input className="input input-mono" placeholder="Reference / approval #" value={payRef} onChange={e => setPayRef(e.target.value)} />
              </Field>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Remaining Balance Tab ─────────────────────────────────────────────────────

function BalanceTab({ groups, customers, loading, openPayModal }: {
  groups: CollectibleGroup[]
  customers: CustomerBalance[]
  loading: boolean
  openPayModal: (g: CollectibleGroup) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const totalOutstanding = customers.reduce((s, c) => s + c.outstanding, 0)
  const totalPaid        = customers.reduce((s, c) => s + c.totalPaid, 0)
  const customerGroups   = selected ? groups.filter(g => g.customerName === selected) : []
  const selectedCust     = customers.find(c => c.name === selected) ?? null

  // Build custMap from customers array for TransactionList
  const custMap = new Map<string, CustomerBalance>()
  for (const c of customers) custMap.set(c.name, c)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>

      {/* ── Left: customer list ── */}
      <div>
        {!loading && customers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            <SummaryCard label="Total Remaining Balance" value={money(totalOutstanding)} color="var(--teal)" bg="var(--c-teal-dim)" border="rgba(91,148,144,.4)" icon={<Wallet size={18} />}       />
            <SummaryCard label="Total Collected"         value={money(totalPaid)}        color="#16a34a" bg="#dcfce7" border="#86efac" icon={<CheckCircle2 size={18} />} />
          </div>
        )}

        {loading ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table"><tbody><SkeletonRows cols={2} rows={5} /></tbody></table>
          </div>
        ) : customers.length === 0 ? (
          <div className="card">
            <Empty icon={<CheckCircle2 size={38} style={{ color: '#16a34a' }} />} text="No balances" sub="All customers are paid up!" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text4)', letterSpacing: '.08em', textTransform: 'uppercase', padding: '0 4px', marginBottom: 2 }}>
              {customers.length} customer{customers.length !== 1 ? 's' : ''} with balance
            </p>
            {customers.map(c => {
              const isActive = selected === c.name
              const pct = c.totalDue > 0 ? Math.min(100, (c.totalPaid / c.totalDue) * 100) : 0
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => { setSelected(isActive ? null : c.name); setExpanded(null) }}
                  style={{
                    textAlign: 'left', padding: '12px 14px', borderRadius: 12,
                    border: `1.5px solid ${isActive ? 'rgba(91,148,144,.4)' : 'var(--border)'}`,
                    background: isActive ? 'var(--c-teal-dim)' : 'var(--c-white)',
                    cursor: 'pointer', transition: 'all .15s', outline: 'none',
                    boxShadow: isActive ? '0 2px 10px rgba(124,58,237,.12)' : 'none',
                    fontFamily: 'var(--font)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: isActive ? 'rgba(91,148,144,.18)' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={13} style={{ color: isActive ? 'var(--teal)' : 'var(--c-text4)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                      {c.phone && <p style={{ fontSize: 11, color: 'var(--c-text4)' }}>{c.phone}</p>}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: isActive ? 'rgba(91,148,144,.4)' : 'var(--bg)', color: isActive ? '#2e8b80' : 'var(--c-text4)' }}>
                      {c.txCount} tx
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total Due</p>
                      <p style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--ink)' }}>{money(c.totalDue)}</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Paid</p>
                      <p style={{ fontWeight: 800, fontSize: 12.5, color: '#16a34a' }}>{money(c.totalPaid)}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Balance</p>
                      <p style={{ fontWeight: 900, fontSize: 15, color: 'var(--teal)' }}>{money(c.outstanding)}</p>
                    </div>
                  </div>

                  <div style={{ height: 4, borderRadius: 99, background: isActive ? 'rgba(91,148,144,.18)' : 'var(--bg)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct === 0 ? '#fca5a5' : '#16a34a', borderRadius: 99, transition: 'width .4s' }} />
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--c-text4)', marginTop: 3, textAlign: 'right' }}>{Math.round(pct)}% collected</p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Right: breakdown for selected customer ── */}
      <div>
        {!selectedCust ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: '72px 20px', border: '1.5px dashed var(--border)', borderRadius: 14,
          }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={24} style={{ color: 'var(--c-text4)', opacity: .5 }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text3)' }}>Select a customer</p>
            <p style={{ fontSize: 13, color: 'var(--c-text4)', textAlign: 'center', maxWidth: 280 }}>
              Click any customer on the left to see their full remaining balance breakdown.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Customer summary header */}
            <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--c-teal-dim)', border: '1.5px solid rgba(91,148,144,.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(91,148,144,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={20} style={{ color: 'var(--teal)' }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 900, fontSize: 16, color: '#2e8b80' }}>{selectedCust.name}</p>
                    {selectedCust.phone && (
                      <p style={{ fontSize: 12.5, color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={11} />{selectedCust.phone}
                      </p>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Total Due</p>
                    <p style={{ fontWeight: 900, fontSize: 17, color: '#2e8b80' }}>{money(selectedCust.totalDue)}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Paid</p>
                    <p style={{ fontWeight: 900, fontSize: 17, color: '#16a34a' }}>{money(selectedCust.totalPaid)}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Remaining</p>
                    <p style={{ fontWeight: 900, fontSize: 22, color: 'var(--teal)', letterSpacing: '-.02em' }}>{money(selectedCust.outstanding)}</p>
                  </div>
                </div>
              </div>
              {/* Overall progress */}
              <div style={{ marginTop: 12 }}>
                <div style={{ height: 6, borderRadius: 99, background: 'rgba(91,148,144,.18)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${selectedCust.totalDue > 0 ? Math.min(100, (selectedCust.totalPaid / selectedCust.totalDue) * 100) : 0}%`,
                    background: '#16a34a', borderRadius: 99, transition: 'width .4s',
                  }} />
                </div>
                <p style={{ fontSize: 11, color: 'var(--teal)', marginTop: 4, textAlign: 'right', fontWeight: 600 }}>
                  {selectedCust.totalDue > 0 ? Math.round((selectedCust.totalPaid / selectedCust.totalDue) * 100) : 0}% collected · {selectedCust.txCount} transaction{selectedCust.txCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Their individual transactions */}
            <TransactionList
              groups={customerGroups}
              loading={false}
              expanded={expanded}
              setExpanded={setExpanded}
              accentColor="var(--teal)"
              custMap={custMap}
              openPayModal={openPayModal}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared Transaction List ───────────────────────────────────────────────────

function TransactionList({ groups, loading, expanded, setExpanded, accentColor, custMap, openPayModal }: {
  groups: CollectibleGroup[]
  loading: boolean
  expanded: string | null
  setExpanded: (v: string | null) => void
  accentColor?: string
  custMap?: Map<string, CustomerBalance>
  openPayModal: (g: CollectibleGroup) => void
}) {
  if (loading) {
    return (
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="table"><tbody><SkeletonRows cols={5} rows={6} /></tbody></table>
      </div>
    )
  }
  if (groups.length === 0) {
    return (
      <div className="card">
        <Empty icon={<CheckCircle2 size={42} style={{ color: '#16a34a' }} />} text="No outstanding balances" sub="All transactions are fully paid." />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {groups.map(g => {
        const isOpen      = expanded === g.refNumber
        const paidPct     = g.total > 0 ? Math.min(100, ((g.amountPaid ?? 0) / g.total) * 100) : 0
        const isNoPayment = g.amountPaid === null || g.amountPaid === 0
        const accent      = accentColor ?? '#d97706'

        return (
          <div key={g.refNumber} className="card" style={{ overflow: 'hidden', border: `1.5px solid ${isOpen ? accent : 'var(--border)'}`, transition: 'border-color .15s' }}>

            {/* ── Card header ── */}
            <div style={{ padding: '16px 20px' }}>

              {/* Row 1: Date/Ref · Customer · Chips · Chevron */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>

                {/* Date + ref */}
                <div style={{ minWidth: 140, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <Calendar size={12} style={{ color: 'var(--c-text4)' }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{fmtDate(g.date)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Hash size={10} style={{ color: 'var(--c-text4)' }} />
                    <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--c-text4)' }}>{g.refNumber}</code>
                  </div>
                </div>

                {/* Customer */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={12} style={{ color: 'var(--c-text4)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.customerName}</span>
                  </div>
                  {g.customerPhone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                      <Phone size={11} style={{ color: 'var(--c-text4)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, color: 'var(--c-text3)' }}>{g.customerPhone}</span>
                    </div>
                  )}
                  {/* Customer total balance chip */}
                  {custMap && custMap.has(g.customerName) && custMap.get(g.customerName)!.txCount > 1 && (
                    <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--c-teal-dim)', border: '1px solid rgba(91,148,144,.4)', borderRadius: 6, padding: '3px 9px' }}>
                      <Wallet size={9} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)' }}>
                        Customer total: {money(custMap.get(g.customerName)!.outstanding)}
                      </span>
                      <span style={{ fontSize: 10.5, color: 'rgba(91,148,144,.7)' }}>
                        · {custMap.get(g.customerName)!.txCount} transactions
                      </span>
                    </div>
                  )}
                </div>

                {/* Chips */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
                  {g.paymentMethod && (
                    <span style={{ fontSize: 11.5, fontWeight: 700, background: 'var(--c-teal-dim)', color: 'var(--teal)', borderRadius: 6, padding: '3px 10px' }}>
                      {PAYMENT_METHOD_LABEL[g.paymentMethod as PaymentMethod]}
                    </span>
                  )}
                  {g.stockLocation && (
                    <span style={{ fontSize: 11.5, fontWeight: 700, background: 'var(--bg)', color: 'var(--c-text2)', borderRadius: 6, padding: '3px 10px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={10} />{STOCK_LOCATION_LABEL[g.stockLocation as StockLocation]}
                    </span>
                  )}
                  {isNoPayment
                    ? <span style={{ fontSize: 11.5, fontWeight: 800, background: '#fee2e2', color: '#dc2626', borderRadius: 6, padding: '3px 10px', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} /> No Payment
                      </span>
                    : <span style={{ fontSize: 11.5, fontWeight: 800, background: '#fef3c7', color: '#92400e', borderRadius: 6, padding: '3px 10px', border: '1px solid #fbbf24' }}>
                        Partial
                      </span>
                  }
                </div>

                {/* Expand toggle */}
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : g.refNumber)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text4)', padding: 4, flexShrink: 0, marginTop: 2 }}
                >
                  {isOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                </button>
              </div>

              {/* Row 2: Amounts + Progress + Pay button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

                {/* Amount blocks */}
                <div style={{ display: 'flex', gap: 0, flex: 1, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', minWidth: 300 }}>
                  <div style={{ flex: 1, padding: '10px 16px', background: 'var(--bg)', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Total</p>
                    <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>{money(g.total)}</p>
                  </div>
                  <div style={{ flex: 1, padding: '10px 16px', background: '#f0fdf4', borderRight: '1px solid #bbf7d0', textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Paid</p>
                    <p style={{ fontWeight: 800, fontSize: 15, color: '#16a34a' }}>{money(g.amountPaid ?? 0)}</p>
                  </div>
                  <div style={{ flex: 1, padding: '10px 16px', background: isNoPayment ? '#fff1f2' : '#fffbeb', borderLeft: `1px solid ${isNoPayment ? '#fecdd3' : '#fde68a'}`, textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: isNoPayment ? '#dc2626' : '#92400e', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Balance Due</p>
                    <p style={{ fontWeight: 900, fontSize: 17, color: accent, letterSpacing: '-.01em' }}>{money(g.outstanding)}</p>
                  </div>
                </div>

                {/* Progress + % */}
                <div style={{ minWidth: 120, flexShrink: 0 }}>
                  <div style={{ height: 6, borderRadius: 99, background: '#f3f4f6', overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: '100%', width: `${paidPct}%`, background: paidPct === 0 ? '#fca5a5' : '#16a34a', borderRadius: 99, transition: 'width .4s ease' }} />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--c-text4)', fontWeight: 600, textAlign: 'center' }}>{Math.round(paidPct)}% paid</p>
                </div>

                {/* Pay button */}
                <button
                  type="button"
                  onClick={() => openPayModal(g)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
                    background: '#5b9490', color: '#fff',
                    border: 'none', fontFamily: 'var(--font)',
                    fontSize: 13.5, fontWeight: 700,
                    boxShadow: '0 2px 10px rgba(91,148,144,.35)',
                    transition: 'all .15s',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#2e8b80'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(91,148,144,.45)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#5b9490'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(91,148,144,.35)' }}
                >
                  <Plus size={14} /> Record Payment
                </button>
              </div>
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                <div style={{ padding: '10px 18px', display: 'flex', gap: 20, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
                  <MetaChip label="Checked out" val={fmtDateTime(g.checkedOutAt)} />
                  {g.paymentReference && <MetaChip label="Payment ref" val={g.paymentReference} mono />}
                </div>

                {g.items.map((it, idx) => {
                  const price     = (it.products as any)?.selling_price ?? 0
                  const lineTotal = price * it.quantity
                  const isLast    = idx === g.items.length - 1
                  return (
                    <div key={it.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--c-white)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Package size={14} style={{ color: 'var(--c-text4)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.products?.name ?? '—'}</p>
                        {it.products?.sku && <p style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--c-text4)', marginTop: 1 }}>{it.products.sku}</p>}
                      </div>
                      <div style={{ textAlign: 'center', minWidth: 52 }}>
                        <p style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Qty</p>
                        <p style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>
                          {it.quantity}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-text3)', marginLeft: 2 }}>{it.products?.unit ?? ''}</span>
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 72 }}>
                        <p style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Unit</p>
                        <p style={{ fontSize: 12.5, color: 'var(--c-text2)', fontWeight: 600 }}>{price ? money(price) : '—'}</p>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 80 }}>
                        <p style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total</p>
                        <p style={{ fontWeight: 900, fontSize: 13.5, color: 'var(--ink)' }}>{lineTotal ? money(lineTotal) : '—'}</p>
                      </div>
                    </div>
                  )
                })}

                <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, background: 'var(--c-white)' }}>
                  {/* Customer total balance — left side */}
                  {custMap && custMap.has(g.customerName) && custMap.get(g.customerName)!.txCount > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--c-teal-dim)', border: '1px solid rgba(91,148,144,.4)', borderRadius: 8, padding: '7px 12px' }}>
                      <Wallet size={13} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 1 }}>
                          {g.customerName}'s total remaining balance
                        </p>
                        <p style={{ fontWeight: 900, fontSize: 15, color: '#2e8b80', letterSpacing: '-.01em' }}>
                          {money(custMap.get(g.customerName)!.outstanding)}
                          <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(91,148,144,.7)', marginLeft: 6 }}>
                            across {custMap.get(g.customerName)!.txCount} transactions
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Amounts + Record Payment button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginLeft: 'auto' }}>
                    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                      <FooterAmt label="Subtotal"    val={money(g.total)}           color="var(--ink)" />
                      <FooterAmt label="Amount Paid" val={money(g.amountPaid ?? 0)} color="#16a34a"    />
                      <FooterAmt label="Balance Due" val={money(g.outstanding)}     color={accent}     bold />
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); openPayModal(g) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                        background: '#5b9490', color: '#fff',
                        border: 'none', fontFamily: 'var(--font)',
                        fontSize: 13, fontWeight: 700,
                        boxShadow: '0 2px 8px rgba(124,58,237,.25)',
                        transition: 'background .15s',
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#2e8b80')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#5b9490')}
                    >
                      <Plus size={13} /> Record Payment
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color, bg, border, icon }: {
  label: string; value: string; color: string; bg: string; border: string; icon: React.ReactNode
}) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 18, fontWeight: 900, color, letterSpacing: '-.02em' }}>{value}</p>
      </div>
    </div>
  )
}

function MetaChip({ label, val, mono = false }: { label: string; val: string; mono?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 1 }}>{label}</p>
      <p style={{ fontSize: 12.5, color: 'var(--c-text2)', fontFamily: mono ? 'var(--mono)' : 'var(--font)', fontWeight: mono ? 600 : 500 }}>{val}</p>
    </div>
  )
}

function FooterAmt({ label, val, color, bold = false }: { label: string; val: string; color: string; bold?: boolean }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: bold ? 17 : 13.5, fontWeight: bold ? 900 : 700, color }}>{val}</p>
    </div>
  )
}
