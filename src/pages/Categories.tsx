import { useEffect, useState } from 'react'
import { Plus, Trash2, Tag } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Category } from '@/types'
import { Alert, Confirm } from '@/components/ui'

export default function Categories() {
  const { user } = useAuth()
  const [cats, setCats]   = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]   = useState({ name: '', desc: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr]     = useState('')
  const [ok, setOk]       = useState('')
  const [delCat, setDelCat] = useState<Category | null>(null)

  async function load() {
    if (!user) return
    setLoading(true)
    const { data } = await sb.from('categories').select('*').eq('business_id', user.business_id).order('name')
    setCats(data as Category[] ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user])

  async function add(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr(''); setOk('')
    const { error } = await sb.from('categories').insert({ name: form.name.trim(), description: form.desc.trim() || null, business_id: user!.business_id })
    setSaving(false)
    if (error) { setErr(error.message.includes('unique') ? 'Category already exists' : error.message); return }
    setForm({ name: '', desc: '' })
    setOk('Category added!')
    setTimeout(() => setOk(''), 2000)
    load()
  }

  async function del() {
    if (!delCat) return
    await sb.from('categories').delete().eq('id', delCat.id)
    setDelCat(null); load()
  }

  return (
    <div className="anim-fade-up">
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>Categories</h2>
        <p style={{ color: 'var(--c-text3)', fontSize: 13.5, marginTop: 3 }}>Organize your products by category</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Add form */}
        <div className="card" style={{ padding: 22 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>Add New Category</h3>
          <form onSubmit={add} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {err && <Alert msg={err} type="err" />}
            {ok  && <Alert msg={ok}  type="ok"  />}
            <div>
              <label className="label">Category Name <span style={{ color: 'var(--gold)' }}>*</span></label>
              <input className="input" required value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Construction Materials" />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={form.desc} onChange={e => setForm(p=>({...p,desc:e.target.value}))} placeholder="Optional description" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Plus size={14} />{saving ? 'Adding…' : 'Add Category'}
            </button>
          </form>
        </div>

        {/* List */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>All Categories</h3>
            <span className="badge badge-navy">{cats.length}</span>
          </div>

          {loading
            ? <div style={{ padding: 16 }}>{Array.from({length:5}).map((_,i)=><div key={i} className="skel" style={{ height:48, marginBottom:8, borderRadius:10 }} />)}</div>
            : cats.length === 0
            ? <div style={{ padding:'48px 20px', textAlign:'center' }}>
                <Tag size={36} style={{ color:'var(--c-text4)', margin:'0 auto 12px', display:'block', opacity:.5 }} />
                <p style={{ color:'var(--c-text3)' }}>No categories yet. Add your first one!</p>
              </div>
            : <div>
                {cats.map((c, i) => (
                  <div key={c.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 20px', borderBottom: i < cats.length-1 ? '1px solid var(--border)' : 'none', transition:'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background='var(--bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}
                  >
                    <div style={{ width:36, height:36, borderRadius:10, background:'rgba(14,165,233,.08)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Tag size={15} style={{ color:'var(--teal)' }} />
                    </div>
                    <div style={{ flex:1 }}>
                      <p style={{ fontWeight:600, color:'var(--ink)', fontSize:13.5 }}>{c.name}</p>
                      {c.description && <p style={{ fontSize:12, color:'var(--c-text3)', marginTop:1 }}>{c.description}</p>}
                    </div>
                    <button className="btn-icon danger" onClick={() => setDelCat(c)}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {delCat && (
        <Confirm
          msg={`Delete "${delCat.name}"? Products in this category will not be deleted, just uncategorized.`}
          onYes={del} onNo={() => setDelCat(null)}
        />
      )}
    </div>
  )
}
