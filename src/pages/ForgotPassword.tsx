import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, AlertCircle, ArrowLeft, CheckCircle2, Boxes, Zap } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { BIZ } from '@/types'
import { BIZ_LOGOS } from '@/lib/logos'

export default function ForgotPassword() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState('')
  const [sent, setSent]       = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      const { error } = await sb.auth.resetPasswordForEmail(
        email.toLowerCase().trim(),
        { redirectTo: `${window.location.origin}/reset-password` }
      )
      // Always show success even if email not found (prevents user enumeration)
      if (error && !error.message.includes('not found')) throw error
      setSent(true)
    } catch (e: unknown) {
      setErr((e as Error).message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'var(--font)', background:'var(--c-bg)', flexWrap:'wrap' }}>

      {/* ── Left panel (same as Login) ──────────────────── */}
      <div style={{
        width:'clamp(280px, 40%, 440px)', minHeight:'100vh', flexShrink:0,
        background:'linear-gradient(160deg, #1a2430 0%, #141c22 55%, #101820 100%)',
        display:'flex', flexDirection:'column', padding:'38px 36px',
        position:'relative', overflow:'hidden',
        borderRight:'1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ position:'absolute', top:-80, left:-60, width:360, height:360, borderRadius:'50%', background:'radial-gradient(circle, rgba(91,148,144,0.16) 0%, transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-60, right:-40, width:280, height:280, borderRadius:'50%', background:'radial-gradient(circle, rgba(212,160,23,0.13) 0%, transparent 70%)', pointerEvents:'none' }} />

        <div style={{ display:'flex', alignItems:'center', gap:11, marginBottom:44, position:'relative' }}>
          <div style={{ width:40, height:40, borderRadius:11, background:'linear-gradient(135deg, #d4a017, #e8b820)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 5px 18px rgba(212,160,23,0.42)', flexShrink:0 }}>
            <Boxes size={20} color="#141c22" strokeWidth={2.5} />
          </div>
          <div>
            <p style={{ color:'#fff', fontWeight:700, fontSize:15, fontFamily:'var(--font-head)', letterSpacing:'-.01em' }}>IMS Platform</p>
            <p style={{ color:'rgba(255,255,255,0.25)', fontSize:10, letterSpacing:'.10em', textTransform:'uppercase', fontWeight:600 }}>Inventory Management</p>
          </div>
        </div>

        <div style={{ flex:1, position:'relative' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 11px', borderRadius:20, background:'rgba(212,160,23,0.13)', border:'1px solid rgba(212,160,23,0.24)', marginBottom:18 }}>
            <Zap size={11} color="#d4a017" />
            <span style={{ fontSize:10, fontWeight:700, color:'#d4a017', letterSpacing:'.08em', textTransform:'uppercase' }}>Account Recovery</span>
          </div>
          <h1 style={{ color:'#fff', fontWeight:800, fontSize:32, lineHeight:1.14, letterSpacing:'-.035em', marginBottom:14, fontFamily:'var(--font-head)' }}>
            Forgot your<br />
            <span style={{ color:'#d4a017' }}>password?</span><br />
            <span style={{ color:'rgba(91,148,144,0.85)', fontSize:24 }}>We've got you.</span>
          </h1>
          <p style={{ color:'rgba(255,255,255,0.35)', fontSize:13.5, lineHeight:1.7, maxWidth:310 }}>
            Enter the email linked to your account and we'll send you a secure reset link.
          </p>
        </div>

        <div style={{ position:'relative', marginTop:28 }}>
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

      {/* ── Right panel ─────────────────── */}
      <div style={{ flex:1, minWidth:'280px', display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 20px' }}>
        <div className="anim-fade-up" style={{ width:'100%', maxWidth:400 }}>
          <div style={{ background:'var(--c-white)', borderRadius:18, padding:'34px 30px', boxShadow:'var(--shadow-lg), 0 0 0 1px rgba(20,28,34,0.06)', border:'1px solid var(--c-border)' }}>

            {!sent ? (
              <>
                <div style={{ marginBottom:26 }}>
                  <div style={{ width:46, height:46, borderRadius:13, background:'var(--c-gold-dim)', border:'1px solid rgba(212,160,23,0.22)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                    <Mail size={20} color="var(--c-gold-d)" />
                  </div>
                  <h2 style={{ fontSize:24, fontWeight:800, color:'var(--c-text)', letterSpacing:'-.03em', marginBottom:7, fontFamily:'var(--font-head)' }}>Reset password</h2>
                  <p style={{ fontSize:13.5, color:'var(--c-text3)' }}>Enter your account email and we'll send you a reset link.</p>
                </div>

                <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  <div>
                    <label className="label">Email address</label>
                    <input
                      className="input"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                      autoComplete="email"
                    />
                  </div>

                  {err && (
                    <div className="alert alert-err">
                      <AlertCircle size={14} style={{ flexShrink:0 }} /><span>{err}</span>
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width:'100%', borderRadius:9, marginTop:3 }}>
                    {loading
                      ? <><svg className="spin" width={15} height={15} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity:.25 }} /><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" style={{ opacity:.8 }} /></svg>Sending…</>
                      : <><Mail size={15} />Send reset link</>
                    }
                  </button>
                </form>
              </>
            ) : (
              /* ── Success state ── */
              <div style={{ textAlign:'center', padding:'8px 0' }}>
                <div style={{ width:56, height:56, borderRadius:16, background:'rgba(34,197,94,0.10)', border:'1px solid rgba(34,197,94,0.22)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                  <CheckCircle2 size={26} color="#22c55e" />
                </div>
                <h2 style={{ fontSize:22, fontWeight:800, color:'var(--c-text)', letterSpacing:'-.03em', marginBottom:10, fontFamily:'var(--font-head)' }}>Check your inbox</h2>
                <p style={{ fontSize:13.5, color:'var(--c-text3)', lineHeight:1.7, marginBottom:24 }}>
                  If <strong style={{ color:'var(--c-text)' }}>{email}</strong> is linked to an active account, you'll receive a password reset email within a few minutes.
                </p>
                <p style={{ fontSize:12.5, color:'var(--c-text4)', marginBottom:20 }}>
                  Didn't get it? Check your spam folder, or{' '}
                  <button
                    onClick={() => { setSent(false); setErr('') }}
                    style={{ background:'none', border:'none', color:'var(--c-teal)', fontWeight:600, cursor:'pointer', padding:0, fontSize:'inherit' }}
                  >try again</button>.
                </p>
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
