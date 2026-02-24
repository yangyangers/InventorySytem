import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Truck, Mail, Phone, User, MapPin } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Supplier } from '@/types'
import { Modal, Alert, Field, Confirm } from '@/components/ui'

const BLANK = { name: '', contact_person: '', email: '', phone: '', address: '' }

export default function Suppliers() {
  const { user } = useAuth()
  const [items, setItems]   = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm]     = useState({ ...BLANK })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const [ok, setOk]         = useState('')
  const [delItem, setDelItem] = useState<Supplier | null>(null)

  async function load() {
    if (!user) return
    setLoading(true)
    const { data } = await sb.from('suppliers').select('*').eq('business_id', user.business_id).eq('is_active', true).order('name')
    setItems(data as Supplier[] ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user])

  function open(s?: Supplier) {
    setEditing(s ?? null)
    setForm(s ? { name: s.name, contact_person: s.contact_person ?? '', email: s.email ?? '', phone: s.phone ?? '', address: s.address ?? '' } : { ...BLANK })
    setErr(''); setOk(''); setModal(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr(''); setOk('')
    const payload = { ...form, business_id: user!.business_id, is_active: true, contact_person: form.contact_person || null, email: form.email || null, phone: form.phone || null, address: form.address || null, updated_at: new Date().toISOString() }
    const { error } = editing
      ? await sb.from('suppliers').update(payload).eq('id', editing.id)
      : await sb.from('suppliers').insert(payload)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setOk(editing ? 'Supplier updated!' : 'Supplier added!')
    setTimeout(() => { setModal(false); load() }, 800)
  }

  async function archive() {
    if (!delItem) return
    await sb.from('suppliers').update({ is_active: false }).eq('id', delItem.id)
    setDelItem(null); load()
  }

  return (
    <div className="anim-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>Suppliers</h2>
          <p style={{ color: 'var(--c-text3)', fontSize: 13.5, marginTop: 3 }}>{items.length} active suppliers</p>
        </div>
        <button className="btn btn-primary" onClick={() => open()}><Plus size={15} /> Add Supplier</button>
      </div>

      {loading
        ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skel" style={{ height: 180, borderRadius: 14 }} />)}
          </div>
        : items.length === 0
        ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 20px', gap: 12 }}>
            <Truck size={48} style={{ color: 'var(--c-text4)', opacity: .5 }} />
            <p style={{ color: 'var(--c-text3)', fontWeight: 600 }}>No suppliers yet</p>
            <p style={{ fontSize: 13, color: 'var(--c-text4)' }}>Add your first supplier to get started</p>
            <button className="btn btn-primary" onClick={() => open()}><Plus size={14} />Add Supplier</button>
          </div>
        : <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
            {items.map(s => (
              <div key={s.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(14,165,233,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Truck size={20} style={{ color: 'var(--teal)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon" onClick={() => open(s)}><Edit2 size={14} /></button>
                    {user?.role === 'admin' && <button className="btn-icon danger" onClick={() => setDelItem(s)}><Trash2 size={14} /></button>}
                  </div>
                </div>
                <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-.01em' }}>{s.name}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {s.contact_person && <InfoRow icon={<User size={12} />} val={s.contact_person} />}
                  {s.email && <InfoRow icon={<Mail size={12} />} val={s.email} />}
                  {s.phone && <InfoRow icon={<Phone size={12} />} val={s.phone} />}
                  {s.address && <InfoRow icon={<MapPin size={12} />} val={s.address} />}
                </div>
              </div>
            ))}
          </div>
      }

      {modal && (
        <Modal title={editing ? 'Edit Supplier' : 'Add Supplier'} onClose={() => setModal(false)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save as any} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save' : 'Add Supplier'}</button></>}
        >
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {err && <Alert msg={err} type="err" />}
            {ok  && <Alert msg={ok}  type="ok"  />}
            <Field label="Supplier Name" required><input className="input" required value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="Company name" /></Field>
            <Field label="Contact Person"><input className="input" value={form.contact_person} onChange={e => setForm(p=>({...p,contact_person:e.target.value}))} placeholder="Full name" /></Field>
            <div className="grid-2">
              <Field label="Email"><input className="input" type="email" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} placeholder="email@company.com" /></Field>
              <Field label="Phone"><input className="input" value={form.phone} onChange={e => setForm(p=>({...p,phone:e.target.value}))} placeholder="+63 9XX XXX XXXX" /></Field>
            </div>
            <Field label="Address"><textarea className="input" rows={2} value={form.address} onChange={e => setForm(p=>({...p,address:e.target.value}))} placeholder="Full address" /></Field>
          </form>
        </Modal>
      )}

      {delItem && <Confirm msg={`Remove "${delItem.name}" from your supplier list?`} onYes={archive} onNo={() => setDelItem(null)} />}
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
