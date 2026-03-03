import { useState, useCallback, useEffect, createContext, useContext, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface IToast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastCtx {
  success: (title: string, message?: string) => void
  error:   (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info:    (title: string, message?: string) => void
}

const Ctx = createContext<ToastCtx | null>(null)

const ICONS = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info }
const COLORS = {
  success: { border: 'rgba(61,158,116,0.3)',  icon: '#3d9e74', bar: '#3d9e74' },
  error:   { border: 'rgba(201,78,78,0.3)',   icon: '#c94e4e', bar: '#c94e4e' },
  warning: { border: 'rgba(212,160,23,0.3)',  icon: '#d4a017', bar: '#d4a017' },
  info:    { border: 'rgba(91,148,144,0.3)',  icon: '#5b9490', bar: '#5b9490' },
}

function ToastItem({ t, onDismiss }: { t: IToast; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const c = COLORS[t.type]
  const Icon = ICONS[t.type]
  const dur = t.duration ?? 4000

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 10)
    const t2 = setTimeout(() => dismiss(), dur)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  function dismiss() {
    setLeaving(true)
    setTimeout(() => onDismiss(t.id), 300)
  }

  return (
    <div
      onClick={dismiss}
      role="alert"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '14px 16px',
        background: 'var(--c-white)',
        border: `1.5px solid ${c.border}`,
        borderLeft: `4px solid ${c.bar}`,
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        minWidth: 300, maxWidth: 380,
        position: 'relative', overflow: 'hidden',
        cursor: 'pointer',
        opacity: visible && !leaving ? 1 : 0,
        transform: visible && !leaving ? 'translateX(0) scale(1)' : 'translateX(20px) scale(0.96)',
        transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(.16,1,.3,1)',
      }}
    >
      <Icon size={17} style={{ color: c.icon, flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1.3, margin: 0 }}>
          {t.title}
        </p>
        {t.message && (
          <p style={{ fontSize: 12.5, color: 'var(--c-text3)', marginTop: 3, lineHeight: 1.5, margin: '3px 0 0' }}>
            {t.message}
          </p>
        )}
      </div>
      <X size={14} style={{ color: 'var(--c-text4)', flexShrink: 0, marginTop: 2 }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, height: 3,
        background: c.bar, opacity: 0.35,
        animation: `toast-shrink ${dur}ms linear forwards`,
      }} />
      <style>{`
        @keyframes toast-shrink { from { width: 100% } to { width: 0% } }
      `}</style>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<IToast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  function add(type: ToastType, title: string, message?: string, duration?: number) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    setToasts(prev => [...prev.slice(-4), { id, type, title, message, duration }])
  }

  const ctx: ToastCtx = {
    success: (title, msg) => add('success', title, msg),
    error:   (title, msg) => add('error',   title, msg),
    warning: (title, msg) => add('warning', title, msg),
    info:    (title, msg) => add('info',    title, msg),
  }

  return (
    <Ctx.Provider value={ctx}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          aria-atomic="false"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 99999,
            display: 'flex', flexDirection: 'column', gap: 10,
            alignItems: 'flex-end', pointerEvents: 'none',
          }}
        >
          {toasts.map(t => (
            <div key={t.id} style={{ pointerEvents: 'auto' }}>
              <ToastItem t={t} onDismiss={dismiss} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </Ctx.Provider>
  )
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}