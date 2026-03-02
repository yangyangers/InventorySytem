import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, Boxes, ArrowRight, Zap } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { BIZ } from '@/types'
import { BIZ_LOGOS } from '@/lib/logos'

export default function Login() {
  const nav = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [err, setErr]               = useState('')
  const [loading, setLoading]       = useState(false)

  /** Resolve a username or email to an email address */
  async function resolveEmail(raw: string): Promise<string | null> {
    const val = raw.toLowerCase().trim()
    if (val.includes('@')) return val
    const { data } = await sb
      .from('users')
      .select('email')
      .eq('username', val)
      .maybeSingle()
    return data?.email ?? null
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      const email = await resolveEmail(identifier)
      if (!email) {
        setErr('No account found with that username or email.')
        return
      }
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.toLowerCase().includes('invalid'))
          setErr('Incorrect credentials. Please try again.')
        else if (error.message.toLowerCase().includes('email not confirmed'))
          setErr('Please confirm your email before signing in.')
        else
          setErr(error.message)
        return
      }
      nav('/')
    } catch { setErr('Connection error — check your Supabase config.') }
    finally { setLoading(false) }
  }

  return (
    <>
      <style>{`
        .login-wrap { display: flex; min-height: 100vh; font-family: var(--font); background: var(--c-bg); }
        .login-left {
          width: clamp(280px, 40%, 440px); min-height: 100vh; flex-shrink: 0;
          background: linear-gradient(160deg, #1a2430 0%, #141c22 55%, #101820 100%);
          display: flex; flex-direction: column; padding: 38px 36px;
          position: relative; overflow: hidden;
          border-right: 1px solid rgba(255,255,255,0.05);
        }
        .login-right {
          flex: 1; min-width: 280px; display: flex;
          align-items: center; justify-content: center; padding: 32px 20px;
        }
        .login-card {
          background: var(--c-white); border-radius: 18px; padding: 34px 30px;
          box-shadow: var(--shadow-lg), 0 0 0 1px rgba(20,28,34,0.06);
          border: 1px solid var(--c-border);
        }
        @media (max-width: 640px) {
          .login-wrap { flex-direction: column; }
          .login-left {
            width: 100%; min-height: unset;
            padding: 20px 20px 18px;
            border-right: none;
            border-bottom: 1px solid rgba(255,255,255,0.07);
          }
          .login-left-headline { display: none; }
          .login-left-biz { display: none; }
          .login-left-logo { margin-bottom: 0 !important; }
          .login-right { padding: 24px 16px 40px; }
          .login-card { padding: 22px 18px !important; border-radius: 14px; }
        }
        @media (min-width: 641px) and (max-width: 900px) {
          .login-left { width: clamp(240px, 35%, 300px); padding: 28px 22px; }
          .login-left-headline h1 { font-size: 22px !important; }
          .login-left-biz { display: none; }
        }
      `}</style>

      <div className="login-wrap">

        {/* ── Left panel ── */}
        <div className="login-left">
          <div style={{ position:'absolute', top:-80, left:-60, width:360, height:360, borderRadius:'50%', background:'radial-gradient(circle, rgba(91,148,144,0.16) 0%, transparent 70%)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:-60, right:-40, width:280, height:280, borderRadius:'50%', background:'radial-gradient(circle, rgba(212,160,23,0.13) 0%, transparent 70%)', pointerEvents:'none' }} />

          {/* Logo */}
          <div className="login-left-logo" style={{ display:'flex', alignItems:'center', gap:11, marginBottom:44, position:'relative' }}>
            <div style={{ width:40, height:40, borderRadius:11, background:'linear-gradient(135deg, #d4a017, #e8b820)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 5px 18px rgba(212,160,23,0.42)', flexShrink:0 }}>
              <Boxes size={20} color="#141c22" strokeWidth={2.5} />
            </div>
            <div>
              <p style={{ color:'#fff', fontWeight:700, fontSize:15, fontFamily:'var(--font-head)', letterSpacing:'-.01em' }}>IMS Platform</p>
              <p style={{ color:'rgba(255,255,255,0.25)', fontSize:10, letterSpacing:'.10em', textTransform:'uppercase', fontWeight:600 }}>Inventory Management</p>
            </div>
          </div>

          {/* Headline */}
          <div className="login-left-headline" style={{ flex:1, position:'relative' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 11px', borderRadius:20, background:'rgba(212,160,23,0.13)', border:'1px solid rgba(212,160,23,0.24)', marginBottom:18 }}>
              <Zap size={11} color="#d4a017" />
              <span style={{ fontSize:10, fontWeight:700, color:'#d4a017', letterSpacing:'.08em', textTransform:'uppercase' }}>Real-Time Inventory</span>
            </div>
            <h1 style={{ color:'#fff', fontWeight:800, fontSize:32, lineHeight:1.14, letterSpacing:'-.035em', marginBottom:14, fontFamily:'var(--font-head)' }}>
              Manage stock.<br />
              <span style={{ color:'#d4a017' }}>Move fast.</span><br />
              <span style={{ color:'rgba(91,148,144,0.85)' }}>Stay ahead.</span>
            </h1>
            <p style={{ color:'rgba(255,255,255,0.35)', fontSize:13.5, lineHeight:1.7, maxWidth:310 }}>
              Unified real-time inventory across all business units — built for clarity and speed.
            </p>
          </div>

          {/* Business units */}
          <div className="login-left-biz" style={{ position:'relative', marginTop:28 }}>
            <p style={{ color:'rgba(255,255,255,0.20)', fontSize:9.5, fontWeight:700, letterSpacing:'.13em', textTransform:'uppercase', marginBottom:12 }}>Business Units</p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {Object.entries(BIZ).map(([id, b]) => (
                <div key={id} style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <img src={BIZ_LOGOS[id]} alt={b.name} style={{ height:28, width:80, objectFit:'contain', objectPosition:'left center', display:'block', filter:'brightness(0) invert(1)', opacity:0.85, flexShrink:0 }} />
                  <div style={{ width:1, height:20, background:'rgba(255,255,255,0.10)', flexShrink:0 }} />
                  <div style={{ minWidth:0, flex:1 }}>
                    <p style={{ fontWeight:700, fontSize:11.5, color:'rgba(255,255,255,0.80)', fontFamily:'var(--font-head)', lineHeight:1.2 }}>{b.name}</p>
                    <p style={{ fontSize:10, color:'rgba(255,255,255,0.35)', lineHeight:1.3 }}>{b.desc}</p>
                  </div>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:b.color, boxShadow:`0 0 7px ${b.color}`, flexShrink:0 }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="login-right">
          <div className="anim-fade-up" style={{ width:'100%', maxWidth:400 }}>
            <div className="login-card">
              <div style={{ marginBottom:26 }}>
                <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 11px', borderRadius:20, background:'var(--c-gold-dim)', border:'1px solid rgba(212,160,23,0.22)', marginBottom:15 }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background:'var(--c-gold)', boxShadow:'0 0 6px var(--c-gold)' }} />
                  <span style={{ fontSize:10.5, fontWeight:700, color:'var(--c-gold-d)', letterSpacing:'.07em', textTransform:'uppercase' }}>Secure Login</span>
                </div>
                <h2 style={{ fontSize:24, fontWeight:800, color:'var(--c-text)', letterSpacing:'-.03em', marginBottom:7, fontFamily:'var(--font-head)' }}>Welcome back 👋</h2>
                <p style={{ fontSize:13.5, color:'var(--c-text3)' }}>Sign in with your username or email</p>
              </div>

              <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <label className="label">Username or Email</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="username or you@example.com"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    required
                    autoFocus
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <label className="label" style={{ marginBottom:0 }}>Password</label>
                    <Link to="/forgot-password" style={{ fontSize:12, color:'var(--c-teal)', fontWeight:600, textDecoration:'none' }}>Forgot password?</Link>
                  </div>
                  <div style={{ position:'relative' }}>
                    <input
                      className="input"
                      type={showPw ? 'text' : 'password'}
                      style={{ paddingRight:44 }}
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:'var(--c-text3)', background:'none', border:'none', cursor:'pointer', display:'flex', padding:2 }}>
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {err && (
                  <div className="alert alert-err">
                    <AlertCircle size={14} style={{ flexShrink:0 }} /><span>{err}</span>
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width:'100%', borderRadius:9, marginTop:3 }}>
                  {loading
                    ? <><svg className="spin" width={15} height={15} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity:.25 }} /><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" style={{ opacity:.8 }} /></svg>Signing in…</>
                    : <>Sign In <ArrowRight size={15} /></>
                  }
                </button>
              </form>
            </div>
            <p style={{ textAlign:'center', fontSize:12, color:'var(--c-text4)', marginTop:18 }}>
              No account? <span style={{ color:'var(--c-teal)', fontWeight:600 }}>Contact your administrator.</span>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}