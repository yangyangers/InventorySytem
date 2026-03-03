import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Users, Mail, Phone, MapPin, Receipt, Calendar, ShoppingBag, Package, ChevronRight, Hash } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Customer, Transaction } from '@/types'
import { Modal, Alert, Field, Confirm } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'

const BLANK = { name: '', phone: '', email: '', address: '' }

interface PurchaseGroup {
  refNumber: string
  date: string         // date_of_sale for the list date label
  checkedOutAt: string // created_at — accurate checkout timestamp
  items: Transaction[]
  total: number
}

export default function Customers() {
  const { user } = useAuth()
  const toast = useToast()
  const [items, setItems]     = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm]       = useState({ ...BLANK })
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')
  const [ok, setOk]           = useState('')
  const [delItem, setDelItem] = useState<Customer | null>(null)

  const [viewing, setViewing]           = useState<Customer | null>(null)
  const [sales, setSales]               = useState<Transaction[]>([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [activeGroup, setActiveGroup]   = useState<PurchaseGroup | null>(null)

  async function load() {
    if (!user) return
    setLoading(true)
    const { data } = await sb.from('customers').select('*')
      .eq('business_id', user.business_id).eq('is_active', true).order('name')
    setItems(data as Customer[] ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user])

  function open(c?: Customer) {
    setEditing(c ?? null)
    setForm(c ? { name: c.name, phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '' } : { ...BLANK })
    setErr(''); setOk(''); setModal(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr(''); setOk('')
    const payload = {
      ...form, business_id: user!.business_id, is_active: true,
      phone: form.phone || null, email: form.email || null,
      address: form.address || null, updated_at: new Date().toISOString(),
    }
    const { error } = editing
      ? await sb.from('customers').update(payload).eq('id', editing.id)
      : await sb.from('customers').insert(payload)
    setSaving(false)
    if (error) { setErr(error.message); return }
    toast.success(editing ? 'Customer updated!' : 'Customer added!', form.name || '')
    setModal(false); load()
  }

  async function archive() {
    if (!delItem) return
    await sb.from('customers').update({ is_active: false }).eq('id', delItem.id)
    setDelItem(null); load()
  }

  async function openHistory(c: Customer) {
    setViewing(c)
    setActiveGroup(null)
    setSales([])
    if (!user) return
    setSalesLoading(true)
    const { data } = await sb
      .from('transactions')
      .select('*, products(name,sku,unit,selling_price)')
      .eq('business_id', user.business_id)
      .eq('transaction_type', 'stock_out')
      .eq('customer_name', c.name)
      .order('created_at', { ascending: false })
      .limit(500)
    const rows = (data as any as Transaction[]) ?? []
    setSales(rows)
    const groups = buildGroups(rows)
    if (groups.length > 0) setActiveGroup(groups[0])
    setSalesLoading(false)
  }

  function buildGroups(rows: Transaction[]): PurchaseGroup[] {
    const map = new Map<string, Transaction[]>()
    for (const r of rows) {
      const key = r.reference_number || r.voucher_number || r.id
      const arr = map.get(key) ?? []
      arr.push(r)
      map.set(key, arr)
    }
    return Array.from(map.entries())
      .map(([refNumber, txs]) => {
        const sorted = [...txs].sort((a, b) => b.created_at.localeCompare(a.created_at))
        const dateRaw = sorted[0].date_of_sale || sorted[0].created_at
        const checkedOutAt = sorted[0].created_at
        const total = sorted.reduce((s, t) => s + ((t.products as any)?.selling_price ?? 0) * t.quantity, 0)
        return { refNumber, date: dateRaw, checkedOutAt, items: sorted, total }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }

  const groups = buildGroups(sales)
  const grandTotal = groups.reduce((s, g) => s + g.total, 0)

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  function fmtDateTime(iso: string) {
    return new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function money(n: number) {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
  }

  return (
    <div className="anim-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>Customers</h2>
          <p style={{ color: 'var(--c-text3)', fontSize: 13.5, marginTop: 3 }}>{items.length} active customers</p>
        </div>
        <button className="btn btn-primary" onClick={() => open()}><Plus size={15} /> Add Customer</button>
      </div>

      {loading
        ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skel" style={{ height: 160, borderRadius: 14 }} />)}
          </div>
        : items.length === 0
        ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 20px', gap: 12 }}>
            <Users size={48} style={{ color: 'var(--c-text4)', opacity: .5 }} />
            <p style={{ color: 'var(--c-text3)', fontWeight: 600 }}>No customers yet</p>
            <p style={{ fontSize: 13, color: 'var(--c-text4)' }}>Add your first customer to get started</p>
            <button className="btn btn-primary" onClick={() => open()}><Plus size={14} />Add Customer</button>
          </div>
        : <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
            {items.map(c => (
              <div key={c.id} className="card" style={{ padding: 20, cursor: 'pointer' }} onClick={() => openHistory(c)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(91,148,144,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={20} style={{ color: 'var(--teal)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon" onClick={e => { e.stopPropagation(); open(c) }}><Edit2 size={14} /></button>
                    {user?.role === 'admin' && <button className="btn-icon danger" onClick={e => { e.stopPropagation(); setDelItem(c) }}><Trash2 size={14} /></button>}
                  </div>
                </div>
                <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-.01em' }}>{c.name}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {c.phone   && <InfoRow icon={<Phone size={12} />}  val={c.phone} />}
                  {c.email   && <InfoRow icon={<Mail size={12} />}   val={c.email} />}
                  {c.address && <InfoRow icon={<MapPin size={12} />} val={c.address} />}
                </div>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--teal)', fontSize: 12.5, fontWeight: 700 }}>
                    <ShoppingBag size={13} /> Purchase history
                  </span>
                  <ChevronRight size={14} style={{ color: 'var(--c-text4)' }} />
                </div>
              </div>
            ))}
          </div>
      }

      {/* Add / Edit modal */}
      {modal && (
        <Modal title={editing ? 'Edit Customer' : 'Add Customer'} onClose={() => setModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save as any} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save' : 'Add Customer'}
            </button>
          </>}>
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {err && <Alert msg={err} type="err" />}
            {ok  && <Alert msg={ok}  type="ok"  />}
            <Field label="Customer Name" required>
              <input className="input" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name or company" />
            </Field>
            <div className="grid-2">
              <Field label="Phone">
                <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+63 9XX XXX XXXX" />
              </Field>
              <Field label="Email">
                <input className="input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
              </Field>
            </div>
            <Field label="Address">
              <textarea className="input" rows={2} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Full address" />
            </Field>
          </form>
        </Modal>
      )}

      {delItem && <Confirm msg={`Remove "${delItem.name}" from your customer list?`} onYes={archive} onNo={() => setDelItem(null)} />}

      {/* ── Purchase History Modal ── */}
      {viewing && (
        <Modal
          title="Purchase History"
          subtitle={viewing.name}
          onClose={() => setViewing(null)}
          width={860}
          icon={<ShoppingBag size={18} />}
          iconBg="rgba(91,148,144,.12)"
          iconColor="var(--teal)"
          footer={<button className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>}
        >
          {salesLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 14 }}>
              <div className="skel" style={{ height: 360, borderRadius: 14 }} />
              <div className="skel" style={{ height: 360, borderRadius: 14 }} />
            </div>
          ) : groups.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 20px', gap: 12 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingBag size={28} style={{ color: 'var(--c-text4)', opacity: .5 }} />
              </div>
              <p style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 15 }}>No purchase history</p>
              <p style={{ fontSize: 13, color: 'var(--c-text3)', textAlign: 'center', maxWidth: 340 }}>
                Transactions will appear here after a checkout is completed in POS.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 14, minHeight: 400 }}>

              {/* Left: transaction list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Summary */}
                <div style={{ padding: '10px 13px', borderRadius: 12, background: 'var(--c-teal-dim)', border: '1px solid rgba(91,148,144,.35)', marginBottom: 4 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--teal)', letterSpacing: '.07em', textTransform: 'uppercase' }}>Total spent</p>
                  <p style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)', marginTop: 2, letterSpacing: '-.01em' }}>{money(grandTotal)}</p>
                  <p style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 1 }}>{groups.length} transaction{groups.length !== 1 ? 's' : ''}</p>
                </div>

                {/* List */}
                <div style={{ overflowY: 'auto', maxHeight: 360, display: 'flex', flexDirection: 'column', gap: 5, paddingRight: 1 }}>
                  {groups.map(g => {
                    const isActive = activeGroup?.refNumber === g.refNumber
                    return (
                      <button key={g.refNumber} type="button" onClick={() => setActiveGroup(g)}
                        style={{
                          textAlign: 'left', padding: '10px 12px', borderRadius: 11,
                          border: `1.5px solid ${isActive ? 'var(--teal)' : 'var(--border)'}`,
                          background: isActive ? 'var(--c-teal-dim)' : 'var(--c-white)',
                          cursor: 'pointer', transition: 'all .14s',
                        }}>
                        {/* Date row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                          <Calendar size={11} style={{ color: isActive ? 'var(--teal)' : 'var(--c-text4)', flexShrink: 0 }} />
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', flex: 1 }}>{fmtDate(g.date)}</span>
                          <span style={{
                            fontSize: 10.5, fontWeight: 700,
                            background: isActive ? 'rgba(91,148,144,.2)' : 'var(--bg)',
                            color: isActive ? 'var(--teal)' : 'var(--c-text3)',
                            borderRadius: 5, padding: '2px 6px',
                          }}>
                            {g.items.length} item{g.items.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {/* Ref */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                          <Hash size={10} style={{ color: 'var(--c-text4)', flexShrink: 0 }} />
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--c-text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.refNumber}</span>
                        </div>
                        {/* Amount */}
                        <p style={{ fontWeight: 900, fontSize: 13, color: isActive ? 'var(--teal)' : 'var(--ink)' }}>{money(g.total)}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Right: detail */}
              {activeGroup ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  {/* Detail header */}
                  <div style={{ padding: '13px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Receipt size={14} style={{ color: 'var(--teal)' }} />
                        <span style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--ink)' }}>
                          {fmtDateTime(activeGroup.checkedOutAt)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Hash size={11} style={{ color: 'var(--c-text4)' }} />
                        <code style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--c-text3)' }}>{activeGroup.refNumber}</code>
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Product</th>
                          <th style={{ padding: '9px 14px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Qty</th>
                          <th style={{ padding: '9px 14px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Price</th>
                          <th style={{ padding: '9px 14px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeGroup.items.map((it, idx) => {
                          const price = (it.products as any)?.selling_price ?? 0
                          const lineTotal = price * it.quantity
                          return (
                            <tr key={it.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '11px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Package size={13} style={{ color: 'var(--c-text4)' }} />
                                  </div>
                                  <div>
                                    <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{it.products?.name ?? '—'}</p>
                                    {it.products?.sku && <p style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--c-text4)', marginTop: 1 }}>{it.products.sku}</p>}
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                                {it.quantity} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-text3)' }}>{it.products?.unit ?? ''}</span>
                              </td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 12.5, color: 'var(--c-text2)' }}>
                                {price ? money(price) : '—'}
                              </td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 900, fontSize: 13.5, color: 'var(--ink)' }}>
                                {lineTotal ? money(lineTotal) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Total footer */}
                  <div style={{ padding: '12px 16px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text2)' }}>Total</span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)' }}>{money(activeGroup.total)}</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1.5px dashed var(--border)', borderRadius: 14, color: 'var(--c-text4)', minHeight: 200 }}>
                  <Receipt size={28} />
                  <p style={{ fontSize: 13, fontWeight: 600 }}>Select a transaction</p>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function InfoRow({ icon, val }: { icon: React.ReactNode; val: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--c-text2)' }}>
      <span style={{ color: 'var(--c-text4)', flexShrink: 0 }}>{icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
    </div>
  )
}