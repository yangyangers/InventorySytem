import { useEffect, useState } from 'react'
import { Check, Lock, User, Palette, Shield, Loader } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { BIZ, BizId, AVATAR_COLORS } from '@/types'
import { avatarColor, bizColor } from '@/lib/utils'
import { Alert } from '@/components/ui'

type Tab = 'profile' | 'security' | 'appearance'

export default function Profile() {
  const { user, setUser } = useAuth()
  const [tab, setTab]     = useState<Tab>('profile')
  const [dbUser, setDbUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState<{ t: 'ok'|'err'; m: string } | null>(null)
  const [pf, setPf]   = useState({ full_name:'', username:'', email:'', phone:'', bio:'' })
  const [pw, setPw]   = useState({ cur:'', next:'', conf:'' })
  const [color, setColor] = useState(AVATAR_COLORS[0])

  useEffect(() => {
    if (!user) return
    sb.from('users').select('*').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setDbUser(data)
        setPf({ full_name: data.full_name, username: data.username, email: data.email??'', phone: data.phone??'', bio: data.bio??'' })
        setColor(data.avatar_color || avatarColor(data.full_name))
      }
      setLoading(false)
    })
  }, [user])

  function flash(t: 'ok'|'err', m: string) { setMsg({ t, m }); if (t==='ok') setTimeout(() => setMsg(null), 3500) }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg(null)
    if (pf.username !== dbUser.username) {
      const { data: ex } = await sb.from('users').select('id').eq('username', pf.username.toLowerCase()).neq('id', user!.id).single()
      if (ex) { flash('err', 'That username is already taken'); setSaving(false); return }
    }

    // Update users table
    const { error } = await sb.from('users').update({
      full_name:  pf.full_name,
      username:   pf.username.toLowerCase(),
      email:      pf.email || null,
      phone:      pf.phone || null,
      bio:        pf.bio   || null,
      updated_at: new Date().toISOString(),
    }).eq('id', user!.id)
    if (error) { flash('err', error.message); setSaving(false); return }

    // If email changed, sync to Supabase Auth too
    if (pf.email && pf.email.toLowerCase() !== dbUser.email?.toLowerCase()) {
      const { error: authError } = await sb.auth.updateUser({ email: pf.email.toLowerCase() })
      if (authError) { flash('err', 'Profile saved but email sync failed: ' + authError.message); setSaving(false); return }
    }

    setSaving(false)
    setUser({ ...user!, full_name: pf.full_name, username: pf.username.toLowerCase(), email: pf.email || null })
    setDbUser((d: any) => ({ ...d, ...pf }))
    flash('ok', 'Profile updated successfully!')
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pw.next !== pw.conf) { flash('err', 'New passwords do not match'); return }
    if (pw.next.length < 8)  { flash('err', 'Password must be at least 8 characters'); return }
    setSaving(true); setMsg(null)

    // Verify current password by re-authenticating
    const { data: { user: authUser } } = await sb.auth.getUser()
    if (!authUser?.email) { flash('err', 'Session error — please sign in again'); setSaving(false); return }

    const { error: signInErr } = await sb.auth.signInWithPassword({
      email: authUser.email,
      password: pw.cur,
    })
    if (signInErr) { flash('err', 'Current password is incorrect'); setSaving(false); return }

    // Update password via Supabase Auth
    const { error } = await sb.auth.updateUser({ password: pw.next })
    setSaving(false)
    if (error) { flash('err', error.message); return }
    setPw({ cur:'', next:'', conf:'' })
    flash('ok', 'Password changed successfully!')
  }

  async function saveColor() {
    setSaving(true); setMsg(null)
    const { error } = await sb.from('users').update({ avatar_color: color }).eq('id', user!.id)
    setSaving(false)
    if (error) { flash('err', error.message); return }
    setUser({ ...user!, avatar_color: color })
    flash('ok', 'Avatar color saved!')
  }

  if (loading || !dbUser) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height: 320 }}>
      <Loader size={26} className="spin" style={{ color: 'var(--c-text4)' }} />
    </div>
  )

  const biz  = BIZ[dbUser.business_id as BizId]
  const bc   = bizColor(dbUser.business_id as BizId)
  const av   = color
  const init = (pf.full_name || dbUser.full_name)[0]?.toUpperCase()

  const TABS = [
    { id: 'profile',    label: 'Profile',    icon: User    },
    { id: 'security',   label: 'Security',   icon: Lock    },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ] as const

  return (
    <div className="anim-fade-up" style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* Hero card */}
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        {/* Gradient band */}
        <div style={{ height: 80, background: `linear-gradient(135deg, ${bc}18 0%, ${bc}06 100%)`, borderBottom: '1px solid var(--border)' }} />
        <div style={{ padding: '0 28px 24px', display: 'flex', alignItems: 'flex-end', gap: 20, marginTop: -36 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 76, height: 76, borderRadius: 22,
              background: `linear-gradient(135deg, ${av} 0%, ${av}cc 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, fontWeight: 800, color: 'var(--c-white)',
              boxShadow: `0 8px 28px ${av}55, 0 0 0 3px white`,
              transition: 'all .3s', fontFamily: 'var(--font-head)',
            }}>
              {init}
            </div>
            {dbUser.role === 'admin' && (
              <div style={{ position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: 8, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2.5px solid var(--c-white)', boxShadow: '0 2px 6px rgba(212,160,23,.4)' }}>
                <Shield size={12} color="var(--c-white)" />
              </div>
            )}
          </div>
          <div style={{ flex: 1, paddingBottom: 4 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.03em', fontFamily: 'var(--font-head)' }}>{dbUser.full_name}</h2>
            <p style={{ fontSize: 13, color: 'var(--c-text3)', marginTop: 3 }}>@{dbUser.username}</p>
            <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: biz.bg, color: bc, fontSize: 11.5 }}>{biz.name}</span>
              <span className={`badge ${dbUser.role === 'admin' ? 'badge-coral' : 'badge-navy'}`} style={{ fontSize: 11.5 }}>
                {dbUser.role === 'admin' ? '★ Admin' : 'Staff'}
              </span>
              <span className="badge badge-green badge-dot" style={{ fontSize: 11.5 }}>Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alert */}
      {msg && <div style={{ marginBottom: 14 }}><Alert msg={msg.m} type={msg.t} /></div>}

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 18 }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id as Tab)}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="card anim-scale-up" style={{ padding: 28 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 20, fontFamily: 'var(--font-head)' }}>Personal Information</h3>
          <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="grid-2">
              <Field label="Full Name" required><input className="input" required value={pf.full_name} onChange={e => setPf(p=>({...p,full_name:e.target.value}))} /></Field>
              <Field label="Username" required>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--mono)', fontSize: 13.5, color: 'var(--c-text3)', fontWeight: 500 }}>@</span>
                  <input className="input input-mono" style={{ paddingLeft: 27 }} required value={pf.username} onChange={e => setPf(p=>({...p,username:e.target.value.toLowerCase()}))} />
                </div>
              </Field>
            </div>
            <Field label="Email" hint="Optional — used for notifications">
              <input className="input" type="email" value={pf.email} onChange={e => setPf(p=>({...p,email:e.target.value}))} placeholder="your@email.com" />
            </Field>
            <Field label="Phone">
              <input className="input" value={pf.phone} onChange={e => setPf(p=>({...p,phone:e.target.value}))} placeholder="+63 9XX XXX XXXX" />
            </Field>
            <Field label="Bio" hint="A brief description visible to admins">
              <textarea className="input" rows={3} value={pf.bio} onChange={e => setPf(p=>({...p,bio:e.target.value}))} placeholder="Tell us about yourself…" />
            </Field>
            {/* Read-only */}
            <div className="grid-2">
              <Field label="Role">
                <div className="input" style={{ background: 'var(--bg)', cursor: 'not-allowed', opacity: .65, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Shield size={14} style={{ color: dbUser.role === 'admin' ? 'var(--gold)' : 'var(--c-text3)' }} />
                  {dbUser.role}
                </div>
              </Field>
              <Field label="Business Unit">
                <div className="input" style={{ background: 'var(--bg)', cursor: 'not-allowed', opacity: .65, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: bc }} />{biz.name}
                </div>
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <Loader size={14} className="spin" /> : <Check size={14} />}
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Security tab */}
      {tab === 'security' && (
        <div className="card anim-scale-up" style={{ padding: 28 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 6, fontFamily: 'var(--font-head)' }}>Change Password</h3>
          <p style={{ fontSize: 13, color: 'var(--c-text3)', marginBottom: 22 }}>Use a strong password with at least 8 characters — mix letters, numbers, and symbols.</p>
          <form onSubmit={savePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Current Password" required>
              <input className="input" type="password" required value={pw.cur} onChange={e => setPw(p=>({...p,cur:e.target.value}))} placeholder="Your current password" />
            </Field>
            <hr className="divider" />
            <Field label="New Password" required>
              <input className="input" type="password" required minLength={8} value={pw.next} onChange={e => setPw(p=>({...p,next:e.target.value}))} placeholder="Min. 8 characters" />
            </Field>
            <Field label="Confirm New Password" required>
              <input className="input" type="password" required value={pw.conf} onChange={e => setPw(p=>({...p,conf:e.target.value}))} placeholder="Repeat new password" style={{ borderColor: pw.conf && pw.next !== pw.conf ? 'var(--red)' : '' }} />
              {pw.conf && pw.next !== pw.conf && <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>✗ Passwords do not match</p>}
              {pw.conf && pw.next === pw.conf && pw.next && <p style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}>✓ Passwords match</p>}
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <Loader size={14} className="spin" /> : <Lock size={14} />}
                {saving ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>

          {/* Session info */}
          <div style={{ marginTop: 28, paddingTop: 22, borderTop: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Session Info</h4>
            {[
              ['Storage', 'Supabase Auth JWT (secure, server-side session)'],
              ['Authentication', 'Supabase Auth — email + password'],
              ['Auto-logout', 'On token expiry or manual sign out'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--c-text3)', fontWeight: 600 }}>{k}</span>
                <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Appearance tab */}
      {tab === 'appearance' && (
        <div className="card anim-scale-up" style={{ padding: 28 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 6, fontFamily: 'var(--font-head)' }}>Avatar Color</h3>
          <p style={{ fontSize: 13, color: 'var(--c-text3)', marginBottom: 22 }}>Your avatar color shows in the sidebar, header, and staff table.</p>

          {/* Live preview */}
          <div className="card-inset" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 18, marginBottom: 24, borderRadius: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: 'var(--c-white)', boxShadow: `0 8px 24px ${color}55`, transition: 'all .3s', flexShrink: 0, fontFamily: 'var(--font-head)' }}>
              {init}
            </div>
            <div>
              <p style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 15 }}>{pf.full_name}</p>
              <p style={{ fontSize: 12.5, color: 'var(--c-text3)' }}>@{pf.username}</p>
              <p style={{ fontSize: 11.5, fontWeight: 700, marginTop: 6, color }}>↑ Live preview</p>
            </div>
          </div>

          {/* Color palette */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
            {AVATAR_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{
                aspectRatio: '1', borderRadius: 14, background: c, cursor: 'pointer',
                transition: 'all .2s',
                transform: color === c ? 'scale(1.14)' : 'scale(1)',
                boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}, 0 6px 16px ${c}70` : '0 2px 6px rgba(0,0,0,0.1)',
                border: 'none',
              }} />
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={saveColor} disabled={saving}>
              {saving ? <Loader size={14} className="spin" /> : <Check size={14} />}
              {saving ? 'Saving…' : 'Save Color'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div>
      <label className="label">{label}{required && <span style={{ color: 'var(--gold)', marginLeft: 3 }}>*</span>}</label>
      {children}
      {hint && <p style={{ fontSize: 11.5, color: 'var(--c-text3)', marginTop: 4 }}>{hint}</p>}
    </div>
  )
}