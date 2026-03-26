import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Search, Edit2, Trash2, ArrowLeftRight, X, ChevronLeft, ChevronRight, Package, Filter } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Product, Category, Supplier, Customer, UNITS, WELLPRINT_UNITS, WELLBUILD_UNITS, PaymentMethod, StockLocation, PAYMENT_METHOD_LABEL, STOCK_LOCATION_LABEL } from '@/types'
import { php, stockBadge, genVoucherNumber, genRefNumber, genSkuPrefix } from '@/lib/utils'
import { Modal, Alert, Field, SkeletonRows, Empty, Confirm } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'

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
      <div title={`${label} · ${quantity} left`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <div
          style={{
            position: 'relative',
            width: 14,
            height: 52,
            borderRadius: 99,
            background: track,
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <div
            className={isOut ? 'sb-blink' : undefined}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: isOut ? '100%' : `${fillPct}%`,
              minHeight: isOut ? 0 : 6,
              background: `linear-gradient(to top, ${colorDark}, ${color})`,
              borderRadius: 99,
              transition: 'height 0.5s ease',
            }}
          />
        </div>
      </div>
    </>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

const BLANK = { sku:'', name:'', description:'', category_id:'', sub_category_id:'', supplier_id:'', unit:'pcs', quantity:'0', initial_location:'store', reorder_level:'10', cost_price:'0', selling_price:'0' }
const BLANK_TX = { type: 'stock_in' as 'stock_in'|'stock_out'|'adjustment'|'transfer', qty:1, notes:'', voucher_number:'', reference_number:'', date_of_sale:'', customer_name:'', customer_phone:'', payment_method: '' as PaymentMethod|'', payment_reference:'', amount_paid:'', stock_location:'' as StockLocation|'', transfer_from: '' as StockLocation|'', transfer_to: '' as StockLocation|'' }

export default function Inventory() {
  const { user } = useAuth()
  const toast = useToast()
  const [rows, setRows]       = useState<Product[]>([])
  const [cats, setCats]       = useState<Category[]>([])
  const [sups, setSups]       = useState<Supplier[]>([])
  const [custs, setCusts]     = useState<Customer[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [catF, setCatF]       = useState('')
  const [subCatF, setSubCatF] = useState('')
  const [stockF, setStockF]   = useState('')
  const [sortBy, setSortBy]   = useState('name_asc')
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')   // raw input value
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [modal, setModal]       = useState<'add'|'edit'|null>(null)
  const [txModal, setTxModal]   = useState(false)
  const [deleteItem, setDeleteItem] = useState<Product|null>(null)
  const [selected, setSelected] = useState<Product|null>(null)
  const [form, setForm]         = useState({ ...BLANK })
  const [tx, setTx]             = useState({ ...BLANK_TX })
  const [saving, setSaving]     = useState(false)
  const [skuLoading, setSkuLoading] = useState(false)
  const [skuIsExisting, setSkuIsExisting] = useState(false)
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

  // Use refs so loadRows doesn't get recreated on every filter change
  const filterRef = useRef({ page: 1, search: '', catF: '', stockF: '', sortBy: 'name_asc', cats: [] as Category[] })
  filterRef.current = { page, search, catF, subCatF, stockF, sortBy, cats } as any

  const loadRows = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { page: p, search: s, catF: cf, stockF: sf, sortBy: sb2, cats: c } = filterRef.current

    let orderCol = 'name', orderAsc = true
    if (sb2 === 'name_desc')   { orderCol = 'name';       orderAsc = false }
    if (sb2 === 'sku_asc')     { orderCol = 'sku';        orderAsc = true  }
    if (sb2 === 'sku_desc')    { orderCol = 'sku';        orderAsc = false }
    if (sb2 === 'latest')      { orderCol = 'created_at'; orderAsc = false }
    if (sb2 === 'oldest')      { orderCol = 'created_at'; orderAsc = true  }

    let q = sb.from('products')
      .select('*, categories(name), suppliers(name)', { count: 'exact' })
      .eq('business_id', user.business_id).eq('is_active', true)
      .order(orderCol, { ascending: orderAsc }).range((p-1)*PER, p*PER-1)
    if (s) q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%`)
    if (cf) {
      if (user?.business_id === 'wellprint') {
        const { subCatF: scf } = filterRef.current as any
        if (scf) {
          // specific sub-category selected
          q = q.eq('category_id', scf)
        } else {
          // parent selected — include parent + all its children
          const childIds = c.filter(cat => cat.parent_id === cf).map(cat => cat.id)
          q = q.in('category_id', childIds.length > 0 ? [cf, ...childIds] : [cf])
        }
      } else {
        q = q.eq('category_id', cf)
      }
    }
    if (sf === 'low') q = q.gt('quantity', 0).lte('quantity', 20)
    if (sf === 'out') q = q.eq('quantity', 0)
    if (sf === 'ok')  q = q.gt('quantity', 20)
    const { data, count } = await q
    setRows(data as Product[] ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [user])   // ← only depends on user, not every filter

  useEffect(() => { loadMeta() }, [loadMeta])
  // Re-run loadRows whenever filters change (but search uses debounce below)
  useEffect(() => { loadRows() }, [loadRows, page, catF, subCatF, stockF, sortBy])
  // Debounce search: wait 350ms after last keystroke before querying
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { loadRows() }, 350)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  // Auto-resolve SKU: look up existing product with same name in this business,
  // if found reuse its SKU, otherwise generate a new one from the prefix + DB count.
  async function resolveSkuForName(name: string): Promise<string> {
    if (!name.trim() || !user) return ''
    setSkuLoading(true)
    try {
      // 1. Check if a product with this exact name already exists in this business
      const { data: existing } = await sb.from('products')
        .select('sku')
        .eq('business_id', user.business_id)
        .ilike('name', name.trim())
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      if (existing?.sku) { setSkuIsExisting(true); return existing.sku }

      // 2. No match — derive prefix and find the next available counter
      const prefix = genSkuPrefix(name)
      const { data: withPrefix } = await sb.from('products')
        .select('sku')
        .eq('business_id', user.business_id)
        .ilike('sku', `${prefix}-%`)
        .order('sku', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (withPrefix?.sku) {
        const parts = withPrefix.sku.split('-')
        const lastNum = parseInt(parts[parts.length - 1], 10) || 0
        return `${prefix}-${String(lastNum + 1).padStart(4, '0')}`
      }
      return `${prefix}-0001`
    } finally {
      setSkuLoading(false)
    }
  }

  function openAdd()  { setForm({ ...BLANK }); setErr(''); setOk(''); setSkuIsExisting(false); setModal('add') }
  function openEdit(p: Product) {
    setSelected(p)
    // For Wellprint: if product's category is a subcategory, populate both parent + sub fields
    const catId = p.category_id ?? ''
    const catObj = cats.find(c => c.id === catId)
    const isSubCat = catObj?.parent_id ? true : false
    setForm({
      sku: p.sku, name: p.name, description: p.description??'',
      category_id: isSubCat ? (catObj?.parent_id ?? '') : catId,
      sub_category_id: isSubCat ? catId : '',
      supplier_id: p.supplier_id??'', unit: p.unit, quantity: String(p.quantity), initial_location: 'store',
      reorder_level: String(p.reorder_level), cost_price: String(p.cost_price), selling_price: String(p.selling_price)
    })
    setErr(''); setOk(''); setModal('edit')
  }
  function openTx(p: Product) {
    setSelected(p)
    // Pre-generate the appropriate number based on movement type (defaults to stock_in)
    setTx({ ...BLANK_TX, voucher_number: genVoucherNumber(), reference_number: '' })
    setErr(''); setTxModal(true)
  }
  function closeAll() { setModal(null); setTxModal(false); setSelected(null); setErr(''); setOk(''); setSkuIsExisting(false) }

  // Debounce ref — prevents firing a DB lookup on every single keystroke
  const skuDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function f(k: string, v: any) {
    setForm(p => ({ ...p, [k]: v }))
    // Auto-resolve SKU when the product name changes (add modal only)
    if (k === 'name' && modal === 'add') {
      if (skuDebounceRef.current) clearTimeout(skuDebounceRef.current)
      if (!v.trim()) { setForm(prev => ({ ...prev, sku: '' })); setSkuIsExisting(false); return }
      setSkuIsExisting(false)
      skuDebounceRef.current = setTimeout(() => {
        resolveSkuForName(v).then(sku => { if (sku) setForm(prev => ({ ...prev, sku })) })
      }, 500)
    }
  }

  async function saveProd(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr(''); setOk('')
    // Parse numeric string fields before saving
    const parsedForm = {
      ...form,
      quantity: parseFloat(form.quantity) || 0,
      reorder_level: parseFloat(form.reorder_level) || 0,
      cost_price: parseFloat(form.cost_price) || 0,
      selling_price: parseFloat(form.selling_price) || 0,
    }
    try {
      if (modal === 'add') {
        if (!parsedForm.name.trim()) { setErr('Product name is required.'); return }

        // Check if a product with this exact name already exists — if so, just add stock to it
        const { data: existing } = await sb.from('products')
          .select('id, sku, quantity, unit')
          .eq('business_id', user!.business_id)
          .ilike('name', parsedForm.name.trim())
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()

        if (existing) {
          // ── Product already exists → add stock to it (Stock In transaction) ──
          if (parsedForm.quantity > 0) {
            const newQty = existing.quantity + parsedForm.quantity
            const voucherNum = genVoucherNumber()
            const existingStore = (existing as any).store_quantity ?? existing.quantity
            await sb.from('products').update({ store_quantity: existingStore + parsedForm.quantity, updated_at: new Date().toISOString() }).eq('id', existing.id)
            await sb.from('transactions').insert({ product_id: existing.id, business_id: user!.business_id, transaction_type: 'stock_in', quantity: parsedForm.quantity, voucher_number: voucherNum, reference_number: null, notes: 'Stock added via Add Product (same name matched)', performed_by: user!.id })
            toast.success('Stock updated!', `${parsedForm.quantity} ${existing.unit} added to existing "${parsedForm.name}" (SKU: ${existing.sku})`)
          } else {
            toast.success('No quantity added.', `"${parsedForm.name}" already exists — enter a quantity to add stock.`)
          }
          closeAll(); loadRows(); return
        }

        // ── New product → generate SKU and insert ──
        const sku = await resolveSkuForName(parsedForm.name)
        if (!sku) { setErr('Could not generate SKU. Please enter a product name.'); return }
        setForm(p => ({ ...p, sku }))
        const finalCatId = (user?.business_id === 'wellprint' && parsedForm.sub_category_id) ? parsedForm.sub_category_id : (parsedForm.category_id || null)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { sub_category_id: _sc1, initial_location: _il1, ...formClean1 } = parsedForm
        const payload = { ...formClean1, sku, business_id: user!.business_id, is_active:true, category_id: finalCatId, supplier_id: parsedForm.supplier_id||null, updated_at: new Date().toISOString() }
        const { data: created, error } = await sb.from('products').insert({ ...payload }).select('id').single()
        if (error) { setErr(error.message); return }
        if (parsedForm.quantity > 0 && created) {
          const voucherNum = genVoucherNumber()
          const isStore = parsedForm.initial_location !== 'production'
          const storeQty = isStore ? parsedForm.quantity : 0
          const prodQty  = isStore ? 0 : parsedForm.quantity
          await sb.from('products').update({ store_quantity: storeQty, production_quantity: prodQty }).eq('id', created.id)
          await sb.from('transactions').insert({ product_id: created.id, business_id: user!.business_id, transaction_type: 'stock_in', quantity: parsedForm.quantity, voucher_number: voucherNum, reference_number: null, notes: 'Initial stock entry', stock_location: parsedForm.initial_location, performed_by: user!.id })
        }
        toast.success('Product added!', parsedForm.name + ' was added to inventory')

      } else {
        // ── Edit mode ──
        const finalCatId = (user?.business_id === 'wellprint' && parsedForm.sub_category_id) ? parsedForm.sub_category_id : (parsedForm.category_id || null)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { sub_category_id: _sc2, initial_location: _il2, ...formClean2 } = parsedForm
        const payload = { ...formClean2, business_id: user!.business_id, is_active:true, category_id: finalCatId, supplier_id: parsedForm.supplier_id||null, updated_at: new Date().toISOString() }
        const { error } = await sb.from('products').update(payload).eq('id', selected!.id)
        if (error) { setErr(error.message); return }
        toast.success('Product updated!', parsedForm.name + ' was saved successfully')
      }
      closeAll(); loadRows()
    } finally { setSaving(false) }
  }

  async function saveTx(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr(''); setOk('')
    try {
      const p = selected!; const qty = Number(tx.qty)
      if (!qty || qty < 1) { setErr('Quantity must be at least 1'); return }

      const isIn       = tx.type === 'stock_in'
      const isOut      = tx.type === 'stock_out'
      const isTransfer = tx.type === 'transfer'
      const isAdj      = tx.type === 'adjustment'

      let newStoreQty      = p.store_quantity ?? 0
      let newProductionQty = p.production_quantity ?? 0

      if (isTransfer) {
        // ── Transfer: move stock between locations ──
        if (!tx.transfer_from || !tx.transfer_to) { setErr('Select both From and To locations for a transfer.'); return }
        if (tx.transfer_from === tx.transfer_to)  { setErr('From and To locations must be different.'); return }
        const srcQty = tx.transfer_from === 'production' ? newProductionQty : newStoreQty
        if (qty > srcQty) { setErr(`Only ${srcQty} ${p.unit} available in ${tx.transfer_from}.`); return }
        if (tx.transfer_from === 'production') { newProductionQty -= qty; newStoreQty += qty }
        else                                   { newStoreQty -= qty; newProductionQty += qty }
      } else if (isIn) {
        // ── Stock In: add to specified location ──
        if (!tx.stock_location) { setErr('Please select a stock location.'); return }
        if (tx.stock_location === 'production') newProductionQty += qty
        else                                    newStoreQty      += qty
      } else if (isOut) {
        // ── Stock Out: deduct from specified location (or total if unspecified) ──
        if (!tx.stock_location) { setErr('Please select a stock location.'); return }
        const locQty = tx.stock_location === 'production' ? newProductionQty : newStoreQty
        if (qty > locQty) { setErr(`Only ${locQty} ${p.unit} available in ${tx.stock_location}.`); return }
        if (tx.stock_location === 'production') newProductionQty -= qty
        else                                    newStoreQty      -= qty
      } else if (isAdj) {
        // ── Adjustment: set total quantity, distributed to store ──
        if (!tx.stock_location) { setErr('Please select a stock location to adjust.'); return }
        if (tx.stock_location === 'production') newProductionQty = qty
        else                                    newStoreQty      = qty
      }

      const { error } = await sb.from('transactions').insert({
        product_id: p.id, business_id: user!.business_id,
        transaction_type: tx.type, quantity: qty,
        voucher_number:   isIn       ? (tx.voucher_number  || null) : null,
        reference_number: isOut      ? (tx.reference_number || null) : null,
        notes: tx.notes || null,
        performed_by: user!.id,
        date_of_sale:      isOut ? (tx.date_of_sale      || null) : null,
        customer_name:     isOut ? (tx.customer_name      || null) : null,
        customer_phone:    isOut ? (tx.customer_phone     || null) : null,
        payment_method:    isOut ? (tx.payment_method     || null) : null,
        payment_reference: isOut ? (tx.payment_reference  || null) : null,
        amount_paid:       isOut ? (tx.amount_paid !== '' ? Number(tx.amount_paid) : null) : null,
        stock_location: isTransfer
          ? tx.transfer_from || null   // record the source for audit trail
          : (tx.stock_location || null),
      })
      if (error) { setErr(error.message); return }

      await sb.from('products').update({
        store_quantity:      newStoreQty,
        production_quantity: newProductionQty,
        updated_at:          new Date().toISOString()
      }).eq('id', p.id)

      const newTotal = newStoreQty + newProductionQty
      toast.success('Transaction recorded!',
        isTransfer
          ? `Transferred ${qty} ${p.unit} from ${tx.transfer_from} → ${tx.transfer_to}`
          : `New quantity: ${newTotal} ${p.unit} (Store: ${newStoreQty}, Production: ${newProductionQty})`
      )
      closeAll(); loadRows()
    } finally { setSaving(false) }
  }


  async function deleteProd() {
    if (!deleteItem) return
    // Delete all transactions for this product first, then the product
    await sb.from('transactions').delete().eq('product_id', deleteItem.id)
    await sb.from('products').delete().eq('id', deleteItem.id)
    setDeleteItem(null); loadRows()
    toast.success('Product deleted', `"${deleteItem.name}" and its transaction history have been permanently removed.`)
  }

  const pages = Math.ceil(total / PER)

  const TX_OPTS = [
    { t: 'stock_in'   as const, label: '▲ Stock In',   color: 'var(--green)', bg: 'var(--c-green-dim)', border: 'var(--green)' },
    { t: 'transfer'   as const, label: '⇄ Transfer',    color: 'var(--gold)',   bg: 'var(--c-gold-dim)',   border: 'var(--gold)'   },
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
          <input className="input" placeholder="Search by name or SKU…" value={searchInput} onChange={e => { setSearchInput(e.target.value); setSearch(e.target.value); setPage(1) }} />
          {search && <button className="search-clear" onClick={() => { setSearch(''); setSearchInput('') }}><X size={11} /></button>}
        </div>
        <select className="input" style={{ width: 170 }} value={catF} onChange={e => { setCatF(e.target.value); setSubCatF(''); setPage(1) }}>
          <option value="">All Categories</option>
          {cats.filter(c => !c.parent_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {user?.business_id === 'wellprint' && (
          <select className="input" style={{ width: 170 }} value={subCatF} onChange={e => { setSubCatF(e.target.value); setPage(1) }} disabled={!catF}>
            <option value="">All Sub-categories</option>
            {cats.filter(c => c.parent_id === catF).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select className="input" style={{ width: 145 }} value={stockF} onChange={e => { setStockF(e.target.value); setPage(1) }}>
          <option value="">All Status</option>
          <option value="ok">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
        <select className="input" style={{ width: 175 }} value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1) }}>
          <option value="name_asc">Name: A → Z</option>
          <option value="name_desc">Name: Z → A</option>
          <option value="sku_asc">SKU: A → Z</option>
          <option value="sku_desc">SKU: Z → A</option>
          <option value="latest">Latest Added</option>
          <option value="oldest">Oldest Added</option>
        </select>
        {(search || catF || subCatF || stockF) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setCatF(''); setStockF(''); setSortBy('name_asc'); setPage(1) }}>
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
                <th>Product</th><th>SKU</th><th>{user?.business_id === 'wellprint' ? 'Category / Sub-cat' : 'Category'}</th><th>Supplier</th>
                <th style={{ textAlign: 'center' }}>Store Stock</th><th style={{ textAlign: 'center' }}>Production Stock</th><th style={{ textAlign: 'center' }}>Status</th><th>Cost</th><th>Selling Price</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <SkeletonRows cols={9} rows={8} />
                : rows.length === 0
                ? <tr><td colSpan={10}>
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
                      <td style={{ fontSize: 13, color: 'var(--c-text2)' }}>
                        {(() => {
                          const cat = (p as any).categories
                          if (!cat) return <span style={{ color: 'var(--c-text4)' }}>—</span>
                          if (user?.business_id === 'wellprint') {
                            const catObj = cats.find(c => c.id === p.category_id)
                            if (catObj?.parent_id) {
                              const parent = cats.find(c => c.id === catObj.parent_id)
                              if (parent) return <span>{parent.name} <span style={{ color: 'var(--c-text4)' }}>›</span> {cat.name}</span>
                            }
                          }
                          return cat.name
                        })()}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--c-text2)' }}>{(p as any).suppliers?.name ?? <span style={{ color: 'var(--c-text4)' }}>—</span>}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 800, color: 'var(--ink)', fontSize: 15, fontFamily: 'var(--font-head)' }}>{p.store_quantity ?? 0}</span>
                        <span style={{ color: 'var(--c-text3)', fontSize: 12, marginLeft: 4 }}>{p.unit}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 800, color: 'var(--ink)', fontSize: 15, fontFamily: 'var(--font-head)' }}>{p.production_quantity ?? 0}</span>
                        <span style={{ color: 'var(--c-text3)', fontSize: 12, marginLeft: 4 }}>{p.unit}</span>
                        {(p.production_quantity ?? 0) > 0 && (p.store_quantity ?? 0) === 0 && (
                          <div style={{ fontSize: 10.5, color: 'var(--gold)', fontWeight: 700, marginTop: 2 }}>Available to transfer</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                          <StockBar quantity={p.quantity} reorderLevel={p.reorder_level} />
                        </div>
                      </td>
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
                            <button className="btn-icon danger" title="Delete Product" onClick={() => setDeleteItem(p)}>
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
            <Field label="Product Name" required>
              <input className="input" required value={form.name} onChange={e => f('name', e.target.value)} placeholder="Full product name" />
            </Field>
            {/* Show a notice when the name matches an existing product */}
            {modal === 'add' && skuIsExisting && !skuLoading && (
              <div style={{ background: 'var(--c-gold-dim)', border: '1px solid var(--gold)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--ink)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span>A product with this name already exists (<strong>{form.sku}</strong>). Submitting will <strong>add the quantity</strong> to the existing product instead of creating a new one.</span>
              </div>
            )}
            <div className="grid-2">
              <Field label="SKU" hint={modal === 'add' ? (skuLoading ? 'Looking up…' : 'Auto-generated from name') : undefined}>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input input-mono"
                    value={skuLoading ? 'Generating…' : form.sku}
                    onChange={modal === 'edit' ? e => f('sku', e.target.value) : undefined}
                    readOnly={modal === 'add'}
                    placeholder={modal === 'add' ? 'Type a name above' : 'e.g. CEM-0001'}
                    style={{ background: modal === 'add' ? 'var(--bg)' : undefined, color: skuLoading ? 'var(--c-text4)' : 'var(--ink)', fontWeight: 700 }}
                  />
                </div>
              </Field>
              <Field label="Unit" required>
                <select className="input" value={form.unit} onChange={e => f('unit', e.target.value)}>
                  {(user?.business_id === 'wellprint' ? WELLPRINT_UNITS : user?.business_id === 'wellbuild' ? WELLBUILD_UNITS : UNITS).map(u => <option key={u}>{u}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Description">
              <textarea className="input" rows={2} value={form.description} onChange={e => f('description', e.target.value)} placeholder="Optional description…" />
            </Field>
            <div className="grid-2">
              {user?.business_id === 'wellprint' ? (
                <>
                  <Field label="Category">
                    <select className="input" value={form.category_id} onChange={e => {
                      f('category_id', e.target.value)
                      f('sub_category_id', '')  // reset sub when parent changes
                    }}>
                      <option value="">— Select category —</option>
                      {cats.filter(c => !c.parent_id).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Sub-category">
                    <select
                      className="input"
                      value={form.sub_category_id}
                      onChange={e => f('sub_category_id', e.target.value)}
                      disabled={!form.category_id}
                    >
                      <option value="">— Select sub-category —</option>
                      {cats.filter(c => c.parent_id === form.category_id).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {form.category_id && cats.filter(c => c.parent_id === form.category_id).length === 0 && (
                      <p style={{ fontSize: 11.5, color: 'var(--c-text4)', marginTop: 4 }}>No sub-categories for this category yet.</p>
                    )}
                  </Field>
                </>
              ) : (
                <Field label="Category">
                  <select className="input" value={form.category_id} onChange={e => f('category_id', e.target.value)}>
                    <option value="">— Select category —</option>
                    {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              )}
              {user?.business_id !== 'wellprint' && (
                <Field label="Supplier">
                  <select className="input" value={form.supplier_id} onChange={e => f('supplier_id', e.target.value)}>
                    <option value="">— Select supplier —</option>
                    {sups.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
              )}
            </div>
            {user?.business_id === 'wellprint' && (
              <Field label="Supplier">
                <select className="input" value={form.supplier_id} onChange={e => f('supplier_id', e.target.value)}>
                  <option value="">— Select supplier —</option>
                  {sups.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            )}
            {modal === 'add' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Initial Quantity" hint="A Stock In transaction will be recorded automatically">
                  <input
                    className="input" type="number" min={0}
                    value={form.quantity}
                    style={{ color: form.quantity === '0' ? 'var(--c-text3)' : undefined }}
                    onFocus={e => { if (form.quantity === '0') { f('quantity', ''); e.target.select() } }}
                    onBlur={() => { if (form.quantity === '' || form.quantity === undefined) f('quantity', '0') }}
                    onChange={e => f('quantity', e.target.value)}
                  />
                </Field>
                <Field label="Initial Location" hint="Where is the initial stock located?">
                  <select className="input" value={form.initial_location} onChange={e => f('initial_location', e.target.value)}>
                    <option value="store">Store</option>
                    <option value="production">Production</option>
                  </select>
                </Field>
              </div>
            )}
            <div className="grid-2">
              <Field label="Reorder Level" hint="Alert threshold for low stock">
                <input
                  className="input" type="number" min={0}
                  value={form.reorder_level}
                  onChange={e => f('reorder_level', e.target.value)}
                />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Cost Price (₱)">
                <input
                  className="input" type="number" min={0} step="0.01"
                  value={form.cost_price}
                  style={{ color: form.cost_price === '0' ? 'var(--c-text3)' : undefined }}
                  onFocus={e => { if (form.cost_price === '0') { f('cost_price', ''); e.target.select() } }}
                  onBlur={() => { if (form.cost_price === '' || form.cost_price === undefined) f('cost_price', '0') }}
                  onChange={e => f('cost_price', e.target.value)}
                />
              </Field>
              <Field label="Selling Price (₱)">
                <input
                  className="input" type="number" min={0} step="0.01"
                  value={form.selling_price}
                  style={{ color: form.selling_price === '0' ? 'var(--c-text3)' : undefined }}
                  onFocus={e => { if (form.selling_price === '0') { f('selling_price', ''); e.target.select() } }}
                  onBlur={() => { if (form.selling_price === '' || form.selling_price === undefined) f('selling_price', '0') }}
                  onChange={e => f('selling_price', e.target.value)}
                />
              </Field>
            </div>
          </form>
        </Modal>
      )}

      {/* Transaction Modal */}
      {txModal && selected && (
        <Modal
          title="Record Stock Movement"
          subtitle={`${selected.name} · Store: ${selected.store_quantity ?? 0} · Production: ${selected.production_quantity ?? 0} ${selected.unit}`}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
                {TX_OPTS.map(({ t, label, color, bg, border }) => (
                  <button key={t} type="button" onClick={() => setTx(p => ({
                    ...p, type: t,
                    voucher_number:   t === 'stock_in'  ? (p.voucher_number  || genVoucherNumber()) : p.voucher_number,
                    reference_number: t === 'stock_out' ? (p.reference_number || genRefNumber())    : p.reference_number,
                    // Default transfer direction: production → store
                    transfer_from: t === 'transfer' ? (p.transfer_from || 'production') : p.transfer_from,
                    transfer_to:   t === 'transfer' ? (p.transfer_to   || 'store')      : p.transfer_to,
                  }))}
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

            {/* ── TRANSFER UI ── */}
            {tx.type === 'transfer' && (
              <>
                {/* Stock availability summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {(['production', 'store'] as StockLocation[]).map(loc => {
                    const qty = loc === 'production' ? (selected?.production_quantity ?? 0) : (selected?.store_quantity ?? 0)
                    const isFrom = tx.transfer_from === loc
                    return (
                      <div key={loc} style={{
                        borderRadius: 'var(--radius)', padding: '10px 14px',
                        border: `2px solid ${isFrom ? 'var(--gold)' : 'var(--border)'}`,
                        background: isFrom ? 'var(--c-gold-dim)' : 'var(--bg)',
                      }}>
                        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--c-text3)', marginBottom: 4 }}>{loc}</p>
                        <p style={{ fontSize: 18, fontWeight: 800, color: qty === 0 ? 'var(--red)' : 'var(--ink)', fontFamily: 'var(--font-head)' }}>
                          {qty} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-text3)' }}>{selected?.unit}</span>
                        </p>
                        {qty === 0 && <p style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, marginTop: 2 }}>Out of stock</p>}
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}><Field label="From">
                    <select className="input" value={tx.transfer_from} onChange={e => setTx(p => ({
                      ...p,
                      transfer_from: e.target.value as StockLocation,
                      transfer_to: e.target.value === 'production' ? 'store' : 'production',
                    }))}>
                      <option value="production">Production</option>
                      <option value="store">Store</option>
                    </select>
                  </Field></div>
                  <span style={{ fontSize: 20, color: 'var(--gold)', fontWeight: 700, marginTop: 18, flexShrink: 0 }}>→</span>
                  <div style={{ flex: 1 }}><Field label="To">
                    <select className="input" value={tx.transfer_to} onChange={e => setTx(p => ({
                      ...p,
                      transfer_to: e.target.value as StockLocation,
                      transfer_from: e.target.value === 'production' ? 'store' : 'production',
                    }))}>
                      <option value="store">Store</option>
                      <option value="production">Production</option>
                    </select>
                  </Field></div>
                </div>
                <Field label="Quantity to Transfer" required>
                  <input
                    className="input" type="number" min={1}
                    max={tx.transfer_from === 'production' ? (selected?.production_quantity ?? 0) : (selected?.store_quantity ?? 0)}
                    required value={tx.qty}
                    onChange={e => setTx(p => ({ ...p, qty: Number(e.target.value) }))}
                  />
                  {(() => {
                    const available = tx.transfer_from === 'production' ? (selected?.production_quantity ?? 0) : (selected?.store_quantity ?? 0)
                    return available > 0
                      ? <p style={{ fontSize: 11.5, color: 'var(--c-text3)', marginTop: 4 }}>Max: {available} {selected?.unit} available in {tx.transfer_from}</p>
                      : <p style={{ fontSize: 11.5, color: 'var(--red)', marginTop: 4 }}>⚠ No stock in {tx.transfer_from} to transfer</p>
                  })()}
                </Field>
              </>
            )}

            {/* ── STOCK IN / OUT / ADJUSTMENT ── */}
            {tx.type !== 'transfer' && (
              <Field label={tx.type === 'adjustment' ? 'Set quantity to' : 'Quantity'} required>
                <input className="input" type="number" min={1} required value={tx.qty} onChange={e => setTx(p => ({ ...p, qty: Number(e.target.value) }))} />
              </Field>
            )}

            {/* Location selector for stock_in, stock_out, adjustment */}
            {(tx.type === 'stock_in' || tx.type === 'stock_out' || tx.type === 'adjustment') && (
              <Field label="Stock Location" required hint={
                tx.type === 'stock_in'   ? 'Where is this stock being received?' :
                tx.type === 'stock_out'  ? 'Which location is fulfilling this sale?' :
                'Which location are you adjusting?'
              }>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(['store', 'production'] as StockLocation[]).map(loc => {
                    const qty = loc === 'production' ? (selected?.production_quantity ?? 0) : (selected?.store_quantity ?? 0)
                    const isSelected = tx.stock_location === loc
                    return (
                      <button key={loc} type="button"
                        onClick={() => setTx(p => ({ ...p, stock_location: loc }))}
                        style={{
                          padding: '11px 12px', borderRadius: 'var(--radius)', textAlign: 'left',
                          border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                          background: isSelected ? 'var(--c-primary-dim, #e8f0fe)' : 'var(--bg)',
                          cursor: 'pointer', transition: 'all .15s',
                        }}>
                        <p style={{ fontWeight: 700, fontSize: 13, color: isSelected ? 'var(--primary)' : 'var(--ink)', textTransform: 'capitalize' }}>{loc}</p>
                        <p style={{ fontSize: 11.5, color: qty === 0 ? 'var(--red)' : 'var(--c-text3)', marginTop: 2 }}>
                          {qty} {selected?.unit} in stock
                        </p>
                      </button>
                    )
                  })}
                </div>
              </Field>
            )}

            {/* Voucher Number — shown for Stock IN */}
            {tx.type === 'stock_in' && (
              <Field label="Voucher Number" hint="Auto-generated inventory document number">
                <input
                  className="input input-mono"
                  value={tx.voucher_number}
                  onChange={e => setTx(p => ({ ...p, voucher_number: e.target.value }))}
                  placeholder="VCH-YYYYMMDD-0001"
                  style={{ fontWeight: 700 }}
                />
              </Field>
            )}

            <Field label="Notes">
              <textarea className="input" rows={2} placeholder="Optional notes…" value={tx.notes} onChange={e => setTx(p => ({ ...p, notes: e.target.value }))} />
            </Field>

            {/* Sale Details — Stock Out only */}
            {tx.type === 'stock_out' && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: -4 }}>
                <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 12 }}>Sale Details</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  <div className="grid-2">
                    <Field label="Reference Number" hint="Customer receipt number">
                      <input className="input input-mono" placeholder="REF-YYYYMMDD-0001" value={tx.reference_number} onChange={e => setTx(p => ({ ...p, reference_number: e.target.value }))} style={{ fontWeight: 700 }} />
                    </Field>
                    <Field label="Date of Sale">
                      <input className="input" type="date" value={tx.date_of_sale} onChange={e => setTx(p => ({ ...p, date_of_sale: e.target.value }))} />
                    </Field>
                  </div>
                  <div className="grid-2">
                    <Field label="Customer Name">
                      <select className="input" value={tx.customer_name} onChange={e => {
                        const name = e.target.value
                        const match = custs.find(c => c.name === name)
                        setTx(p => ({ ...p, customer_name: name, customer_phone: match?.phone ?? p.customer_phone }))
                      }}>
                        <option value="">— Select customer —</option>
                        {custs.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Phone Number">
                      <input className="input" placeholder="+63 9XX XXX XXXX" value={tx.customer_phone} onChange={e => setTx(p => ({ ...p, customer_phone: e.target.value }))} />
                    </Field>
                  </div>
                  <div className="grid-2">
                    <Field label="Payment Method">
                      <select className="input" value={tx.payment_method} onChange={e => setTx(p => ({ ...p, payment_method: e.target.value as PaymentMethod | '' }))}>
                        <option value="">— Select method —</option>
                        {(Object.entries(PAYMENT_METHOD_LABEL) as [PaymentMethod, string][]).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Payment Reference #" hint="e.g. GCash ref, card approval code">
                      <input className="input input-mono" placeholder="Reference / approval #" value={tx.payment_reference} onChange={e => setTx(p => ({ ...p, payment_reference: e.target.value }))} />
                    </Field>
                  </div>
                  <div className="grid-2">
                    <Field label="Amount Paid (₱)" hint="Leave blank if fully paid">
                      <input className="input" type="number" min={0} step="0.01" placeholder="0.00" value={tx.amount_paid} onChange={e => setTx(p => ({ ...p, amount_paid: e.target.value }))} />
                    </Field>
                  </div>
                </div>
              </div>
            )}
          </form>
        </Modal>
      )}


      {/* Delete confirm */}
      {deleteItem && (
        <Modal
          title="Delete Product?"
          onClose={() => setDeleteItem(null)}
          width={400}
          icon={<Trash2 size={18} />}
          iconBg="#fee2e2"
          iconColor="#dc2626"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDeleteItem(null)}>Cancel</button>
              <button
                className="btn"
                onClick={deleteProd}
                style={{ background: '#dc2626', color: '#fff', border: 'none' }}
              >
                Delete
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13.5, color: 'var(--c-text2)', lineHeight: 1.6 }}>
            Delete <b>"{deleteItem.name}"</b>? This will permanently remove the product and all its transaction history. This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  )
}