// ── STAFF PAGE ────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { Plus, Edit2, UserX, UserCheck, Shield, User as UserIcon, Trash2, Users } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { BIZ, BizId, StaffUser } from '@/types'
import { avatarColor, bizColor } from '@/lib/utils'
import { Modal, Alert, Field, SkeletonRows, Empty, Confirm } from '@/components/ui'

const BLANK = { full_name: '', username: '', email: '', password: '', role: 'staff' as 'admin'|'staff', business_id: 'wellbuild' as BizId }

// Call the edge function
async function manageStaff(action: string, payload: Record<string, any>) {
  const { data: { session } } = await sb.auth.getSession()
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-staff`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action, ...payload }),
    }
  )
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || 'Request failed')
  return data
}

export function Staff() {
  const { user } = useAuth()
  const [rows, setRows]         = useState<StaffUser[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState<StaffUser | null>(null)
  const [form, setForm]         = useState({ ...BLANK })
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')
  const [ok, setOk]             = useState('')
  const [toggleTarget, setToggleTarget] = useState<StaffUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null)

  async function load() {
    if (!user) return
    setLoading(true)
    const { data } = await sb
      .from('users')
      .select('id,email,username,full_name,role,business_id,avatar_color,is_active,created_at')
      .eq('business_id', user.business_id)
      .order('created_at', { ascending: false })
    setRows(data as StaffUser[] ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user])

  function open(s?: StaffUser) {
    setEditing(s ?? null)
    setForm(s
      ? { full_name: s.full_name, username: s.username, email: s.email ?? '', password: '', role: s.role, business_id: s.business_id }
      : { ...BLANK }
    )
    setErr(''); setOk(''); setModal(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr(''); setOk('')
    try {
      if (editing) {
        await manageStaff('update', {
          user_id:    editing.id,
          full_name:  form.full_name,
          role:       form.role,
          email:      form.email.toLowerCase(),
        })
      } else {
        if (!form.email)    { setErr('Email is required'); return }
        if (!form.password || form.password.length < 8) { setErr('Password must be at least 8 characters'); return }
        await manageStaff('create', {
          email:       form.email.toLowerCase(),
          password:    form.password,
          full_name:   form.full_name,
          username:    form.username.toLowerCase(),
          role:        form.role,
          business_id: form.business_id,
        })
      }
      setOk(editing ? 'Staff updated!' : 'Account created! They can now log in.')
      setTimeout(() => { setModal(false); load() }, 900)
    } catch (e: any) {
      setErr(e.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function toggle() {
    if (!toggleTarget) return
    try {
      await manageStaff('toggle', {
        user_id:   toggleTarget.id,
        is_active: !toggleTarget.is_active,
      })
    } catch (e: any) {
      setErr(e.message)
    }
    setToggleTarget(null); load()
  }

  async function deleteStaff() {
    if (!deleteTarget) return
    try {
      await manageStaff('delete', { user_id: deleteTarget.id })
    } catch (e: any) {
      setErr(e.message)
    }
    setDeleteTarget(null); load()
  }

  return (
    <div className="anim-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>Staff Management</h2>
          <p style={{ color: 'var(--c-text3)', fontSize: 13.5, marginTop: 3 }}>{rows.filter(r=>r.is_active).length} active · {rows.filter(r=>!r.is_active).length} inactive</p>
        </div>
        <button className="btn btn-primary" onClick={() => open()}><Plus size={15} />Add Staff</button>
      </div>

      {/* Role guide */}
      <div className="grid-2" style={{ marginBottom: 18 }}>
        {[
          { role: 'Admin', Icon: Shield, color: 'var(--gold)', bg: 'var(--c-gold-dim)', desc: 'Full access — staff, reports, categories, delete operations.' },
          { role: 'Staff', Icon: UserIcon, color: 'var(--c-text3)', bg: 'var(--bg)', desc: 'Standard access — inventory, transactions, suppliers (view only for delete).' },
        ].map(({ role, Icon, color, bg, desc }) => (
          <div key={role} className="card-inset" style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border)' }}>
              <Icon size={15} style={{ color }} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', marginBottom: 2 }}>{role}</p>
              <p style={{ fontSize: 12.5, color: 'var(--c-text3)', lineHeight: 1.5 }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr><th>Member</th><th>Username</th><th>Role</th><th>Business</th><th>Status</th><th>Joined</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows cols={7} rows={5} /> : rows.length === 0
                ? <tr><td colSpan={7}><Empty icon={<Users size={38} />} text="No staff members yet" /></td></tr>
                : rows.map(s => {
                  const biz = BIZ[s.business_id as BizId]
                  const bc  = bizColor(s.business_id as BizId)
                  const av  = avatarColor(s.full_name, s.avatar_color)
                  return (
                    <tr key={s.id} style={{ opacity: s.is_active ? 1 : .45 }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: av, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#fff', flexShrink: 0 }}>
                            {s.full_name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13.5 }}>{s.full_name}</p>
                            <p style={{ fontSize: 11.5, color: 'var(--c-text3)' }}>{s.email || 'No email'}</p>
                          </div>
                        </div>
                      </td>
                      <td><span className="mono badge badge-navy" style={{ fontSize: 11.5 }}>@{s.username}</span></td>
                      <td><span className={`badge ${s.role === 'admin' ? 'badge-coral' : 'badge-navy'}`} style={{ fontSize: 11.5 }}>{s.role === 'admin' ? <Shield size={10} /> : <UserIcon size={10} />}{s.role}</span></td>
                      <td><span className="badge" style={{ background: biz?.bg, color: bc, fontSize: 11.5 }}>{biz?.name}</span></td>
                      <td><span className={`badge ${s.is_active ? 'badge-green' : 'badge-navy'}`} style={{ fontSize: 11.5 }}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td style={{ fontSize: 12.5, color: 'var(--c-text3)' }}>{new Date(s.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn-icon" title="Edit" onClick={() => open(s)}><Edit2 size={13} /></button>
                          <button
                            className={`btn-icon ${s.is_active ? 'danger' : ''}`}
                            title={s.is_active ? 'Deactivate' : 'Reactivate'}
                            onClick={() => setToggleTarget(s)}
                          >
                            {s.is_active
                              ? <UserX size={13} />
                              : <UserCheck size={13} style={{ color: 'var(--c-green)' }} />
                            }
                          </button>
                          {s.id !== user?.id && (
                            <button className="btn-icon danger" title="Delete permanently" onClick={() => setDeleteTarget(s)}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <Modal
          title={editing ? 'Edit Staff Member' : 'Add Staff Member'}
          subtitle={editing ? 'Update account details' : 'Create a new login account'}
          onClose={() => setModal(false)}
          width={500}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save as any} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Account'}
              </button>
            </>
          }
        >
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {err && <Alert msg={err} type="err" />}
            {ok  && <Alert msg={ok}  type="ok"  />}
            <Field label="Full Name" required>
              <input className="input" required value={form.full_name} onChange={e => setForm(p=>({...p,full_name:e.target.value}))} />
            </Field>
            {!editing && (
              <Field label="Username" required>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--c-text3)' }}>@</span>
                  <input className="input input-mono" style={{ paddingLeft: 26 }} required value={form.username} onChange={e => setForm(p=>({...p,username:e.target.value.toLowerCase()}))} placeholder="juan.delacruz" />
                </div>
              </Field>
            )}
            <Field label="Email" required>
              <input className="input" type="email" required value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} placeholder="email@company.com" />
            </Field>
            {!editing && (
              <Field label="Password" required>
                <input className="input" type="password" required minLength={8} value={form.password} onChange={e => setForm(p=>({...p,password:e.target.value}))} placeholder="Minimum 8 characters" />
              </Field>
            )}
            {editing && (
              <div style={{ padding: '10px 14px', background: 'var(--c-bg)', borderRadius: 8, border: '1px solid var(--c-border)', fontSize: 12.5, color: 'var(--c-text3)' }}>
                🔒 Password changes are done by the staff member in Profile → Security.
              </div>
            )}
            <div className="grid-2">
              <Field label="Role">
                <select className="input" value={form.role} onChange={e => setForm(p=>({...p,role:e.target.value as any}))}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
              {!editing && (
                <Field label="Business Unit">
                  <select className="input" value={form.business_id} onChange={e => setForm(p=>({...p,business_id:e.target.value as BizId}))}>
                    {Object.entries(BIZ).map(([id, b]) => <option key={id} value={id}>{b.name}</option>)}
                  </select>
                </Field>
              )}
            </div>
          </form>
        </Modal>
      )}

      {/* Deactivate / Reactivate confirm */}
      {toggleTarget && (
        <Confirm
          msg={`${toggleTarget.is_active ? 'Deactivate' : 'Reactivate'} "${toggleTarget.full_name}"? They ${toggleTarget.is_active ? 'will not be able to log in' : 'will be able to log in again'}.`}
          onYes={toggle}
          onNo={() => setToggleTarget(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Confirm
          title="Delete staff member?"
          msg={`Permanently delete "${deleteTarget.full_name}" (@${deleteTarget.username})? This cannot be undone.`}
          confirmLabel="Delete"
          onYes={deleteStaff}
          onNo={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

export default Staff