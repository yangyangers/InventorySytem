import { X, AlertCircle, CheckCircle, Loader, TriangleAlert } from 'lucide-react'
import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

/* ── Modal ─────────────────────────────────────── */
export function Modal({
  title, subtitle, onClose, children, footer, width = 520, icon, iconBg, iconColor,
}: {
  title: string; subtitle?: string; onClose: () => void; children: ReactNode
  footer?: ReactNode; width?: number; icon?: ReactNode; iconBg?: string; iconColor?: string
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const content = (
    <div
      style={{
        position:'fixed', inset:0, zIndex:9999,
        background:'rgba(20,28,34,0.55)',
        backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:'20px', animation:'fadeIn .16s ease', boxSizing:'border-box',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background:'var(--c-white)',
          border:'1px solid var(--c-border)',
          borderRadius:'var(--radius-xl)',
          width:'100%', maxWidth:width,
          maxHeight:'calc(100vh - 80px)',
          overflow:'hidden', display:'flex', flexDirection:'column',
          boxShadow:'var(--shadow-lg), 0 0 0 1px rgba(20,28,34,0.06)',
          animation:'scaleUp .22s cubic-bezier(.16,1,.3,1)',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding:'20px 24px 16px', borderBottom:'1px solid var(--c-border)',
          display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          gap:14, flexShrink:0, background:'var(--c-white)',
          borderRadius:'var(--radius-xl) var(--radius-xl) 0 0',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, flex:1, minWidth:0 }}>
            {icon && (
              <div style={{ width:38, height:38, borderRadius:10, flexShrink:0, background:iconBg||'var(--c-gold-dim)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ color:iconColor||'var(--c-gold)' }}>{icon}</span>
              </div>
            )}
            <div style={{ minWidth:0 }}>
              <h3 style={{ fontSize:15, fontWeight:800, color:'var(--c-text)', letterSpacing:'-.02em', fontFamily:'var(--font-head)', lineHeight:1.2 }}>{title}</h3>
              {subtitle && <p style={{ fontSize:12, color:'var(--c-text3)', marginTop:3, lineHeight:1.4 }}>{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ flexShrink:0, width:30, height:30, borderRadius:7, border:'1.5px solid var(--c-border)', background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--c-text3)', transition:'all .14s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='var(--c-bg)'; (e.currentTarget as HTMLElement).style.color='var(--c-text)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='var(--c-text3)' }}
          >
            <X size={14} />
          </button>
        </div>
        {/* Body */}
        <div style={{ padding:'20px 24px', overflowY:'auto', flex:1 }}>{children}</div>
        {/* Footer */}
        {footer && (
          <div style={{ padding:'12px 24px', borderTop:'1px solid var(--c-border)', display:'flex', justifyContent:'flex-end', gap:9, flexShrink:0, background:'var(--c-bg)', borderRadius:'0 0 var(--radius-xl) var(--radius-xl)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
  return createPortal(content, document.body)
}

/* ── Alert ─────────────────────────────────────── */
export function Alert({ msg, type }: { msg: string; type: 'err' | 'ok' }) {
  const Icon = type === 'err' ? AlertCircle : CheckCircle
  return (
    <div className={`alert alert-${type}`}>
      <Icon size={14} style={{ flexShrink:0 }} /><span>{msg}</span>
    </div>
  )
}

/* ── Spinner ─────────────────────────────────────  */
export function Spinner({ size = 20, color = 'var(--c-text3)' }: { size?: number; color?: string }) {
  return <Loader size={size} className="spin" style={{ color }} />
}

/* ── Empty state ─────────────────────────────────  */
export function Empty({ icon, text, sub }: { icon: ReactNode; text: string; sub?: string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'60px 16px', gap:10 }}>
      <div style={{ color:'var(--c-text4)', opacity:.5, marginBottom:4 }}>{icon}</div>
      <p style={{ color:'var(--c-text2)', fontSize:14, fontWeight:600 }}>{text}</p>
      {sub && <p style={{ color:'var(--c-text3)', fontSize:12.5 }}>{sub}</p>}
    </div>
  )
}

/* ── Skeleton rows ───────────────────────────────── */
export function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} style={{ padding:'13px 15px' }}>
              <div className="skel" style={{ height:12, width:j===0?'72%':j===cols-1?'38%':'56%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/* ── Field ───────────────────────────────────────── */
export function Field({ label, children, required, hint }: { label: string; children: ReactNode; required?: boolean; hint?: string }) {
  return (
    <div>
      <label className="label">{label}{required && <span style={{ color:'var(--c-gold)', marginLeft:3 }}>*</span>}</label>
      {children}
      {hint && <p style={{ fontSize:11.5, color:'var(--c-text3)', marginTop:4 }}>{hint}</p>}
    </div>
  )
}

/* ── Confirm ─────────────────────────────────────── */
export function Confirm({
  title='Are you sure?', msg, confirmLabel='Confirm', onYes, onNo,
}: { title?: string; msg: string; confirmLabel?: string; onYes: () => void; onNo: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onNo()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onNo])

  const content = (
    <div
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(20,28,34,0.55)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, animation:'fadeIn .16s ease' }}
      onMouseDown={e => { if (e.target===e.currentTarget) onNo() }}
    >
      <div
        style={{ background:'var(--c-white)', border:'1px solid var(--c-border)', borderRadius:'var(--radius-xl)', width:'100%', maxWidth:400, boxShadow:'var(--shadow-lg)', animation:'scaleUp .22s cubic-bezier(.16,1,.3,1)', overflow:'hidden' }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div style={{ padding:'30px 26px 22px', textAlign:'center' }}>
          <div style={{ width:52, height:52, borderRadius:'50%', background:'var(--c-red-dim)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <TriangleAlert size={26} style={{ color:'var(--c-red)' }} />
          </div>
          <p style={{ fontSize:16, fontWeight:800, color:'var(--c-text)', marginBottom:9, fontFamily:'var(--font-head)', letterSpacing:'-.02em' }}>{title}</p>
          <p style={{ fontSize:13.5, color:'var(--c-text2)', lineHeight:1.6 }}>{msg}</p>
        </div>
        <div style={{ padding:'14px 26px 20px', display:'flex', justifyContent:'center', gap:11 }}>
          <button className="btn btn-secondary" onClick={onNo} style={{ minWidth:105 }}>Cancel</button>
          <button className="btn btn-danger" onClick={onYes} style={{ minWidth:105 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
  return createPortal(content, document.body)
}

/* ── StatCard ────────────────────────────────────── */
export function StatCard({
  label, value, sub, icon, color, bg, trend, accentColor,
}: {
  label: string; value: string | number; sub?: string
  icon: ReactNode; color: string; bg: string; accentColor?: string
  trend?: { val: string; up: boolean }
}) {
  return (
    <div className="stat" style={{ borderTopColor: accentColor || color }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{
          width:42, height:42, borderRadius:12,
          background:bg, display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:`0 3px 10px ${color}25`,
        }}>
          <span style={{ color }}>{icon}</span>
        </div>
        {trend && (
          <span style={{
            fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:20,
            background: trend.up ? 'var(--c-green-dim)' : 'var(--c-red-dim)',
            color: trend.up ? 'var(--c-green)' : 'var(--c-red)',
          }}>
            {trend.up?'↑':'↓'} {trend.val}
          </span>
        )}
      </div>
      <p style={{ fontSize:28, fontWeight:800, color:'var(--c-text)', letterSpacing:'-.04em', lineHeight:1, fontFamily:'var(--font-head)' }}>{value}</p>
      <p style={{ fontSize:13, color:'var(--c-text2)', fontWeight:600, marginTop:9 }}>{label}</p>
      {sub && <p style={{ fontSize:11.5, color:'var(--c-text3)', marginTop:2 }}>{sub}</p>}
    </div>
  )
}
