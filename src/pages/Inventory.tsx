import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, ArrowLeftRight, X, ChevronLeft, ChevronRight, Package, Filter } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Product, Category, Supplier, Customer, UNITS } from '@/types'
import { php, stockBadge } from '@/lib/utils'
import { Modal, Alert, Field, SkeletonRows, Empty, Confirm } from '@/components/ui'

// ── Stock Level Bar ──────────────────────────────────────────────────────────
const stockBarStyles = `
  @keyframes sb-blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
  .sb-blink { animation: sb-blink 1.2s ease-in-out infinite; }
`

function StockBar({ quantity, reorderLevel }: { quantity: number; reorderLevel: number }) {
  const isOut = quantity === 0
  const isLow = !isOut && quantity <= reorderLevel

  const maxDisplay = Math.max(reorderLevel * 2, quantity)
  const fillPct    = isOut ? 0 : Math.min((quantity / maxDisplay) * 100, 100)

  const color     = isOut ? '#f87171' : isLow ? '#fbbf24' : '#4ade80'
  const colorDark = isOut ? '#dc2626' : isLow ? '#d97706' : '#16a34a'
  const track     = isOut ? '#fee2e2' : isLow ? '#fef3c7' : '#dcfce7'
  const label     = isOut ? 'Out of stock' : isLow ? 'Low stock' : 'In stock'
  const statusTxt = isOut ? 'Empty' : isLow ? 'Low' : 'In Stock'

  return (
    <>
      <style>{stockBarStyles}</style>
      <div title={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        {/* Pill track */}
        <div style={{
          width: 14, height: 52, borderRadius: 99,
          background: track, overflow: 'hidden',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <div
            className={isOut ? 'sb-blink' : undefined}
            style={{
              width: '100%',
              height: isOut ? '100%' : `${fillPct}%`,
              minHeight: isOut ? 0 : 6,
              background: `linear-gradient(to top, ${colorDark}, ${color})`,
              borderRadius: 99,
              transition: 'height 0.5s ease',
            }}
          />
        </div>
        {/* Label */}
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: colorDark,
          whiteSpace: 'nowrap',
          letterSpacing: '0.01em',
        }}>
          {statusTxt}
        </span>
      </div>
    </>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

const BLANK = { sku:'', name:'', description:'', category_id:'', supplier_id:'', unit:'pcs', quantity:0, reorder_level:10, cost_price:0, selling_price:0 }
const BLANK_TX = { type: 'stock_in' as 'stock_in'|'stock_out'|'adjustment', qty:1, ref:'', notes:'', voucher:'', date_of_sale:'', customer_name:'', customer_phone:'' }

export default function Inventory() {
  const { user } = useAuth()
  const [rows, setRows]       = useState<Product[]>([])
  const [cats, setCats]       = useState<Category[]>([])
  const [sups, setSups]       = useState<Supplier[]>([])
  const [custs, setCusts]     = useState<Customer[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [catF, setCatF]       = useState('')
  const [stockF, setStockF]   = useState('')
  const [loading, setLoading] = useState(true)

  const [modal, setModal]       = useState<'add'|'edit'|null>(null)
  const [txModal, setTxModal]   = useState(false)
  const [delItem, setDelItem]   = useState<Product|null>(null)
  const [selected, setSelected] = useState<Product|null>(null)
  const [form, setForm]         = useState({ ...BLANK })
  const [tx, setTx]             = useState({ ...BLANK_TX })
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')
  const [ok, setOk]             = useState('')
  const PER = 20

  const loadMeta = useCallback(async () => {
    if (!user) return
    const [c, s, cu] = await Promise.all([
      sb.from('categories').select('*').eq('business_id', user.business_id).order('name'),
      sb.from('suppliers').select('*').eq('business_id', user.business_id).eq('is_active', true).order('name'),
      sb.from('customers').select('*').eq('business_id', user.business_id).eq('is_active', true).order('name'),
    ])
    setCats(c.data as Category[] ?? [])
    setSups(s.data as Supplier[] ?? [])
    setCusts(cu.data as Customer[] ?? [])
  }, [user])

  const loadRows = useCallback(async () => {
    if (!user) return
    setLoading(true)
    let q = sb.from('products')
      .select('*, categories(name), suppliers(name)', { count: 'exact' })
      .eq('business_id', user.business_id).eq('is_active', true)
      .order('name').range((page-1)*PER, page*PER-1)
    if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
    if (catF)   q = q.eq('category_id', catF)
    if (stockF === 'low') q = q.gt('quantity', 0).lte('quantity', 20)
    if (stockF === 'out') q = q.eq('quantity', 0)
    if (stockF === 'ok')  q = q.gt('quantity', 20)
    const { data, count } = await q
    setRows(data as Product[] ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [user, page, search, catF, stockF])

  useEffect(() => { loadMeta() }, [loadMeta])
  useEffect(() => { loadRows() }, [loadRows])

  function openAdd()  { setForm({ ...BLANK }); setErr(''); setOk(''); setModal('add') }
  function openEdit(p: Product) {
    setSelected(p)
    setForm({ sku:p.sku, name:p.name, description:p.description??'', category_id:p.category_id??'', supplier_id:p.supplier_id??'', unit:p.unit, quantity:p.quantity, reorder_level:p.reorder_level, cost_price:p.cost_price, selling_price:p.selling_price })
    setErr(''); setOk(''); setModal('edit')
  }
  function openTx(p: Product) { setSelected(p); setTx({ ...BLANK_TX }); setErr(''); setTxModal(true) }
  function closeAll() { setModal(null); setTxModal(false); setDelItem(null); setSelected(null); setErr(''); setOk('') }
  function f(k: string, v: any) {
    const nums = ['quantity','reorder_level','cost_price','selling_price']
    setForm(p => ({ ...p, [k]: nums.includes(k) ? (parseFloat(v)||0) : v }))
  }

  async function saveProd(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr(''); setOk('')
    try {
      const payload = { ...form, business_id: user!.business_id, is_active:true, category_id: form.category_id||null, supplier_id: form.supplier_id||null, updated_at: new Date().toISOString() }
      if (modal === 'add') {
        const { data: created, error } = await sb.from('products').insert(payload).select('id').single()
        if (error) { setErr(error.message.includes('unique') ? 'SKU already exists for this business.' : error.message); return }
        if (form.quantity > 0 && created) {
          await sb.from('transactions').insert({ product_id: created.id, business_id: user!.business_id, transaction_type: 'stock_in', quantity: form.quantity, reference_number: 'INITIAL', notes: 'Initial stock entry', performed_by: user!.id })
        }
        setOk('Product added successfully!')
      } else {
        const { error } = await sb.from('products').update(payload).eq('id', selected!.id)
        if (error) { setErr(error.message); return }
        setOk('Product updated successfully!')
      }
      setTimeout(closeAll, 1000); loadRows()
    } finally { setSaving(false) }
  }

  async function saveTx(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr(''); setOk('')
    try {
      const p = selected!; const qty = Number(tx.qty)
      if (!qty || qty < 1) { setErr('Quantity must be at least 1'); return }
      let newQty = p.quantity
      if (tx.type === 'stock_in')       newQty += qty
      else if (tx.type === 'stock_out') { if (qty > p.quantity) { setErr(`Only ${p.quantity} ${p.unit} available`); return }; newQty -= qty }
      else                               newQty = qty
      const isOut = tx.type === 'stock_out'
      const { error } = await sb.from('transactions').insert({
        product_id: p.id, business_id: user!.business_id,
        transaction_type: tx.type, quantity: qty,
        reference_number: tx.ref||null, notes: tx.notes||null,
        performed_by: user!.id,
        voucher_number: isOut ? (tx.voucher||null) : null,
        date_of_sale: isOut ? (tx.date_of_sale||null) : null,
        customer_name: isOut ? (tx.customer_name||null) : null,
        customer_phone: isOut ? (tx.customer_phone||null) : null,
      })
      if (error) { setErr(error.message); return }
      await sb.from('products').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', p.id)
      setOk(`Done! New quantity: ${newQty} ${p.unit}`)
      setTimeout(closeAll, 1000); loadRows()
    } finally { setSaving(false) }
  }

  async function archiveProd() {
    if (!delItem) return
    await sb.from('products').update({ is_active: false }).eq('id', delItem.id)
    closeAll(); loadRows()
  }

  const pages = Math.ceil(total / PER)

  const TX_OPTS = [
    { t: 'stock_in'   as const, label: '▲ Stock In',   color: 'var(--green)', bg: 'var(--c-green-dim)', border: 'var(--green)' },
    { t: 'stock_out'  as const, label: '▼ Stock Out',  color: 'var(--red)',   bg: 'var(--c-red-dim)',   border: 'var(--red)'   },
    { t: 'adjustment' as const, label: '⊙ Adjust',     color: 'var(--teal)',  bg: 'var(--c-teal-dim)',  border: 'var(--teal)'  },
  ]

  return (
    <div className="anim-fade-up">
      {/* Header */}
      <div className="section-head">
        <div>
          <h2 className="page-title">Inventory</h2>
          <p className="page-sub">{loading ? 'Loading…' : `${total} products found`}</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={15} /> Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 220 }}>
          <Search size={14} className="si" />
          <input className="input" placeholder="Search by name or SKU…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          {search && <button className="search-clear" onClick={() => setSearch('')}><X size={11} /></button>}
        </div>
        <select className="input" style={{ width: 190 }} value={catF} onChange={e => { setCatF(e.target.value); setPage(1) }}>
          <option value="">All Categories</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" style={{ width: 145 }} value={stockF} onChange={e => { setStockF(e.target.value); setPage(1) }}>
          <option value="">All Status</option>
          <option value="ok">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
        {(search || catF || stockF) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setCatF(''); setStockF(''); setPage(1) }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Product</th><th>SKU</th><th>Category</th><th>Supplier</th>
                <th>Stock</th><th style={{ textAlign: 'center' }}>Status</th><th>Cost</th><th>Selling Price</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <SkeletonRows cols={9} rows={8} />
                : rows.length === 0
                ? <tr><td colSpan={9}>
                    <Empty icon={<Package size={42} />} text="No products found" sub="Try adjusting your filters or add a new product." />
                  </td></tr>
                : rows.map(p => {
                  return (
                    <tr key={p.id}>
                      <td style={{ maxWidth: 220 }}>
                        <p style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 14 }}>{p.name}</p>
                        {p.description && <p style={{ fontSize: 11.5, color: 'var(--c-text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{p.description}</p>}
                      </td>
                      <td><code className="mono badge badge-navy" style={{ fontSize: 11.5, borderRadius: 6, padding: '3px 8px' }}>{p.sku}</code></td>
                      <td style={{ fontSize: 13, color: 'var(--c-text2)' }}>{(p as any).categories?.name ?? <span style={{ color: 'var(--c-text4)' }}>—</span>}</td>
                      <td style={{ fontSize: 13, color: 'var(--c-text2)' }}>{(p as any).suppliers?.name ?? <span style={{ color: 'var(--c-text4)' }}>—</span>}</td>
                      <td>
                        <span style={{ fontWeight: 800, color: 'var(--ink)', fontSize: 15, fontFamily: 'var(--font-head)' }}>{p.quantity}</span>
                        <span style={{ color: 'var(--c-text3)', fontSize: 12, marginLeft: 4 }}>{p.unit}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}><StockBar quantity={p.quantity} reorderLevel={p.reorder_level} /></td>
                      <td style={{ fontSize: 13, color: 'var(--c-text2)' }}>{php(p.cost_price)}</td>
                      <td style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{php(p.selling_price)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn-icon success" title="Record transaction" onClick={() => openTx(p)} style={{ color: 'var(--green)' }}>
                            <ArrowLeftRight size={14} />
                          </button>
                          <button className="btn-icon" title="Edit" onClick={() => openEdit(p)}>
                            <Edit2 size={14} />
                          </button>
                          {user?.role === 'admin' && (
                            <button className="btn-icon danger" title="Archive" onClick={() => setDelItem(p)}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
            <p style={{ fontSize: 13, color: 'var(--c-text3)' }}>
              Showing {(page-1)*PER+1}–{Math.min(page*PER, total)} of <strong>{total}</strong>
            </p>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage(p=>p-1)} disabled={page===1}><ChevronLeft size={14}/></button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => i+1).map(n => (
                <button key={n} onClick={() => setPage(n)} className={`btn btn-sm ${page===n ? 'btn-primary' : 'btn-secondary'}`} style={{ minWidth: 34 }}>{n}</button>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={() => setPage(p=>p+1)} disabled={page>=pages}><ChevronRight size={14}/></button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {modal && (
        <Modal
          title={modal === 'add' ? 'Add New Product' : 'Edit Product'}
          subtitle={modal === 'edit' ? `Editing: ${selected?.name}` : 'Fill in the product details below'}
          onClose={closeAll}
          width={560}
          icon={<Package size={20} />}
          iconBg="var(--c-gold-dim)"
          iconColor="var(--gold)"
          footer={
            <>
              <button className="btn btn-secondary" onClick={closeAll}>Cancel</button>
              <button className="btn btn-primary" onClick={saveProd as any} disabled={saving}>
                {saving ? 'Saving…' : modal === 'add' ? 'Add Product' : 'Save Changes'}
              </button>
            </>
          }
        >
          <form onSubmit={saveProd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {err && <Alert msg={err} type="err" />}
            {ok  && <Alert msg={ok}  type="ok"  />}
            <div className="grid-2">
              <Field label="SKU" required>
                <input className="input input-mono" required value={form.sku} onChange={e => f('sku', e.target.value)} placeholder="WB-001" />
              </Field>
              <Field label="Unit" required>
                <select className="input" value={form.unit} onChange={e => f('unit', e.target.value)}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Product Name" required>
              <input className="input" required value={form.name} onChange={e => f('name', e.target.value)} placeholder="Full product name" />
            </Field>
            <Field label="Description">
              <textarea className="input" rows={2} value={form.description} onChange={e => f('description', e.target.value)} placeholder="Optional description…" />
            </Field>
            <div className="grid-2">
              <Field label="Category">
                <select className="input" value={form.category_id} onChange={e => f('category_id', e.target.value)}>
                  <option value="">— Select category —</option>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Supplier">
                <select className="input" value={form.supplier_id} onChange={e => f('supplier_id', e.target.value)}>
                  <option value="">— Select supplier —</option>
                  {sups.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid-2">
              {modal === 'add' && (
                <Field label="Initial Quantity" hint="A Stock In transaction will be recorded automatically">
                  <input className="input" type="number" min={0} value={form.quantity} onChange={e => f('quantity', e.target.value)} />
                </Field>
              )}
              <Field label="Reorder Level" hint="Alert threshold for low stock">
                <input className="input" type="number" min={0} value={form.reorder_level} onChange={e => f('reorder_level', e.target.value)} />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Cost Price (₱)">
                <input className="input" type="number" min={0} step="0.01" value={form.cost_price} onChange={e => f('cost_price', e.target.value)} />
              </Field>
              <Field label="Selling Price (₱)">
                <input className="input" type="number" min={0} step="0.01" value={form.selling_price} onChange={e => f('selling_price', e.target.value)} />
              </Field>
            </div>
          </form>
        </Modal>
      )}

      {/* Transaction Modal */}
      {txModal && selected && (
        <Modal
          title="Record Stock Movement"
          subtitle={`${selected.name} · ${selected.quantity} ${selected.unit} in stock`}
          onClose={closeAll}
          width={460}
          icon={<ArrowLeftRight size={20} />}
          iconBg="var(--c-green-dim)"
          iconColor="var(--green)"
          footer={
            <>
              <button className="btn btn-secondary" onClick={closeAll}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTx as any} disabled={saving}>
                {saving ? 'Recording…' : 'Record Transaction'}
              </button>
            </>
          }
        >
          <form onSubmit={saveTx} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {err && <Alert msg={err} type="err" />}
            {ok  && <Alert msg={ok}  type="ok"  />}

            <Field label="Movement Type" required>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
                {TX_OPTS.map(({ t, label, color, bg, border }) => (
                  <button key={t} type="button" onClick={() => setTx(p => ({ ...p, type: t }))}
                    style={{
                      padding: '12px 8px', borderRadius: 'var(--radius)',
                      border: "2px solid " + (tx.type === t ? border : "var(--border)"),
                      background: tx.type === t ? bg : 'var(--c-white)',
                      color: tx.type === t ? color : 'var(--c-text3)',
                      fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                      transition: 'all .18s', fontFamily: 'var(--font)',
                      textAlign: 'center', lineHeight: 1.4,
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={tx.type === 'adjustment' ? 'Set quantity to' : 'Quantity'} required>
              <input className="input" type="number" min={1} required value={tx.qty} onChange={e => setTx(p => ({ ...p, qty: Number(e.target.value) }))} />
            </Field>
            <Field label="Reference Number" hint="e.g. PO-001, DR-123, SO-456">
              <input className="input input-mono" placeholder="Optional reference…" value={tx.ref} onChange={e => setTx(p => ({ ...p, ref: e.target.value }))} />
            </Field>
            <Field label="Notes">
              <textarea className="input" rows={2} placeholder="Optional notes…" value={tx.notes} onChange={e => setTx(p => ({ ...p, notes: e.target.value }))} />
            </Field>
            {tx.type === 'stock_out' && (
              <>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: -4 }}>
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 12 }}>Sale Details</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                    <div className="grid-2">
                      <Field label="Voucher Number">
                        <input className="input input-mono" placeholder="e.g. SI-001" value={tx.voucher} onChange={e => setTx(p => ({ ...p, voucher: e.target.value }))} />
                      </Field>
                      <Field label="Date of Sale">
                        <input className="input" type="date" value={tx.date_of_sale} onChange={e => setTx(p => ({ ...p, date_of_sale: e.target.value }))} />
                      </Field>
                    </div>
                    <div className="grid-2">
                      <Field label="Customer Name">
                        <select
                          className="input"
                          value={tx.customer_name}
                          onChange={e => {
                            const name = e.target.value
                            const match = custs.find(c => c.name === name)
                            setTx(p => ({ ...p, customer_name: name, customer_phone: match?.phone ?? p.customer_phone }))
                          }}
                        >
                          <option value="">— Select customer —</option>
                          {custs.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Phone Number">
                        <input className="input" placeholder="+63 9XX XXX XXXX" value={tx.customer_phone} onChange={e => setTx(p => ({ ...p, customer_phone: e.target.value }))} />
                      </Field>
                    </div>
                  </div>
                </div>
              </>
            )}
          </form>
        </Modal>
      )}

      {/* Archive confirm */}
      {delItem && (
        <Confirm
          title="Archive Product?"
          msg={`"${delItem.name}" will be hidden from inventory. All transaction history will be kept.`}
          confirmLabel="Archive"
          onYes={archiveProd}
          onNo={closeAll}
        />
      )}
    </div>
  )
}