import { useEffect, useState } from 'react'
import { Plus, Trash2, Tag, FolderOpen, Edit2, Check, X } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Category } from '@/types'
import { Alert, Confirm, Modal } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'

type EditForm = { name: string; desc: string; parent_id: string }

export default function Categories() {
  const { user } = useAuth()
  const toast = useToast()
  const isWellprint = user?.business_id === 'wellprint'

  const [cats, setCats]         = useState<Category[]>([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState({ name: '', desc: '', parent_id: '', newParent: '' })
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')
  const [delCat, setDelCat]     = useState<Category | null>(null)

  // Edit modal state
  const [editCat, setEditCat]   = useState<Category | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ name: '', desc: '', parent_id: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editErr, setEditErr]   = useState('')

  async function load() {
    if (!user) return
    setLoading(true)
    const { data } = await sb.from('categories').select('*').eq('business_id', user.business_id).order('name')
    setCats(data as Category[] ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user])

  const parentCats = cats.filter(c => !c.parent_id)

  // ── Add ──────────────────────────────────────────────────────────────────────
  async function add(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr('')

    let resolvedParentId = form.parent_id

    // If user typed a new parent name, create it first
    if (isWellprint && form.newParent.trim()) {
      const { data: newParentData, error: parentErr } = await sb
        .from('categories')
        .insert({ name: form.newParent.trim(), description: null, business_id: user!.business_id })
        .select('id')
        .single()
      if (parentErr) {
        setSaving(false)
        setErr(parentErr.message.includes('unique') ? `"${form.newParent.trim()}" already exists as a category` : parentErr.message)
        return
      }
      resolvedParentId = newParentData.id
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.desc.trim() || null,
      business_id: user!.business_id,
    }
    if (isWellprint && resolvedParentId) payload.parent_id = resolvedParentId

    const { error } = await sb.from('categories').insert(payload)
    setSaving(false)
    if (error) { setErr(error.message.includes('unique') ? 'Category already exists' : error.message); return }
    setForm({ name: '', desc: '', parent_id: '', newParent: '' })
    if (isWellprint && resolvedParentId) {
      toast.success(form.newParent.trim() ? `New parent "${form.newParent.trim()}" and sub-category added!` : 'Sub-category added!')
    } else {
      toast.success('Category added!')
    }
    load()
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────
  function openEdit(cat: Category) {
    setEditCat(cat)
    setEditForm({ name: cat.name, desc: cat.description ?? '', parent_id: cat.parent_id ?? '' })
    setEditErr('')
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editCat) return
    setEditSaving(true); setEditErr('')
    const payload: Record<string, unknown> = {
      name: editForm.name.trim(),
      description: editForm.desc.trim() || null,
    }
    // Wellprint: allow changing parent (but can't make a subcategory a parent of another subcategory)
    if (isWellprint) {
      payload.parent_id = editForm.parent_id || null
    }
    const { error } = await sb.from('categories').update(payload).eq('id', editCat.id)
    setEditSaving(false)
    if (error) { setEditErr(error.message.includes('unique') ? 'Name already taken' : error.message); return }
    toast.success('Category updated!')
    setEditCat(null)
    load()
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function del() {
    if (!delCat) return
    if (isWellprint && !delCat.parent_id) {
      await sb.from('categories').delete().eq('parent_id', delCat.id)
    }
    await sb.from('categories').delete().eq('id', delCat.id)
    setDelCat(null); load()
  }

  // ── Grouped view for Wellprint ───────────────────────────────────────────────
  const grouped = isWellprint
    ? parentCats.map(parent => ({
        parent,
        children: cats.filter(c => c.parent_id === parent.id),
      }))
    : []

  const totalCount = isWellprint
    ? `${parentCats.length} categories, ${cats.filter(c => c.parent_id).length} sub-categories`
    : `${cats.length}`

  // Parent options for edit modal (exclude self)
  const editParentOptions = editCat
    ? parentCats.filter(c => c.id !== editCat.id)
    : parentCats

  return (
    <div className="anim-fade-up">
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>Categories</h2>
        <p style={{ color: 'var(--c-text3)', fontSize: 13.5, marginTop: 3 }}>Organize your products by category</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Add form ─────────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: 22 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>
            Add New {isWellprint ? 'Category / Sub-category' : 'Category'}
          </h3>
          <form onSubmit={add} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {err && <Alert msg={err} type="err" />}

            {isWellprint && (
              <div>
                <label className="label">Parent Category <span style={{ color: 'var(--c-text3)', fontWeight: 400 }}>(optional)</span></label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    className="input"
                    value={form.parent_id}
                    onChange={e => setForm(p => ({ ...p, parent_id: e.target.value, newParent: '' }))}
                    style={{ flex: 1 }}
                    disabled={!!form.newParent}
                  >
                    <option value="">— Top-level category —</option>
                    {parentCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 4px' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
                  <span style={{ fontSize: 11, color: 'var(--c-text4)', fontWeight: 500 }}>OR TYPE NEW PARENT</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
                </div>
                <input
                  className="input"
                  value={form.newParent ?? ''}
                  onChange={e => setForm(p => ({ ...p, newParent: e.target.value, parent_id: e.target.value ? '' : p.parent_id }))}
                  placeholder="e.g. Accessories (creates new top-level category)"
                  style={{ opacity: form.parent_id ? 0.5 : 1 }}
                  disabled={!!form.parent_id}
                />
                <p style={{ fontSize: 11.5, color: 'var(--c-text3)', marginTop: 4 }}>
                  {form.parent_id ? 'Adding as a sub-category under selected parent.' : form.newParent ? `Will create "${form.newParent}" as a new parent category.` : 'Leave both blank to create a top-level category.'}
                </p>
              </div>
            )}

            <div>
              <label className="label">
                {isWellprint && form.parent_id ? 'Sub-category Name' : 'Category Name'}
                {' '}<span style={{ color: 'var(--gold)' }}>*</span>
              </label>
              <input
                className="input" required
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder={isWellprint && form.parent_id ? 'e.g. Jersey' : 'e.g. Clothing'}
              />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={form.desc} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))} placeholder="Optional description" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Plus size={14} />{saving ? 'Adding…' : isWellprint && (form.parent_id || form.newParent) ? 'Add Sub-category' : 'Add Category'}
            </button>
          </form>
        </div>

        {/* ── List ─────────────────────────────────────────────────────────── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>All Categories</h3>
            <span className="badge badge-navy">{totalCount}</span>
          </div>

          {loading
            ? <div style={{ padding: 16 }}>{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skel" style={{ height: 48, marginBottom: 8, borderRadius: 10 }} />)}</div>
            : cats.length === 0
            ? <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <Tag size={36} style={{ color: 'var(--c-text4)', margin: '0 auto 12px', display: 'block', opacity: .5 }} />
                <p style={{ color: 'var(--c-text3)' }}>No categories yet. Add your first one!</p>
              </div>
            : isWellprint
            ? /* ── Wellprint: grouped view ── */
              <div>
                {grouped.map((group, gi) => (
                  <div key={group.parent.id}>
                    {/* Parent row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(78,107,101,0.04)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(78,107,101,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FolderOpen size={15} style={{ color: 'var(--teal)' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13.5 }}>{group.parent.name}</p>
                        {group.parent.description && <p style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 1 }}>{group.parent.description}</p>}
                        <p style={{ fontSize: 11, color: 'var(--c-text4)', marginTop: 2 }}>{group.children.length} sub-{group.children.length === 1 ? 'category' : 'categories'}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" title="Edit" onClick={() => openEdit(group.parent)}><Edit2 size={13} /></button>
                        <button className="btn-icon danger" title="Delete" onClick={() => setDelCat(group.parent)}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {/* Children rows */}
                    {group.children.map((child, ci) => (
                      <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 20px 10px 52px', borderBottom: (gi < grouped.length - 1 || ci < group.children.length - 1) ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--c-text4)', flexShrink: 0 }} />
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(14,165,233,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Tag size={12} style={{ color: 'var(--teal)' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13 }}>{child.name}</p>
                          {child.description && <p style={{ fontSize: 11.5, color: 'var(--c-text3)', marginTop: 1 }}>{child.description}</p>}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-icon" title="Edit" onClick={() => openEdit(child)}><Edit2 size={13} /></button>
                          <button className="btn-icon danger" title="Delete" onClick={() => setDelCat(child)}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                {/* Orphaned top-level with no children */}
                {grouped.length === 0 && cats.filter(c => !c.parent_id).map((c, i, arr) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(14,165,233,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Tag size={15} style={{ color: 'var(--teal)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13.5 }}>{c.name}</p>
                      {c.description && <p style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 1 }}>{c.description}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" title="Edit" onClick={() => openEdit(c)}><Edit2 size={13} /></button>
                      <button className="btn-icon danger" title="Delete" onClick={() => setDelCat(c)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>

            : /* ── Other businesses: flat list ── */
              <div>
                {cats.map((c, i) => (
                  <div key={c.id} className="cat-chip" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: i < cats.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background .15s', borderRadius: i === 0 ? 'var(--radius-lg) var(--radius-lg) 0 0' : i === cats.length - 1 ? '0 0 var(--radius-lg) var(--radius-lg)' : 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(91,148,144,0.05)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(14,165,233,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Tag size={15} style={{ color: 'var(--teal)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13.5 }}>{c.name}</p>
                      {c.description && <p style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 1 }}>{c.description}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" title="Edit" onClick={() => openEdit(c)}><Edit2 size={13} /></button>
                      <button className="btn-icon danger" title="Delete" onClick={() => setDelCat(c)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      {editCat && (
        <Modal
          title={editCat.parent_id ? 'Edit Sub-category' : 'Edit Category'}
          subtitle={`Editing: ${editCat.name}`}
          onClose={() => setEditCat(null)}
          icon={editCat.parent_id ? <Tag size={17} /> : <FolderOpen size={17} />}
          iconBg="rgba(78,107,101,0.12)"
          iconColor="var(--teal)"
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setEditCat(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={editSaving} onClick={saveEdit}>
                <Check size={14} />{editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          }
        >
          <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 24px' }}>
            {editErr && <Alert msg={editErr} type="err" />}

            {/* Wellprint only: allow changing parent */}
            {isWellprint && (
              <div>
                <label className="label">Parent Category <span style={{ color: 'var(--c-text3)', fontWeight: 400 }}>(optional)</span></label>
                <select
                  className="input"
                  value={editForm.parent_id}
                  onChange={e => setEditForm(p => ({ ...p, parent_id: e.target.value }))}
                >
                  <option value="">— Top-level category —</option>
                  {editParentOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="label">Name <span style={{ color: 'var(--gold)' }}>*</span></label>
              <input
                className="input" required autoFocus
                value={editForm.name}
                onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Category name"
              />
            </div>
            <div>
              <label className="label">Description</label>
              <input
                className="input"
                value={editForm.desc}
                onChange={e => setEditForm(p => ({ ...p, desc: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete Confirm ─────────────────────────────────────────────────── */}
      {delCat && (
        <Confirm
          msg={
            isWellprint && !delCat.parent_id && cats.some(c => c.parent_id === delCat.id)
              ? `Delete "${delCat.name}" and all its sub-categories? Products will be uncategorized.`
              : `Delete "${delCat.name}"? Products in this category will not be deleted, just uncategorized.`
          }
          onYes={del} onNo={() => setDelCat(null)}
        />
      )}
    </div>
  )
}