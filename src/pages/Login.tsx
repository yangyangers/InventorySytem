import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, Boxes, ArrowRight, Zap } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { BIZ, SessionUser } from '@/types'
import { BIZ_LOGOS } from '@/lib/logos'
import bcrypt from 'bcryptjs'

export default function Login() {
  const { setUser } = useAuth()
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [err, setErr]           = useState('')
  const [loading, setLoading]   = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      const { data, error } = await sb
        .from('users').select('*')
        .eq('username', username.toLowerCase().trim())
        .eq('is_active', true).single()
      if (error || !data) { setErr('Username not found or account is inactive.'); return }
      const ok = await bcrypt.compare(password, data.password_hash)
      if (!ok) { setErr('Incorrect password. Please try again.'); return }
      setUser({ id: data.id, username: data.username, full_name: data.full_name, email: data.email, role: data.role, business_id: data.business_id, avatar_color: data.avatar_color, password_hash: data.password_hash } as SessionUser)
      nav('/')
    } catch { setErr('Connection error — check your Supabase config.') }
    finally { setLoading(false) }
  }

  const isWhiteLogo = (id: string) => id === 'wellbuild' || id === 'tcchemical'

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'var(--font)' }}>

      {/* ── Left dark panel ──────────────────────────── */}
      <div style={{
        width: 460, flexShrink: 0,
        background: 'linear-gradient(160deg, #1a2430 0%, #141b22 50%, #111820 100%)',
        display: 'flex', flexDirection: 'column', padding: '40px 40px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient glows */}
        <div style={{ position: 'absolute', top: -80, left: -80, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,148,144,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, right: -60, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,160,23,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* IMS Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 48, position: 'relative' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #d4a017, #e0b530)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(212,160,23,0.50)', flexShrink: 0 }}>
            <Boxes size={22} color="#141b22" strokeWidth={2.5} />
          </div>
          <div>
            <p style={{ color: '#fff', fontWeight: 800, fontSize: 17, fontFamily: 'var(--font-head)', letterSpacing: '-.02em' }}>IMS Platform</p>
            <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>Inventory Management</p>
          </div>
        </div>

        {/* Headline */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: 'rgba(212,160,23,0.14)', border: '1px solid rgba(212,160,23,0.25)', marginBottom: 20 }}>
            <Zap size={12} color="#d4a017" />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#d4a017', letterSpacing: '.06em', textTransform: 'uppercase' }}>Real-Time Inventory</span>
          </div>
          <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 36, lineHeight: 1.12, letterSpacing: '-.04em', marginBottom: 16, fontFamily: 'var(--font-head)' }}>
            Manage stock.<br />
            <span style={{ color: '#d4a017' }}>Move fast.</span><br />
            <span style={{ color: 'rgba(91,148,144,0.90)' }}>Stay ahead.</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14, lineHeight: 1.75, maxWidth: 340 }}>
            Unified real-time inventory across all business units — built for clarity and speed.
          </p>
        </div>

        {/* ── Business unit logo cards ────────────── */}
        <div style={{ position: 'relative' }}>
          <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 9.5, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10 }}>Business Units</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(BIZ).map(([id, b]) => (
              <div key={id} style={{
                display: 'flex', alignItems: 'center', gap: 13,
                padding: '10px 14px',
                borderRadius: 12,
                background: isWhiteLogo(id) ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.92)',
                border: `1px solid ${b.color}30`,
                overflow: 'hidden',
              }}>
                {/* Logo thumbnail */}
                <div style={{
                  width: 42, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <img
                    src={BIZ_LOGOS[id]}
                    alt={b.name}
                    style={{
                      maxWidth: 42, maxHeight: 34,
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                </div>

                {/* Divider */}
                <div style={{ width: 1, height: 28, background: isWhiteLogo(id) ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)', flexShrink: 0 }} />

                {/* Text */}
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontWeight: 800, fontSize: 12.5,
                    color: isWhiteLogo(id) ? '#fff' : '#141b22',
                    fontFamily: 'var(--font-head)',
                    letterSpacing: '.02em',
                    lineHeight: 1.2,
                  }}>{b.name}</p>
                  <p style={{
                    fontSize: 11,
                    color: isWhiteLogo(id) ? 'rgba(255,255,255,0.42)' : 'rgba(20,27,34,0.50)',
                    lineHeight: 1.3,
                  }}>{b.desc}</p>
                </div>

                {/* Color accent dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: b.color,
                  boxShadow: `0 0 8px ${b.color}`,
                  flexShrink: 0, marginLeft: 'auto',
                }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: 'var(--bg)' }}>
        <div className="anim-fade-up" style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ background: 'var(--white)', borderRadius: 22, padding: '40px 36px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <div style={{ marginBottom: 30 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 20, background: 'var(--gold-l)', border: '1px solid rgba(212,160,23,0.25)', marginBottom: 18 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 6px var(--gold)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Secure Login</span>
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.04em', marginBottom: 8, fontFamily: 'var(--font-head)' }}>Welcome back 👋</h2>
              <p style={{ fontSize: 14, color: 'var(--ink-3)' }}>Sign in with your username to continue</p>
            </div>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label className="label">Username</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 14, pointerEvents: 'none', fontWeight: 500 }}>@</span>
                  <input className="input input-mono" style={{ paddingLeft: 30 }} placeholder="your.username" value={username} onChange={e => setUsername(e.target.value)} required autoFocus autoComplete="username" />
                </div>
              </div>
              <div>
                <label className="label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input className="input" type={showPw ? 'text' : 'password'} style={{ paddingRight: 46 }} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2 }}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {err && (
                <div className="alert alert-err">
                  <AlertCircle size={15} style={{ flexShrink: 0 }} /><span>{err}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width: '100%', borderRadius: 10, marginTop: 4 }}>
                {loading
                  ? <><svg className="spin" width={16} height={16} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity:.25 }} /><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" style={{ opacity:.8 }} /></svg>Signing in…</>
                  : <>Sign In <ArrowRight size={16} /></>
                }
              </button>
            </form>
          </div>
          <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 22 }}>
            No account? <span style={{ color: 'var(--gold)', fontWeight: 700 }}>Contact your administrator.</span>
          </p>
        </div>
      </div>
    </div>
  )
}
