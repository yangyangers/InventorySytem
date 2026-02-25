import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle2, Boxes, KeyRound, XCircle } from 'lucide-react'
import { sb } from '@/lib/supabase'

type Status = 'validating' | 'valid' | 'invalid' | 'success'

export default function ResetPassword() {
  const [status, setStatus]   = useState<Status>('validating')
  const [pw, setPw]           = useState('')
  const [pw2, setPw2]         = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [err, setErr]         = useState('')
  const [loading, setLoading] = useState(false)

  /* ── Supabase puts the access_token in the URL hash after redirect ── */
  useEffect(() => {
    // onAuthStateChange fires with event 'PASSWORD_RECOVERY' when the reset link is clicked
    const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('valid')
      } else if (event === 'SIGNED_IN' && status !== 'success') {
        // Already has a valid session from the reset link
        setStatus('valid')
      }
    })

    // Also check if there's already an active recovery session
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus('valid')
      } else if (status === 'validating') {
        // Give onAuthStateChange a moment to fire, then mark invalid
        const t = setTimeout(() => setStatus('invalid'), 3000)
        return () => clearTimeout(t)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  /* ── Password strength helper ── */
  function strengthLabel(p: string): { label: string; color: string; pct: number } {
    if (p.length === 0)   return { label: '', color: 'transparent', pct: 0 }
    if (p.length < 6)     return { label: 'Too short', color: '#ef4444', pct: 20 }
    if (p.length < 8)     return { label: 'Weak', color: '#f97316', pct: 40 }
    const hasUpper  = /[A-Z]/.test(p)
    const hasLower  = /[a-z]/.test(p)
    const hasDigit  = /\d/.test(p)
    const hasSymbol = /[^A-Za-z0-9]/.test(p)
    const score = [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length
    if (score < 3) return { label: 'Fair', color: '#eab308', pct: 60 }
    if (score < 4) return { label: 'Good', color: '#22c55e', pct: 80 }
    return { label: 'Strong 💪', color: '#16a34a', pct: 100 }
  }

  const strength = strengthLabel(pw)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (pw.length < 8) { setErr('Password must be at least 8 characters.'); return }
    if (pw !== pw2)    { setErr('Passwords do not match.'); return }

    setLoading(true)
    try {
      const { error } = await sb.auth.updateUser({ password: pw })
      if (error) throw error
      // Show success immediately — sign out in background, no need to wait
      setStatus('success')
      setLoading(false)
      sb.auth.signOut()  // fire and forget
    } catch (e: unknown) {
      setErr((e as Error).message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const LeftPanel = () => (
    <div style={{
      width:'clamp(280px, 40%, 440px)', minHeight:'100vh', flexShrink:0,
      background:'linear-gradient(160deg, #1a2430 0%, #141c22 55%, #101820 100%)',
      display:'flex', flexDirection:'column', padding:'38px 36px',
      position:'relative', overflow:'hidden',
      borderRight:'1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ position:'absolute', top:-80, left:-60, width:360, height:360, borderRadius:'50%', background:'radial-gradient(circle, rgba(91,148,144,0.16) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:-60, right:-40, width:280, height:280, borderRadius:'50%', background:'radial-gradient(circle, rgba(212,160,23,0.13) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ display:'flex', alignItems:'center', gap:11, position:'relative' }}>
        <div style={{ width:40, height:40, borderRadius:11, background:'linear-gradient(135deg, #d4a017, #e8b820)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 5px 18px rgba(212,160,23,0.42)', flexShrink:0 }}>
          <Boxes size={20} color="#141c22" strokeWidth={2.5} />
        </div>
        <div>
          <p style={{ color:'#fff', fontWeight:700, fontSize:15, fontFamily:'var(--font-head)', letterSpacing:'-.01em' }}>IMS Platform</p>
          <p style={{ color:'rgba(255,255,255,0.25)', fontSize:10, letterSpacing:'.10em', textTransform:'uppercase', fontWeight:600 }}>Inventory Management</p>
        </div>
      </div>
      <div style={{ flex:1, display:'flex', alignItems:'center', position:'relative' }}>
        <div>
          <h1 style={{ color:'#fff', fontWeight:800, fontSize:30, lineHeight:1.2, letterSpacing:'-.035em', marginBottom:14, fontFamily:'var(--font-head)' }}>
            Create a new<br />
            <span style={{ color:'#d4a017' }}>secure</span><br />
            <span style={{ color:'rgba(91,148,144,0.85)' }}>password.</span>
          </h1>
          <p style={{ color:'rgba(255,255,255,0.35)', fontSize:13.5, lineHeight:1.7, maxWidth:290 }}>
            Choose something strong — mix uppercase, lowercase, numbers, and symbols for best security.
          </p>
          <ul style={{ marginTop:20, display:'flex', flexDirection:'column', gap:8, padding:0, listStyle:'none' }}>
            {['At least 8 characters', 'Mix of letters & numbers', 'At least one symbol (recommended)'].map(tip => (
              <li key={tip} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:'#d4a017', flexShrink:0 }} />
                <span style={{ color:'rgba(255,255,255,0.45)', fontSize:12.5 }}>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'var(--font)', background:'var(--c-bg)', flexWrap:'wrap' }}>
      <LeftPanel />

      <div style={{ flex:1, minWidth:'280px', display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 20px' }}>
        <div className="anim-fade-up" style={{ width:'100%', maxWidth:400 }}>
          <div style={{ background:'var(--c-white)', borderRadius:18, padding:'34px 30px', boxShadow:'var(--shadow-lg), 0 0 0 1px rgba(20,28,34,0.06)', border:'1px solid var(--c-border)' }}>

            {status === 'validating' && (
              <div style={{ textAlign:'center', padding:'20px 0' }}>
                <svg className="spin" width={32} height={32} viewBox="0 0 24 24" fill="none" style={{ margin:'0 auto 16px', display:'block' }}>
                  <circle cx="12" cy="12" r="10" stroke="var(--c-border)" strokeWidth="4" />
                  <path fill="var(--c-gold)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p style={{ color:'var(--c-text3)', fontSize:14 }}>Validating reset link…</p>
              </div>
            )}

            {status === 'invalid' && (
              <div style={{ textAlign:'center', padding:'8px 0' }}>
                <div style={{ width:56, height:56, borderRadius:16, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.22)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                  <XCircle size={26} color="#ef4444" />
                </div>
                <h2 style={{ fontSize:22, fontWeight:800, color:'var(--c-text)', letterSpacing:'-.03em', marginBottom:10, fontFamily:'var(--font-head)' }}>Invalid or expired link</h2>
                <p style={{ fontSize:13.5, color:'var(--c-text3)', lineHeight:1.7, marginBottom:24 }}>
                  This reset link is invalid or has expired. Reset links are valid for 1 hour.
                </p>
                <Link to="/forgot-password" className="btn btn-primary" style={{ display:'inline-flex', gap:8, borderRadius:9, textDecoration:'none' }}>
                  Request a new link
                </Link>
              </div>
            )}

            {status === 'valid' && (
              <>
                <div style={{ marginBottom:26 }}>
                  <div style={{ width:46, height:46, borderRadius:13, background:'var(--c-gold-dim)', border:'1px solid rgba(212,160,23,0.22)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                    <KeyRound size={20} color="var(--c-gold-d)" />
                  </div>
                  <h2 style={{ fontSize:24, fontWeight:800, color:'var(--c-text)', letterSpacing:'-.03em', marginBottom:6, fontFamily:'var(--font-head)' }}>Set new password</h2>
                  <p style={{ fontSize:13.5, color:'var(--c-text3)' }}>Choose a strong password to secure your account.</p>
                </div>

                <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  <div>
                    <label className="label">New password</label>
                    <div style={{ position:'relative' }}>
                      <input
                        className="input"
                        type={showPw ? 'text' : 'password'}
                        style={{ paddingRight:44 }}
                        placeholder="Enter new password"
                        value={pw}
                        onChange={e => setPw(e.target.value)}
                        required
                        autoFocus
                        autoComplete="new-password"
                        minLength={8}
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:'var(--c-text3)', background:'none', border:'none', cursor:'pointer', display:'flex', padding:2 }}>
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {pw.length > 0 && (
                      <div style={{ marginTop:8 }}>
                        <div style={{ height:4, borderRadius:4, background:'var(--c-border)', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${strength.pct}%`, background:strength.color, borderRadius:4, transition:'all .3s' }} />
                        </div>
                        <p style={{ fontSize:11.5, color:strength.color, marginTop:4, fontWeight:600 }}>{strength.label}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="label">Confirm password</label>
                    <input
                      className="input"
                      type={showPw ? 'text' : 'password'}
                      placeholder="Repeat new password"
                      value={pw2}
                      onChange={e => setPw2(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    {pw2.length > 0 && pw !== pw2 && (
                      <p style={{ fontSize:11.5, color:'#ef4444', marginTop:4, fontWeight:500 }}>Passwords don't match</p>
                    )}
                  </div>

                  {err && (
                    <div className="alert alert-err">
                      <AlertCircle size={14} style={{ flexShrink:0 }} /><span>{err}</span>
                    </div>
                  )}

                  <button type="submit" disabled={loading || pw !== pw2 || pw.length < 8} className="btn btn-primary btn-lg" style={{ width:'100%', borderRadius:9, marginTop:3 }}>
                    {loading
                      ? <><svg className="spin" width={15} height={15} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity:.25 }} /><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" style={{ opacity:.8 }} /></svg>Updating…</>
                      : <><KeyRound size={15} />Set new password</>
                    }
                  </button>
                </form>
              </>
            )}

            {status === 'success' && (
              <div style={{ textAlign:'center', padding:'8px 0' }}>
                <div style={{ width:56, height:56, borderRadius:16, background:'rgba(34,197,94,0.10)', border:'1px solid rgba(34,197,94,0.22)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                  <CheckCircle2 size={26} color="#22c55e" />
                </div>
                <h2 style={{ fontSize:22, fontWeight:800, color:'var(--c-text)', letterSpacing:'-.03em', marginBottom:10, fontFamily:'var(--font-head)' }}>Password updated!</h2>
                <p style={{ fontSize:13.5, color:'var(--c-text3)', lineHeight:1.7, marginBottom:24 }}>
                  Your password has been changed successfully. Sign in with your new password.
                </p>
                <Link to="/login" className="btn btn-primary" style={{ display:'inline-flex', gap:8, borderRadius:9, textDecoration:'none' }}>
                  Sign in now
                </Link>
              </div>
            )}
          </div>

          <div style={{ textAlign:'center', marginTop:18 }}>
            <Link to="/login" style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'var(--c-text3)', textDecoration:'none', fontWeight:500 }}>
              <ArrowLeft size={13} /> Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}