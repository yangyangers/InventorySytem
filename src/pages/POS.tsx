// ── POS (Cart-style checkout) ─────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { ShoppingCart, Plus, Trash2, Receipt, Printer, RotateCcw } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Modal, Alert, Field } from '@/components/ui'
import { Customer, Product } from '@/types'
import { BIZ, BizId, PaymentMethod, StockLocation, PAYMENT_METHOD_LABEL, STOCK_LOCATION_LABEL } from '@/types'
import { BIZ_LOGOS } from '@/lib/logos'
import { genRefNumber } from '@/lib/utils'

type CartRow = {
  product_id: string
  name: string
  unit: string
  selling_price: number
  maxQty: number
  qty: number
}

function money(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number.isFinite(n) ? n : 0)
}

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function POS() {
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  const [customerId, setCustomerId] = useState<string>('')
  const customer = useMemo(() => customers.find(c => c.id === customerId) || null, [customers, customerId])

  const [voucher, setVoucher] = useState<string>(genRefNumber())
  const [dateOfSale, setDateOfSale] = useState<string>(todayISO())

  const [search, setSearch] = useState('')
  const [pickedId, setPickedId] = useState<string>('')
  const picked = useMemo(() => products.find(p => p.id === pickedId) || null, [products, pickedId])
  const [pickedQty, setPickedQty] = useState<number>(1)

  const [cart, setCart] = useState<CartRow[]>([])

  const [discount, setDiscount] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')
  const [paymentReference, setPaymentReference] = useState<string>('')
  const [amountPaid, setAmountPaid] = useState<string>('')
  const [stockLocation, setStockLocation] = useState<StockLocation | ''>('')

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const [receiptOpen, setReceiptOpen] = useState(false)

  const biz = user ? BIZ[user.business_id as BizId] : null
  const logoSrc = user ? BIZ_LOGOS[user.business_id] : ''

  useEffect(() => {
    ;(async () => {
      if (!user) return
      setLoading(true)
      const [{ data: ps }, { data: cs }] = await Promise.all([
        sb.from('products').select('*').eq('business_id', user.business_id).eq('is_active', true).order('name'),
        sb.from('customers').select('*').eq('business_id', user.business_id).eq('is_active', true).order('name'),
      ])
      setProducts((ps as Product[]) ?? [])
      setCustomers((cs as Customer[]) ?? [])
      setLoading(false)
    })()
  }, [user])

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
  }, [products, search])

  const subTotal = useMemo(() => cart.reduce((s, r) => s + r.qty * (r.selling_price || 0), 0), [cart])
  const totalDue = useMemo(() => Math.max(0, subTotal - (discount || 0)), [subTotal, discount])
  const change   = useMemo(() => {
    const paid = amountPaid !== '' ? Number(amountPaid) : 0
    return Math.max(0, paid - totalDue)
  }, [amountPaid, totalDue])

  function addToCart() {
    setErr(''); setOk('')
    if (!picked) { setErr('Please select a product.'); return }
    const qty = Number(pickedQty)
    if (!qty || qty < 1) { setErr('Quantity must be at least 1.'); return }
    if (qty > picked.quantity) { setErr(`Only ${picked.quantity} ${picked.unit} available for ${picked.name}.`); return }
    setCart(prev => {
      const i = prev.findIndex(x => x.product_id === picked.id)
      if (i >= 0) {
        const next = [...prev]
        const nextQty = Math.min(picked.quantity, next[i].qty + qty)
        next[i] = { ...next[i], qty: nextQty, maxQty: picked.quantity }
        return next
      }
      return [...prev, {
        product_id: picked.id,
        name: picked.name,
        unit: picked.unit,
        selling_price: picked.selling_price,
        maxQty: picked.quantity,
        qty,
      }]
    })
    setPickedQty(1)
  }

  function updateQty(product_id: string, qty: number) {
    setCart(prev => prev.map(r => r.product_id === product_id
      ? { ...r, qty: Math.max(1, Math.min(r.maxQty, Math.floor(qty || 1))) }
      : r
    ))
  }

  function removeRow(product_id: string) {
    setCart(prev => prev.filter(r => r.product_id !== product_id))
  }

  function resetSale() {
    setCustomerId('')
    setVoucher(genRefNumber())
    setDateOfSale(todayISO())
    setSearch('')
    setPickedId('')
    setPickedQty(1)
    setCart([])
    setDiscount(0)
    setPaymentMethod('')
    setPaymentReference('')
    setAmountPaid('')
    setStockLocation('')
    setErr('')
    setOk('')
    setReceiptOpen(false)
  }

  function printReceipt() {
    if (!user || !customer) return

    const safeDiscount    = Math.max(0, Number(discount) || 0)
    const safeSubTotal    = subTotal
    const safeTotal       = Math.max(0, safeSubTotal - safeDiscount)
    const isWellprintOrTC = user.business_id === 'wellprint' || user.business_id === 'tcchemical'
    const safePaid        = amountPaid !== '' ? Math.max(0, Number(amountPaid) || 0) : safeTotal
    const safeChange      = Math.max(0, safePaid - safeTotal)
    const outstanding     = Math.max(0, safeTotal - safePaid)
    const pmLabel         = paymentMethod ? PAYMENT_METHOD_LABEL[paymentMethod as PaymentMethod] : ''
    const slLabel         = stockLocation ? STOCK_LOCATION_LABEL[stockLocation as StockLocation] : ''

    const lines = cart.map(r => ({
      name: r.name,
      qty: r.qty,
      unit: r.unit,
      price: r.selling_price,
      total: r.qty * (r.selling_price || 0),
    }))

    const cashier = user.full_name || user.username
    const storeName = biz?.name || 'Store'

    const w = window.open('', 'PRINT', 'height=650,width=380')
    if (!w) return

    const logoHtml = logoSrc ? `<img src="${logoSrc}" style="max-width:160px;max-height:52px;object-fit:contain;margin:0 auto 8px;display:block;" />` : ''

    w.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,"Liberation Mono","Courier New", monospace; padding:14px;}
            .c{text-align:center}
            .muted{opacity:.7}
            .hr{border-top:1px dashed #999; margin:10px 0}
            table{width:100%; border-collapse:collapse; font-size:12px}
            td{padding:4px 0; vertical-align:top}
            .r{text-align:right}
            .b{font-weight:700}
            .small{font-size:11px}
            .outstanding{background:#fef3c7;border:1px dashed #d97706;padding:6px 8px;border-radius:6px;margin-top:6px;}
          </style>
        </head>
        <body>
          <div class="c">
            ${logoHtml}
            <div class="b">${storeName}</div>
            <div class="small muted">POS Receipt</div>
          </div>
          <div class="hr"></div>
          <div class="small">
            <div><span class="muted">Ref #:</span> <span class="b">${voucher}</span></div>
            <div><span class="muted">Date:</span> ${new Date(dateOfSale).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' })}</div>
            <div><span class="muted">Customer:</span> ${customer.name}</div>
            ${customer.phone ? `<div><span class="muted">Phone:</span> ${customer.phone}</div>` : ''}
            <div><span class="muted">Cashier:</span> ${cashier}</div>
            ${isWellprintOrTC && slLabel ? `<div><span class="muted">Location:</span> ${slLabel}</div>` : ''}
          </div>
          <div class="hr"></div>
          <table>
            ${lines.map(l => `
              <tr>
                <td>
                  <div class="b">${l.name}</div>
                  <div class="small muted">${l.qty} ${l.unit} × ${money(l.price)}</div>
                </td>
                <td class="r b">${money(l.total)}</td>
              </tr>
            `).join('')}
          </table>
          <div class="hr"></div>
          <table>
            <tr><td class="muted">Subtotal</td><td class="r">${money(safeSubTotal)}</td></tr>
            <tr><td class="muted">Discount</td><td class="r">-${money(safeDiscount)}</td></tr>
            <tr><td class="b">Total</td><td class="r b">${money(safeTotal)}</td></tr>
            <tr><td class="muted">Amount Paid</td><td class="r">${money(safePaid)}</td></tr>
            <tr><td class="muted">Change</td><td class="r">${money(safeChange)}</td></tr>
            ${pmLabel ? `<tr><td class="muted">Method</td><td class="r">${pmLabel}${paymentReference ? ' · ' + paymentReference : ''}</td></tr>` : ''}
          </table>
          ${outstanding > 0 ? `<div class="outstanding small"><span class="b">⚠ Remaining Balance: ${money(outstanding)}</span></div>` : ''}
          <div class="hr"></div>
          <div class="c small muted">Thank you!</div>
        </body>
      </html>
    `)
    w.document.close()
    w.focus()
    w.print()
    w.close()
  }

  async function checkout() {
    if (!user) return
    setErr(''); setOk('')
    if (!customer) { setErr('Please select a customer.'); return }
    if (!voucher.trim()) { setErr('Reference number is required.'); return }
    if (!dateOfSale) { setErr('Date of sale is required.'); return }
    if (cart.length === 0) { setErr('Cart is empty. Add at least one product.'); return }

    setSaving(true)
    try {
      // Re-check stock from latest product list (lightweight safety)
      const ids = cart.map(r => r.product_id)
      const { data: latest } = await sb
        .from('products')
        .select('id, quantity, unit, name')
        .eq('business_id', user.business_id)
        .in('id', ids)

      const latestMap = new Map<string, any>((latest as any[] || []).map(p => [p.id, p]))
      for (const row of cart) {
        const lp = latestMap.get(row.product_id)
        const available = Number(lp?.quantity ?? row.maxQty)
        if (row.qty > available) {
          setErr(`Not enough stock for ${lp?.name ?? row.name}. Available: ${available} ${lp?.unit ?? row.unit}.`)
          setSaving(false)
          return
        }
      }

      // Insert all stock_out transactions in one call
      const isWellprintOrTC = user.business_id === 'wellprint' || user.business_id === 'tcchemical'
      const txPayload = cart.map(r => ({
        product_id: r.product_id,
        business_id: user.business_id,
        transaction_type: 'stock_out',
        quantity: r.qty,
        reference_number: voucher.trim(),
        notes: null,
        performed_by: user.id,
        voucher_number: null,
        date_of_sale: dateOfSale,
        customer_name: customer.name,
        customer_phone: customer.phone || null,
        payment_method: isWellprintOrTC ? (paymentMethod || null) : null,
        payment_reference: isWellprintOrTC ? (paymentReference.trim() || null) : null,
        amount_paid: isWellprintOrTC ? (amountPaid !== '' ? Number(amountPaid) : null) : null,
        stock_location: isWellprintOrTC ? (stockLocation || null) : null,
      }))
      const { error: txErr } = await sb.from('transactions').insert(txPayload)
      if (txErr) { setErr(txErr.message); return }

      // Update product quantities
      for (const row of cart) {
        const lp = latestMap.get(row.product_id)
        const available = Number(lp?.quantity ?? row.maxQty)
        const newQty = Math.max(0, available - row.qty)
        const { error: upErr } = await sb.from('products')
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq('id', row.product_id)
        if (upErr) {
          // Transactions are already inserted; report clearly.
          setErr(`Sale recorded but failed updating stock for ${lp?.name ?? row.name}: ${upErr.message}`)
          return
        }
      }

      setOk('Checkout successful! You can print the receipt now.')
      // Refresh product list so next sale has updated stock
      const { data: ps } = await sb.from('products').select('*').eq('business_id', user.business_id).eq('is_active', true).order('name')
      setProducts((ps as Product[]) ?? [])
      setReceiptOpen(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="anim-fade-up">
      <div className="section-head">
        <div>
          <h2 className="page-title">POS</h2>
          <p className="page-sub">Cart-style checkout: add items, then checkout once.</p>
        </div>
        <button className="btn btn-secondary" onClick={resetSale} title="New sale">
          <RotateCcw size={15} /> New Sale
        </button>
      </div>

      {err && <Alert msg={err} type="err" />}
      {ok  && <Alert msg={ok}  type="ok"  />}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Left: Customer + Cart */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--c-gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={18} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <p style={{ fontWeight: 800, color: 'var(--ink)', fontSize: 15 }}>Sale Details</p>
              <p style={{ color: 'var(--c-text3)', fontSize: 12.5 }}>Customer, reference number, date</p>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: 14 }}>
            <Field label="Customer" required>
              <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)} disabled={loading}>
                <option value="">— Select customer —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Date of Sale" required>
              <input className="input" type="date" value={dateOfSale} onChange={e => setDateOfSale(e.target.value)} />
            </Field>
          </div>

          <div className="grid-2" style={{ marginBottom: 14 }}>
            <Field label="Reference Number" required hint="One reference number per checkout. All items share the same ref.">
              <input className="input input-mono" value={voucher} onChange={e => setVoucher(e.target.value)} placeholder="REF-YYYYMMDD-0001" />
            </Field>
            <Field label=" " hint=" ">
              <button className="btn btn-secondary" type="button" onClick={() => setVoucher(genRefNumber())} style={{ width: '100%' }}>
                <Receipt size={15} /> Generate
              </button>
            </Field>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 2 }}>
            <p style={{ fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>Add item</p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder="Search product by name or SKU…" value={search} onChange={e => setSearch(e.target.value)} />
              <select className="input" style={{ minWidth: 260, flex: 1 }} value={pickedId} onChange={e => setPickedId(e.target.value)} disabled={loading}>
                <option value="">— Select product —</option>
                {filteredProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) • {p.quantity} {p.unit} left
                  </option>
                ))}
              </select>
              <input className="input" style={{ width: 110 }} type="number" min={1} value={pickedQty} onChange={e => setPickedQty(parseInt(e.target.value || '1', 10))} />
              <button className="btn btn-primary" type="button" onClick={addToCart} disabled={!pickedId}>
                <Plus size={15} /> Add
              </button>
            </div>

            <div style={{ marginTop: 14, overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ width: 120 }}>Qty</th>
                    <th style={{ width: 120 }}>Price</th>
                    <th style={{ width: 120 }}>Line</th>
                    <th style={{ width: 70, textAlign: 'right' }}> </th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 18, color: 'var(--c-text3)' }}>Cart is empty.</td></tr>
                  ) : cart.map(r => (
                    <tr key={r.product_id} className="pos-cart-row">
                      <td>
                        <p style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13.5 }}>{r.name}</p>
                        <p style={{ fontSize: 11.5, color: 'var(--c-text3)' }}>{r.maxQty} {r.unit} available</p>
                      </td>
                      <td>
                        <input className="input" type="number" min={1} max={r.maxQty} value={r.qty}
                          onChange={e => updateQty(r.product_id, parseInt(e.target.value || '1', 10))}
                        />
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{money(r.selling_price || 0)}</td>
                      <td style={{ fontWeight: 800, color: 'var(--ink)' }}>{money(r.qty * (r.selling_price || 0))}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-icon danger" title="Remove" onClick={() => removeRow(r.product_id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: totals + checkout */}
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>Totals</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--c-text2)' }}>
              <span>Subtotal</span><b style={{ color: 'var(--ink)' }}>{money(subTotal)}</b>
            </div>
            <Field label="Discount (₱)">
              <input className="input" type="number" min={0} step="0.01" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <span style={{ fontWeight: 800, color: 'var(--c-text2)' }}>Total Due</span>
              <span style={{ fontWeight: 900, color: 'var(--ink)', fontSize: 18 }}>{money(totalDue)}</span>
            </div>

            <Field label="Amount Paid (₱)" hint="Leave blank if paying in full">
              <input className="input" type="number" min={0} step="0.01" placeholder="0.00" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
            </Field>

            {/* Change */}
            {amountPaid !== '' && change > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--c-text2)' }}>
                <span>Change</span><b style={{ color: 'var(--ink)' }}>{money(change)}</b>
              </div>
            )}

            {/* Remaining balance warning */}
            {amountPaid !== '' && Number(amountPaid) < totalDue && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, border: '1.5px solid #fbbf24', background: '#fef3c7' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>Remaining Balance</span>
                <span style={{ fontWeight: 900, fontSize: 13, color: '#92400e' }}>{money(totalDue - Number(amountPaid))}</span>
              </div>
            )}

            {(user?.business_id === 'wellprint' || user?.business_id === 'tcchemical') && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8 }}>Payment Details</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Field label="Payment Method">
                    <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod | '')}>
                      <option value="">— Select method —</option>
                      {(Object.entries(PAYMENT_METHOD_LABEL) as [PaymentMethod, string][]).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </Field>
                  {paymentMethod && paymentMethod !== 'cash' && (
                    <Field label="Payment Reference #" hint="GCash ref, card approval code, etc.">
                      <input className="input input-mono" placeholder="Reference / approval #" value={paymentReference} onChange={e => setPaymentReference(e.target.value)} />
                    </Field>
                  )}
                  <Field label="Stock Location">
                    <select className="input" value={stockLocation} onChange={e => setStockLocation(e.target.value as StockLocation | '')}>
                      <option value="">— Select location —</option>
                      {(Object.entries(STOCK_LOCATION_LABEL) as [StockLocation, string][]).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            )}

            <button className="btn btn-primary" onClick={checkout} disabled={saving || loading} style={{ width: '100%', marginTop: 4 }}>
              {saving ? 'Checking out…' : 'Checkout'}
            </button>

            <button className="btn btn-secondary" onClick={() => setReceiptOpen(true)} disabled={!ok || cart.length === 0} style={{ width: '100%' }}>
              <Printer size={15} /> Print Receipt
            </button>
          </div>
        </div>
      </div>

      {receiptOpen && customer && (
        <Modal
          title="Receipt Preview"
          subtitle="Print this like a POS receipt"
          onClose={() => setReceiptOpen(false)}
          width={460}
          icon={<Receipt size={18} />}
          iconBg="var(--c-teal-dim)"
          iconColor="var(--teal)"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setReceiptOpen(false)}>Close</button>
              <button className="btn btn-primary" onClick={printReceipt}><Printer size={15} /> Print</button>
            </>
          }
        >
          <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: 14, fontFamily: 'var(--mono)' }}>
            <div style={{ textAlign: 'center' }}>
              {logoSrc && <img src={logoSrc} alt="logo" style={{ maxHeight: 54, maxWidth: '85%', objectFit: 'contain', margin: '0 auto 10px', display: 'block' }} />}
              <p style={{ fontWeight: 900, fontSize: 14 }}>{biz?.name || 'Store'}</p>
              <p style={{ fontSize: 11.5, color: 'var(--c-text3)' }}>POS Receipt</p>
            </div>
            <div style={{ borderTop: '1px dashed var(--border)', margin: '10px 0' }} />
            <p style={{ fontSize: 11.5 }}><span style={{ color: 'var(--c-text3)' }}>Ref #:</span> <b>{voucher}</b></p>
            <p style={{ fontSize: 11.5 }}><span style={{ color: 'var(--c-text3)' }}>Date:</span> {new Date(dateOfSale).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' })}</p>
            <p style={{ fontSize: 11.5 }}><span style={{ color: 'var(--c-text3)' }}>Customer:</span> {customer.name}</p>
            {customer.phone && <p style={{ fontSize: 11.5 }}><span style={{ color: 'var(--c-text3)' }}>Phone:</span> {customer.phone}</p>}
            <p style={{ fontSize: 11.5 }}><span style={{ color: 'var(--c-text3)' }}>Cashier:</span> {user?.full_name || user?.username}</p>

            <div style={{ borderTop: '1px dashed var(--border)', margin: '10px 0' }} />

            {cart.map(r => (
              <div key={r.product_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 800, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--c-text3)' }}>{r.qty} {r.unit} × {money(r.selling_price || 0)}</p>
                </div>
                <p style={{ fontWeight: 900, fontSize: 12.5 }}>{money(r.qty * (r.selling_price || 0))}</p>
              </div>
            ))}

            <div style={{ borderTop: '1px dashed var(--border)', margin: '10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}><span style={{ color: 'var(--c-text3)' }}>Subtotal</span><b>{money(subTotal)}</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}><span style={{ color: 'var(--c-text3)' }}>Discount</span><b>-{money(discount || 0)}</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ fontWeight: 900 }}>Total</span><span style={{ fontWeight: 900 }}>{money(totalDue)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}><span style={{ color: 'var(--c-text3)' }}>Amount Paid</span><b>{amountPaid !== '' ? money(Number(amountPaid)) : money(totalDue)}</b></div>
            {change > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}><span style={{ color: 'var(--c-text3)' }}>Change</span><b>{money(change)}</b></div>}
            {amountPaid !== '' && Number(amountPaid) < totalDue && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4, padding: '5px 8px', borderRadius: 7, background: '#fef3c7', border: '1px solid #fbbf24' }}>
                <span style={{ fontWeight: 700, color: '#92400e' }}>Remaining Balance</span>
                <b style={{ color: '#92400e' }}>{money(totalDue - Number(amountPaid))}</b>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
