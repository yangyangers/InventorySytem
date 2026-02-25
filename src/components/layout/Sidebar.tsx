import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, ArrowLeftRight, Truck,
  Users, BarChart3, Tag, LogOut, ChevronRight, Sun, Moon, X,
} from 'lucide-react'
import { useAuth } from '@/store/auth'
import { useTheme } from '@/store/theme'
import { BIZ, BizId } from '@/types'
import { avatarColor } from '@/lib/utils'
import { BIZ_LOGOS } from '@/lib/logos'

const MAIN = [
  { to: '/',             label: 'Dashboard',    icon: LayoutDashboard, end: true },
  { to: '/inventory',    label: 'Inventory',    icon: Package },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/suppliers',    label: 'Suppliers',    icon: Truck },
]
const ADMIN = [
  { to: '/staff',      label: 'Staff',      icon: Users },
  { to: '/reports',    label: 'Reports',    icon: BarChart3 },
  { to: '/categories', label: 'Categories', icon: Tag },
]

interface Props { open: boolean; onClose: () => void }

export default function Sidebar({ open, onClose }: Props) {
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const nav = useNavigate()
  if (!user) return null

  const biz     = BIZ[user.business_id as BizId]
  const av      = avatarColor(user.full_name, user.avatar_color)
  const logoSrc = BIZ_LOGOS[user.business_id]

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      {/* Ambient teal glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 160,
        background: 'radial-gradient(ellipse at 50% -10%, rgba(91,148,144,0.14) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Company logo header — centered, no card ── */}
      <div style={{
        padding: '22px 16px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 88,
      }}>
        {/* Logo — big and centered */}
        <img
          src={logoSrc}
          alt={biz.name}
          style={{
            maxHeight: 56,
            maxWidth: '80%',
            objectFit: 'contain',
            objectPosition: 'center',
            display: 'block',
            filter: 'brightness(0) invert(1)',
            opacity: 0.93,
          }}
        />

        {/* Mobile close button — only shown on mobile via CSS class */}
        <button
          onClick={onClose}
          className="sidebar-close"
          style={{
            alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer', color: 'rgba(255,255,255,0.40)',
            position: 'absolute', top: 16, right: 12,
          }}
        >
          <X size={13} />
        </button>
      </div>

      {/* ── Business unit label strip ─────────────── */}
      <div style={{
        padding: '8px 12px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          background: `linear-gradient(90deg, ${biz.color}22, ${biz.color}10)`,
          border: `1px solid ${biz.color}22`,
          borderRadius: 8,
          padding: '5px 11px',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: biz.color, boxShadow: `0 0 6px ${biz.color}`,
            flexShrink: 0,
          }} />
          <p style={{
            color: biz.color, fontWeight: 700, fontSize: 11,
            letterSpacing: '.06em', textTransform: 'uppercase',
            fontFamily: 'var(--font-head)', lineHeight: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {biz.name}
          </p>
          <span style={{
            marginLeft: 'auto', color: 'rgba(255,255,255,0.28)',
            fontSize: 9.5, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {biz.desc}
          </span>
        </div>
      </div>

      {/* ── Navigation ───────────────────────────── */}
      <nav style={{
        flex: 1, padding: '10px 9px',
        overflowY: 'auto', display: 'flex', flexDirection: 'column',
        gap: 1, position: 'relative', zIndex: 1,
      }}>
        <p style={{ color: 'rgba(255,255,255,0.20)', fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', padding: '4px 11px 7px' }}>Menu</p>

        {MAIN.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? 'rgba(212,160,23,0.18)' : 'rgba(255,255,255,0.04)',
                  transition: 'background .14s',
                }}>
                  <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span style={{ flex: 1 }}>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {user.role === 'admin' && (
          <>
            <div style={{ margin: '9px 9px 2px', borderTop: '1px solid rgba(255,255,255,0.06)' }} />
            <p style={{ color: 'rgba(255,255,255,0.20)', fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', padding: '5px 11px 7px' }}>Admin</p>
            {ADMIN.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                {({ isActive }) => (
                  <>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isActive ? 'rgba(212,160,23,0.18)' : 'rgba(255,255,255,0.04)',
                      transition: 'background .14s',
                    }}>
                      <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span style={{ flex: 1 }}>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Bottom ambient glow */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
        background: 'radial-gradient(ellipse at 50% 120%, rgba(78,107,101,0.18) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Footer ───────────────────────────────── */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '9px 9px 11px', position: 'relative', zIndex: 1,
      }}>
        {/* Profile link */}
        <NavLink
          to="/profile"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          style={{ marginBottom: 6, padding: '9px 11px' }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: `linear-gradient(135deg, ${av}, ${av}bb)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13, color: '#fff',
            boxShadow: `0 3px 10px ${av}60`,
          }}>
            {user.full_name[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
              {user.full_name}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, fontFamily: 'var(--mono)', lineHeight: 1.2 }}>
              @{user.username}
            </p>
          </div>
          <ChevronRight size={12} style={{ color: 'rgba(255,255,255,0.20)', flexShrink: 0 }} />
        </NavLink>

        {/* Dark mode toggle — full width row, clearly separate from sign-out */}
        <button
          onClick={toggle}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '8px 11px', borderRadius: 7,
            background: dark ? 'rgba(212,160,23,0.11)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${dark ? 'rgba(212,160,23,0.20)' : 'rgba(255,255,255,0.07)'}`,
            cursor: 'pointer',
            color: dark ? '#d4a017' : 'rgba(255,255,255,0.40)',
            fontSize: 12.5, fontFamily: 'var(--font)',
            transition: 'all .18s',
            marginBottom: 4,
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = dark ? 'rgba(212,160,23,0.18)' : 'rgba(255,255,255,0.08)'
            el.style.color = dark ? '#e8b820' : 'rgba(255,255,255,0.65)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = dark ? 'rgba(212,160,23,0.11)' : 'rgba(255,255,255,0.04)'
            el.style.color = dark ? '#d4a017' : 'rgba(255,255,255,0.40)'
          }}
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />}
          <span style={{ fontWeight: 500 }}>{dark ? 'Light mode' : 'Dark mode'}</span>
        </button>

        {/* Sign out — full width row, clearly readable */}
        <button
          onClick={() => { logout().then(() => nav('/login')) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '8px 11px', borderRadius: 7,
            background: 'none', border: '1px solid transparent',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 12.5, fontFamily: 'var(--font)',
            transition: 'all .14s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'rgba(201,78,78,0.12)'
            el.style.color = '#fca5a5'
            el.style.borderColor = 'rgba(201,78,78,0.20)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'none'
            el.style.color = 'rgba(255,255,255,0.35)'
            el.style.borderColor = 'transparent'
          }}
        >
          <LogOut size={14} />
          <span style={{ fontWeight: 500 }}>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
