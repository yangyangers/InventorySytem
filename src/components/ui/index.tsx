import { X, AlertCircle, CheckCircle, Loader, TriangleAlert } from 'lucide-react'
import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

/* ─────────────────────────────────────────────────────────
   Modal — rendered via portal directly into <body>
   so overflow:hidden on .shell / .main can't clip it
───────────────────────────────────────────────────────── */
export function Modal({
  title, subtitle, onClose, children, footer, width = 520, icon, iconBg, iconColor,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
  icon?: ReactNode
  iconBg?: string
  iconColor?: string
}) {
  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const content = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(10, 16, 26, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn .18s ease',
        boxSizing: 'border-box',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: width,
          maxHeight: 'calc(100vh - 80px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 0 1px rgba(20,27,34,0.08), 0 12px 40px rgba(20,27,34,0.22), 0 4px 12px rgba(20,27,34,0.10)',
          animation: 'scaleUp .22s cubic-bezier(.16,1,.3,1)',
          position: 'relative',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '22px 26px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 14,
          flexShrink: 0,
          background: 'var(--white)',
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, flex: 1, minWidth: 0 }}>
            {icon && (
              <div style={{
                width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                background: iconBg || 'var(--gold-l)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: iconColor || 'var(--gold)' }}>{icon}</span>
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <h3 style={{
                fontSize: 16, fontWeight: 800, color: 'var(--ink)',
                letterSpacing: '-.025em', fontFamily: 'var(--font-head)',
                lineHeight: 1.2,
              }}>
                {title}
              </h3>
              {subtitle && (
                <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.4 }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              flexShrink: 0, width: 32, height: 32, borderRadius: 8,
              border: '1.5px solid var(--border)', background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--ink-3)', transition: 'all .15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg)'; (e.currentTarget as HTMLElement).style.color = 'var(--ink)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--ink-3)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{
          padding: '22px 26px',
          overflowY: 'auto',
          flex: 1,
        }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: '14px 26px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            flexShrink: 0,
            background: 'var(--bg)',
            borderRadius: '0 0 var(--radius-xl) var(--radius-xl)',
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

/* ── Alert ─────────────────────────────────────────── */
export function Alert({ msg, type }: { msg: string; type: 'err' | 'ok' }) {
  const Icon = type === 'err' ? AlertCircle : CheckCircle
  return (
    <div className={`alert alert-${type}`}>
      <Icon size={15} style={{ flexShrink: 0 }} />
      <span>{msg}</span>
    </div>
  )
}

/* ── Spinner ────────────────────────────────────────── */
export function Spinner({ size = 20, color = 'var(--ink-3)' }: { size?: number; color?: string }) {
  return <Loader size={size} className="spin" style={{ color }} />
}

/* ── Empty state ─────────────────────────────────────  */
export function Empty({ icon, text, sub }: { icon: ReactNode; text: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 16px', gap: 10 }}>
      <div style={{ color: 'var(--ink-4)', opacity: .5, marginBottom: 4 }}>{icon}</div>
      <p style={{ color: 'var(--ink-2)', fontSize: 14.5, fontWeight: 600 }}>{text}</p>
      {sub && <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>{sub}</p>}
    </div>
  )
}

/* ── Skeleton table rows ─────────────────────────────── */
export function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} style={{ padding: '14px 16px' }}>
              <div className="skel" style={{ height: 13, width: j === 0 ? '75%' : j === cols - 1 ? '40%' : '60%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/* ── Field wrapper ───────────────────────────────────── */
export function Field({ label, children, required, hint }: {
  label: string; children: ReactNode; required?: boolean; hint?: string
}) {
  return (
    <div>
      <label className="label">
        {label}{required && <span style={{ color: 'var(--gold)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

/* ── Confirm dialog ──────────────────────────────────── */
export function Confirm({
  title = 'Are you sure?', msg, confirmLabel = 'Confirm', onYes, onNo,
}: {
  title?: string; msg: string; confirmLabel?: string; onYes: () => void; onNo: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onNo()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onNo])

  const content = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(10,16,26,0.65)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, animation: 'fadeIn .18s ease',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onNo() }}
    >
      <div
        style={{
          background: 'var(--white)', borderRadius: 'var(--radius-xl)',
          width: '100%', maxWidth: 400,
          boxShadow: '0 0 0 1px rgba(20,27,34,0.08), 0 20px 60px rgba(20,27,34,0.24)',
          animation: 'scaleUp .22s cubic-bezier(.16,1,.3,1)',
          overflow: 'hidden',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div style={{ padding: '32px 28px 24px', textAlign: 'center' }}>
          <div style={{
            width: 58, height: 58, borderRadius: '50%',
            background: 'rgba(212,90,90,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px',
          }}>
            <TriangleAlert size={28} style={{ color: 'var(--red)' }} />
          </div>
          <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 10, fontFamily: 'var(--font-head)', letterSpacing: '-.02em' }}>{title}</p>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>{msg}</p>
        </div>
        <div style={{
          padding: '16px 28px 22px',
          display: 'flex', justifyContent: 'center', gap: 12,
        }}>
          <button className="btn btn-secondary" onClick={onNo} style={{ minWidth: 110 }}>Cancel</button>
          <button className="btn btn-danger" onClick={onYes} style={{ minWidth: 110 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

/* ── Stat card ───────────────────────────────────────── */
export function StatCard({
  label, value, sub, icon, color, bg, trend, accentColor,
}: {
  label: string; value: string | number; sub?: string
  icon: ReactNode; color: string; bg: string; accentColor?: string
  trend?: { val: string; up: boolean }
}) {
  return (
    <div className="stat" style={{ borderTopColor: accentColor || color }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 14,
          background: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 12px ${color}28`,
        }}>
          <span style={{ color }}>{icon}</span>
        </div>
        {trend && (
          <span style={{
            fontSize: 11.5, fontWeight: 700, padding: '4px 9px', borderRadius: 20,
            background: trend.up ? 'var(--green-l)' : 'var(--red-l)',
            color: trend.up ? 'var(--green)' : 'var(--red)',
          }}>
            {trend.up ? '↑' : '↓'} {trend.val}
          </span>
        )}
      </div>
      <p style={{
        fontSize: 30, fontWeight: 800, color: 'var(--ink)',
        letterSpacing: '-.04em', lineHeight: 1,
        fontFamily: 'var(--font-head)',
      }}>{value}</p>
      <p style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 600, marginTop: 10 }}>{label}</p>
      {sub && <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{sub}</p>}
    </div>
  )
}
