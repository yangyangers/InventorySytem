import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, Boxes, ArrowRight, Sun, Moon, Shield, Layers, BarChart3 } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { BIZ } from '@/types'
import { BIZ_LOGOS } from '@/lib/logos'
import { useTheme } from '@/store/theme'

export default function Login() {
  const nav = useNavigate()
  const { dark, toggle } = useTheme()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [err, setErr]               = useState('')
  const [loading, setLoading]       = useState(false)
  const [focused, setFocused]       = useState<string | null>(null)

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

  const features = [
    { icon: <Layers size={14} />, label: 'Multi-Business Inventory' },
    { icon: <BarChart3 size={14} />, label: 'Real-Time Analytics' },
    { icon: <Shield size={14} />, label: 'Role-Based Access Control' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;800;900&display=swap');

        .lp-root {
          display: flex; width: 100%;
          min-height: 100vh;
          font-family: var(--font);
          background: var(--c-bg);
          position: relative;
          overflow: hidden;
          transition: background .25s;
          
        }

        .lp-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
          z-index: 0;
        }
        .lp-orb-1 {
          width: 600px; height: 600px;
          top: -200px; left: -150px;
          background: radial-gradient(circle, rgba(91,148,144,0.11) 0%, transparent 70%);
        }
        .lp-orb-2 {
          width: 500px; height: 500px;
          bottom: -150px; right: -100px;
          background: radial-gradient(circle, rgba(212,160,23,0.09) 0%, transparent 70%);
        }
        [data-theme="dark"] .lp-orb-1 {
          background: radial-gradient(circle, rgba(91,148,144,0.18) 0%, transparent 70%);
        }
        [data-theme="dark"] .lp-orb-2 {
          background: radial-gradient(circle, rgba(212,160,23,0.14) 0%, transparent 70%);
        }

        .lp-grid {
          position: fixed; inset: 0;
          pointer-events: none; z-index: 0;
          background-image:
            linear-gradient(rgba(91,148,144,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(91,148,144,0.035) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 100%);
        }
        [data-theme="dark"] .lp-grid {
          background-image:
            linear-gradient(rgba(91,148,144,0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(91,148,144,0.055) 1px, transparent 1px);
        }

        /* ── Left panel ── */
        .lp-left {
          width: clamp(300px, 42%, 480px);
          min-height: 100vh;
          flex-shrink: 0;
          background: linear-gradient(160deg, #141c22 0%, #0f1720 60%, #0a1018 100%);
          display: flex; flex-direction: column;
          padding: 44px 42px;
          position: relative; overflow: hidden;
          border-right: 1px solid rgba(255,255,255,0.06);
          z-index: 1;
        }
        .lp-left::before {
          content: '';
          position: absolute; top: -30%; left: -20%;
          width: 100%; height: 120%;
          background: linear-gradient(125deg, rgba(91,148,144,0.07) 0%, transparent 60%);
          pointer-events: none;
        }
        .lp-left::after {
          content: '';
          position: absolute; bottom: -10%; right: -10%;
          width: 60%; height: 60%;
          background: radial-gradient(circle, rgba(212,160,23,0.09) 0%, transparent 65%);
          pointer-events: none;
        }

        .lp-logo {
          display: flex; align-items: center; gap: 13px;
          position: relative; z-index: 2; margin-bottom: 52px;
        }
        .lp-logo-icon {
          width: 44px; height: 44px; border-radius: 13px;
          background: linear-gradient(135deg, #d4a017, #e8c04a);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 22px rgba(212,160,23,0.45), 0 2px 8px rgba(0,0,0,0.3);
          flex-shrink: 0;
        }
        .lp-logo p:first-child {
          color: #fff; font-weight: 800; font-size: 15.5px;
          font-family: 'Outfit', var(--font-head);
          letter-spacing: -.02em; line-height: 1;
        }
        .lp-logo p:last-child {
          color: rgba(255,255,255,0.28); font-size: 10px;
          letter-spacing: .10em; text-transform: uppercase;
          font-weight: 600; margin-top: 3px;
        }

        .lp-headline { flex: 1; position: relative; z-index: 2; }

        .lp-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 12px; border-radius: 20px;
          background: rgba(212,160,23,0.12);
          border: 1px solid rgba(212,160,23,0.26);
          margin-bottom: 22px;
        }
        .lp-badge span {
          font-size: 10px; font-weight: 700; color: #d4a017;
          letter-spacing: .09em; text-transform: uppercase;
        }

        .lp-h1 {
          color: #fff; font-weight: 800; font-size: 38px;
          line-height: 1.08; letter-spacing: -.04em; margin-bottom: 18px;
          font-family: 'Outfit', var(--font-head);
        }
        .lp-h1 .ag { color: #d4a017; }
        .lp-h1 .at { color: rgba(91,148,144,0.9); }

        .lp-sub {
          color: rgba(255,255,255,0.32); font-size: 13.5px;
          line-height: 1.75; max-width: 320px; margin-bottom: 36px;
        }

        .lp-features { display: flex; flex-direction: column; gap: 9px; margin-bottom: 36px; }
        .lp-fpill {
          display: inline-flex; align-items: center; gap: 9px;
          padding: 8px 14px; border-radius: 9px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          width: fit-content; transition: all .2s;
        }
        .lp-fpill:hover { background: rgba(91,148,144,0.10); border-color: rgba(91,148,144,0.22); }
        .lp-fpill .fi { color: #6aaba6; opacity: .85; }
        .lp-fpill span { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.55); }

        .lp-biz-label {
          color: rgba(255,255,255,0.18); font-size: 9.5px;
          font-weight: 700; letter-spacing: .15em;
          text-transform: uppercase; margin-bottom: 14px;
          position: relative; z-index: 2;
        }
        .lp-biz-row {
          display: flex; align-items: center; gap: 14px;
          padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
          position: relative; z-index: 2;
        }
        .lp-biz-row:last-child { border-bottom: none; }
        .lp-biz-img {
          height: 24px; width: 76px; object-fit: contain;
          object-position: left center; display: block;
          filter: brightness(0) invert(1); opacity: .75; flex-shrink: 0;
        }
        .lp-biz-sep { width: 1px; height: 18px; background: rgba(255,255,255,0.09); flex-shrink: 0; }
        .lp-biz-info { min-width: 0; flex: 1; }
        .lp-biz-n { font-weight: 700; font-size: 11.5px; color: rgba(255,255,255,0.75); font-family: var(--font-head); line-height: 1.2; }
        .lp-biz-d { font-size: 10px; color: rgba(255,255,255,0.32); line-height: 1.3; margin-top: 1px; }
        .lp-biz-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

        /* ── Right panel ── */
        .lp-right {
          flex: 1; min-width: 280px; align-self: stretch;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 40px 24px;
          position: relative; z-index: 1;
        }

        /* Dark mode toggle */
        .lp-theme-btn {
          position: absolute; top: 22px; right: 22px;
          display: flex; align-items: center; gap: 7px;
          padding: 7px 14px; border-radius: 9px;
          border: 1.5px solid var(--c-border);
          background: var(--c-white);
          color: var(--c-text3);
          cursor: pointer; font-size: 12px; font-weight: 600;
          font-family: var(--font); box-shadow: var(--shadow-xs);
          transition: all .2s; z-index: 10;
        }
        .lp-theme-btn:hover {
          background: var(--c-bg); border-color: var(--c-border2);
          color: var(--c-text2); box-shadow: var(--shadow-sm);
        }
        @media (max-width: 520px) { .lp-theme-label { display: none; } }

        /* Card */
        .lp-wrap {
          width: 100%; max-width: 400px; min-width: 280px;
          animation: lp-rise .5s cubic-bezier(.16,1,.3,1) both;
        }
        @keyframes lp-rise {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lp-card {
          background: var(--c-white);
          border-radius: 20px;
          padding: 36px 34px;
          box-shadow: var(--shadow-lg), 0 0 0 1px rgba(20,28,34,0.06);
          border: 1px solid var(--c-border);
          transition: background .25s, border-color .25s, box-shadow .25s;
          position: relative; overflow: hidden;
        }
        [data-theme="dark"] .lp-card {
          box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.05);
        }
        .lp-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, #d4a017, rgba(91,148,144,0.55), transparent);
          border-radius: 20px 20px 0 0;
        }

        .lp-card-hd { margin-bottom: 26px; }
        .lp-sbadge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 11px; border-radius: 20px;
          background: var(--c-gold-dim);
          border: 1px solid rgba(212,160,23,0.22);
          margin-bottom: 16px;
        }
        .lp-sdot {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--c-gold); box-shadow: 0 0 7px var(--c-gold);
          animation: sdot-pulse 2.2s ease-in-out infinite;
        }
        @keyframes sdot-pulse {
          0%,100% { box-shadow: 0 0 7px var(--c-gold); }
          50% { box-shadow: 0 0 14px var(--c-gold); }
        }
        .lp-stxt {
          font-size: 10.5px; font-weight: 700; color: var(--c-gold-d);
          letter-spacing: .07em; text-transform: uppercase;
        }
        .lp-title {
          font-size: 26px; font-weight: 800; color: var(--c-text);
          letter-spacing: -.035em; margin-bottom: 6px;
          font-family: 'Outfit', var(--font-head); line-height: 1.1;
        }
        .lp-sub2 { font-size: 13.5px; color: var(--c-text3); line-height: 1.5; }

        .lp-div {
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--c-border), transparent);
          margin: 2px 0 20px;
        }

        .lp-field { display: flex; flex-direction: column; gap: 5px; }
        .lp-lbl {
          font-size: 12px; font-weight: 700; color: var(--c-text2);
          letter-spacing: .02em; transition: color .15s;
        }
        .lp-lbl.on { color: var(--c-teal); }
        .lp-ir { position: relative; }
        .lp-in {
          width: 100%; height: 44px; padding: 0 14px;
          border-radius: 10px; border: 1.5px solid var(--c-border);
          background: var(--c-bg); color: var(--c-text);
          font-size: 14px; font-family: var(--font);
          outline: none; transition: all .18s; box-sizing: border-box;
        }
        .lp-in::placeholder { color: var(--c-text4); }
        .lp-in:focus {
          border-color: var(--c-teal); background: var(--c-white);
          box-shadow: 0 0 0 3px var(--c-teal-dim), 0 1px 3px rgba(0,0,0,0.06);
        }
        [data-theme="dark"] .lp-in { background: var(--c-bg2); border-color: var(--c-border2); }
        [data-theme="dark"] .lp-in:focus { background: var(--c-bg); }
        .lp-pr { padding-right: 46px; }
        .lp-peye {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: var(--c-text4);
          cursor: pointer; display: flex; padding: 4px; border-radius: 5px;
          transition: color .15s;
        }
        .lp-peye:hover { color: var(--c-text2); }

        .lp-pw-row { display: flex; justify-content: space-between; align-items: center; }
        .lp-frgt {
          font-size: 12px; color: var(--c-teal);
          font-weight: 600; text-decoration: none; transition: opacity .15s;
        }
        .lp-frgt:hover { opacity: .75; }

        .lp-err {
          display: flex; align-items: flex-start; gap: 9px;
          padding: 11px 14px; border-radius: 9px;
          background: var(--c-red-dim);
          border: 1px solid rgba(201,78,78,0.22);
          color: var(--c-red); font-size: 13px; font-weight: 500;
          line-height: 1.4;
          animation: lp-shake .35s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes lp-shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          60% { transform: translateX(4px); }
          80% { transform: translateX(-2px); }
        }

        .lp-btn {
          width: 100%; height: 46px; border-radius: 11px; border: none;
          background: linear-gradient(135deg, #d4a017 0%, #e0ad1e 100%);
          color: #141c22; font-size: 14px; font-weight: 800;
          font-family: var(--font); cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          letter-spacing: -.01em;
          box-shadow: 0 4px 18px rgba(212,160,23,0.40);
          transition: all .18s; margin-top: 4px;
        }
        .lp-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 7px 26px rgba(212,160,23,0.52);
          background: linear-gradient(135deg, #e0ad1e 0%, #eabb28 100%);
        }
        .lp-btn:active:not(:disabled) {
          transform: translateY(1px) scale(0.98);
          box-shadow: 0 2px 10px rgba(212,160,23,0.28);
        }
        .lp-btn:disabled { opacity: .7; cursor: not-allowed; }

        .lp-foot {
          text-align: center; font-size: 12px;
          color: var(--c-text4); margin-top: 20px; line-height: 1.5;
        }
        .lp-foot-a { color: var(--c-teal); font-weight: 600; }

        @media (max-width: 680px) {
          .lp-left { display: none; }
          .lp-right { padding: 40px 16px; max-width: 100%; }
          .lp-card { padding: 28px 22px; border-radius: 16px; }
          .lp-theme-btn { top: 14px; right: 14px; padding: 6px 11px; }
        }
        @media (min-width: 681px) and (max-width: 920px) {
          .lp-left { width: clamp(260px, 36%, 320px); padding: 34px 26px; }
          .lp-h1 { font-size: 28px; }
          .lp-biz-label, .lp-biz-row, .lp-features { display: none; }
        }
      `}</style>

      <div className="lp-root">
        <div className="lp-orb lp-orb-1" />
        <div className="lp-orb lp-orb-2" />
        <div className="lp-grid" />

        {/* ── Left panel ── */}
        <div className="lp-left">
          <div className="lp-logo">
            <div className="lp-logo-icon">
              <Boxes size={21} color="#141c22" strokeWidth={2.5} />
            </div>
            <div>
              <p>IMS Platform</p>
              <p>Inventory Management</p>
            </div>
          </div>

          <div className="lp-headline">
            <div className="lp-badge">
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#d4a017', boxShadow:'0 0 8px #d4a017' }} />
              <span>Real-Time Inventory</span>
            </div>
            <h1 className="lp-h1">
              Manage stock.<br />
              <span className="ag">Move fast.</span><br />
              <span className="at">Stay ahead.</span>
            </h1>
            <p className="lp-sub">
              Unified real-time inventory across all business units — built for clarity and speed.
            </p>
            <div className="lp-features">
              {features.map((f, i) => (
                <div className="lp-fpill" key={i}>
                  <span className="fi">{f.icon}</span>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="lp-biz-label">Business Units</p>
          {Object.entries(BIZ).map(([id, b]) => (
            <div className="lp-biz-row" key={id}>
              <img src={BIZ_LOGOS[id]} alt={b.name} className="lp-biz-img" />
              <div className="lp-biz-sep" />
              <div className="lp-biz-info">
                <p className="lp-biz-n">{b.name}</p>
                <p className="lp-biz-d">{b.desc}</p>
              </div>
              <div className="lp-biz-dot" style={{ background: b.color, boxShadow: `0 0 8px ${b.color}` }} />
            </div>
          ))}
        </div>

        {/* ── Right panel ── */}
        <div className="lp-right">

          {/* Dark mode toggle */}
          <button className="lp-theme-btn" onClick={toggle} title={dark ? 'Light mode' : 'Dark mode'}>
            {dark
              ? <><Sun size={14} /><span className="lp-theme-label">Light mode</span></>
              : <><Moon size={14} /><span className="lp-theme-label">Dark mode</span></>
            }
          </button>

          <div className="lp-wrap">
            <div className="lp-card">
              <div className="lp-card-hd">
                <div className="lp-sbadge">
                  <div className="lp-sdot" />
                  <span className="lp-stxt">Secure Login</span>
                </div>
                <h2 className="lp-title">Welcome back 👋</h2>
                <p className="lp-sub2">Sign in with your username or email to continue</p>
              </div>

              <div className="lp-div" />

              <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:18 }}>
                <div className="lp-field">
                  <label className={`lp-lbl${focused === 'id' ? ' on' : ''}`}>Username or Email</label>
                  <div className="lp-ir">
                    <input
                      className="lp-in"
                      type="text"
                      placeholder="username or you@example.com"
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      onFocus={() => setFocused('id')}
                      onBlur={() => setFocused(null)}
                      required autoFocus autoComplete="username"
                      autoCapitalize="none" spellCheck={false}
                    />
                  </div>
                </div>

                <div className="lp-field">
                  <div className="lp-pw-row">
                    <label className={`lp-lbl${focused === 'pw' ? ' on' : ''}`}>Password</label>
                    <Link to="/forgot-password" className="lp-frgt">Forgot password?</Link>
                  </div>
                  <div className="lp-ir">
                    <input
                      className="lp-in lp-pr"
                      type={showPw ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setFocused('pw')}
                      onBlur={() => setFocused(null)}
                      required autoComplete="current-password"
                    />
                    <button type="button" className="lp-peye" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {err && (
                  <div className="lp-err">
                    <AlertCircle size={14} style={{ flexShrink:0, marginTop:1 }} />
                    <span>{err}</span>
                  </div>
                )}

                <button type="submit" disabled={loading} className="lp-btn">
                  {loading
                    ? <><svg className="spin" width={15} height={15} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity:.25 }} /><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" style={{ opacity:.8 }} /></svg>Signing in…</>
                    : <>Sign In <ArrowRight size={15} /></>
                  }
                </button>
              </form>
            </div>

            <p className="lp-foot">
              No account?{' '}
              <span className="lp-foot-a">Contact your administrator.</span>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}