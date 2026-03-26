// ── POS (Cart-style checkout) ─────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [pickedQty, setPickedQty] = useState<number | ''>('')

  const [cart, setCart] = useState<CartRow[]>([])

  const [discount, setDiscount] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')
  const [paymentReference, setPaymentReference] = useState<string>('')
  const [amountPaid, setAmountPaid] = useState<string>('')
  const [stockLocation, setStockLocation] = useState<StockLocation | ''>('')

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const [checkoutSuccess, setCheckoutSuccess] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })
  const searchRef = useRef<HTMLInputElement>(null)

  const biz = user ? BIZ[user.business_id as BizId] : null
  const logoSrc = user ? BIZ_LOGOS[user.business_id] : ''

  // Close autocomplete on page scroll
  useEffect(() => {
    const pageEl = document.querySelector('.page')
    if (!pageEl) return
    const handler = () => setShowSuggestions(false)
    pageEl.addEventListener('scroll', handler, { passive: true })
    return () => pageEl.removeEventListener('scroll', handler)
  }, [])

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
    if (pickedQty === '' || !qty || qty < 1) { setErr('Please enter a quantity of at least 1.'); return }
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
    setPickedQty('')
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
    setPickedQty('')
    setCart([])
    setDiscount(0)
    setPaymentMethod('')
    setPaymentReference('')
    setAmountPaid('')
    setStockLocation('')
    setErr('')
    setOk('')
  }

  function printReceipt() {
    if (!user || !customer) return

    const safeDiscount    = Math.max(0, Number(discount) || 0)
    const safeSubTotal    = subTotal
    const safeTotal       = Math.max(0, safeSubTotal - safeDiscount)
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
            ${slLabel ? `<div><span class="muted">Location:</span> ${slLabel}</div>` : ''}
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
        .select('id, quantity, store_quantity, production_quantity, unit, name')
        .eq('business_id', user.business_id)
        .in('id', ids)

      const latestMap = new Map<string, any>((latest as any[] || []).map(p => [p.id, p]))
      for (const row of cart) {
        const lp = latestMap.get(row.product_id)
        // Check location-specific stock if a location is chosen
        const available = stockLocation === 'store'
          ? Number(lp?.store_quantity ?? lp?.quantity ?? row.maxQty)
          : stockLocation === 'production'
          ? Number(lp?.production_quantity ?? 0)
          : Number(lp?.quantity ?? row.maxQty)
        if (row.qty > available) {
          const locLabel = stockLocation ? ` in ${stockLocation}` : ''
          setErr(`Not enough stock for ${lp?.name ?? row.name}${locLabel}. Available: ${available} ${lp?.unit ?? row.unit}.`)
          setSaving(false)
          return
        }
      }

      // Insert all stock_out transactions in one call
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
        payment_method: paymentMethod || null,
        payment_reference: paymentReference.trim() || null,
        amount_paid: amountPaid !== '' ? Number(amountPaid) : totalDue,
        discount: Math.max(0, Number(discount) || 0),
        stock_location: stockLocation || null,
      }))
      const { error: txErr } = await sb.from('transactions').insert(txPayload)
      if (txErr) { setErr(txErr.message); return }

      // Update product quantities (location-aware)
      for (const row of cart) {
        const lp = latestMap.get(row.product_id)
        let updatePayload: Record<string, any> = { updated_at: new Date().toISOString() }
        if (stockLocation === 'store') {
          const cur = Number(lp?.store_quantity ?? lp?.quantity ?? row.maxQty)
          updatePayload.store_quantity = Math.max(0, cur - row.qty)
        } else if (stockLocation === 'production') {
          const cur = Number(lp?.production_quantity ?? 0)
          updatePayload.production_quantity = Math.max(0, cur - row.qty)
        } else {
          // No location specified — deduct from store first, then production
          const storeQty = Number(lp?.store_quantity ?? lp?.quantity ?? row.maxQty)
          const prodQty  = Number(lp?.production_quantity ?? 0)
          const fromStore = Math.min(row.qty, storeQty)
          const fromProd  = Math.max(0, row.qty - fromStore)
          updatePayload.store_quantity      = Math.max(0, storeQty - fromStore)
          updatePayload.production_quantity = Math.max(0, prodQty  - fromProd)
        }
        const { error: upErr } = await sb.from('products')
          .update(updatePayload)
          .eq('id', row.product_id)
        if (upErr) {
          setErr(`Sale recorded but failed updating stock for ${lp?.name ?? row.name}: ${upErr.message}`)
          return
        }
      }

      setOk('Checkout successful! You can print the receipt now.')
      setCheckoutSuccess(true)
      // Refresh product list so next sale has updated stock
      const { data: ps } = await sb.from('products').select('*').eq('business_id', user.business_id).eq('is_active', true).order('name')
      setProducts((ps as Product[]) ?? [])
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

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 2, overflow: 'visible', position: 'relative', zIndex: 50 }}>
            <p style={{ fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>Add item</p>

            {/* Search row: autocomplete + dropdown + qty + add */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start', position: 'relative', zIndex: 100 }}>
              {/* Autocomplete search */}
              <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                <input
                  ref={searchRef}
                  className="input"
                  style={{ width: '100%' }}
                  placeholder="Search by name or SKU…"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setPickedId('')
                    setShowSuggestions(true)
                    if (searchRef.current) {
                      const r = searchRef.current.getBoundingClientRect()
                      setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width })
                    }
                  }}
                  onFocus={() => {
                    if (searchRef.current) {
                      const r = searchRef.current.getBoundingClientRect()
                      setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width })
                    }
                    setShowSuggestions(true)
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  autoComplete="off"
                />
                {showSuggestions && search.trim() && filteredProducts.length > 0 && createPortal(
                  <div style={{
                    position: 'fixed',
                    top: dropdownPos.top,
                    left: dropdownPos.left,
                    width: dropdownPos.width,
                    zIndex: 99999,
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    boxShadow: '0 8px 32px rgba(0,0,0,.18)',
                    maxHeight: 240,
                    overflowY: 'auto',
                  }}>
                    {filteredProducts.map(p => (
                      <div
                        key={p.id}
                        onMouseDown={() => {
                          setPickedId(p.id)
                          setSearch(p.name)
                          setShowSuggestions(false)
                        }}
                        style={{
                          padding: '9px 14px', cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', margin: 0 }}>{p.name}</p>
                        <p style={{ fontSize: 11.5, color: 'var(--c-text3)', margin: 0 }}>{p.sku} • {p.quantity} {p.unit} left • {money(p.selling_price)}</p>
                      </div>
                    ))}
                  </div>,
                  document.body
                )}
              </div>
              {/* Dropdown fallback */}
              <select
                className="input"
                style={{ minWidth: 220, flex: 1 }}
                value={pickedId}
                onChange={e => {
                  setPickedId(e.target.value)
                  const found = products.find(p => p.id === e.target.value)
                  if (found) setSearch(found.name)
                }}
                disabled={loading}
              >
                <option value="">— Select product —</option>
                {filteredProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) • {p.quantity} {p.unit} left
                  </option>
                ))}
              </select>
              <input className="input" style={{ width: 90 }} type="number" min={1} placeholder="Qty" value={pickedQty} onChange={e => setPickedQty(e.target.value === '' ? '' : Number(e.target.value))} />
              <button className="btn btn-primary" type="button" onClick={addToCart} disabled={!pickedId}>
                <Plus size={15} /> Add
              </button>
            </div>

            <div style={{ marginTop: 14, overflowX: 'auto', position: 'relative', zIndex: 1 }}>
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
                  <Field label="Fulfil From" hint="Which location is fulfilling this sale?">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {([['', 'Auto'], ['store', 'Store'], ['production', 'Production']] as [StockLocation | '', string][]).map(([val, label]) => {
                        const isSelected = stockLocation === val
                        // Compute total available for this location across all cart items
                        const totalAvail = val === '' ? null
                          : cart.reduce((sum, row) => {
                              const prod = products.find(p => p.id === row.product_id)
                              if (!prod) return sum
                              const qty = val === 'store'
                                ? ((prod as any).store_quantity ?? prod.quantity)
                                : ((prod as any).production_quantity ?? 0)
                              return sum + qty
                            }, 0)
                        return (
                          <button key={val} type="button"
                            onClick={() => setStockLocation(val)}
                            style={{
                              padding: '10px 8px', borderRadius: 'var(--radius)', textAlign: 'center',
                              border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                              background: isSelected ? 'var(--c-primary-dim, #e8f0fe)' : 'var(--bg)',
                              cursor: 'pointer', transition: 'all .15s',
                            }}>
                            <p style={{ fontWeight: 700, fontSize: 12.5, color: isSelected ? 'var(--primary)' : 'var(--ink)' }}>{label}</p>
                            {totalAvail !== null && (
                              <p style={{ fontSize: 11, color: totalAvail === 0 ? 'var(--red)' : 'var(--c-text3)', marginTop: 2 }}>
                                {totalAvail} units
                              </p>
                            )}
                            {val === '' && <p style={{ fontSize: 10.5, color: 'var(--c-text4)', marginTop: 2 }}>Store first</p>}
                          </button>
                        )
                      })}
                    </div>
                  </Field>
                </div>
              </div>

            <button className="btn btn-primary" onClick={checkout} disabled={saving || loading} style={{ width: '100%', marginTop: 4 }}>
              {saving ? 'Checking out…' : 'Checkout'}
            </button>

          </div>
        </div>
      </div>


      {checkoutSuccess && customer && (
        <Modal
          title="Purchase Complete!"
          subtitle="The sale has been recorded successfully."
          onClose={() => setCheckoutSuccess(false)}
          width={400}
          icon={<ShoppingCart size={18} />}
          iconBg="var(--c-teal-dim)"
          iconColor="var(--teal)"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setCheckoutSuccess(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => { setCheckoutSuccess(false); printReceipt() }}>
                <Printer size={15} /> Print Receipt
              </button>
            </>
          }
        >
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>🎉</div>
            <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)', marginBottom: 6 }}>All set!</p>
            <p style={{ color: 'var(--c-text2)', fontSize: 13.5 }}>
              Sale recorded for <b>{customer.name}</b>.<br />
              Total: <b>{money(totalDue)}</b>
            </p>
          </div>
        </Modal>
      )}

    </div>
  )
}