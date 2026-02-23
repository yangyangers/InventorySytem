import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, ArrowLeftRight, Truck,
  Users, BarChart3, Tag, LogOut, ChevronRight, Boxes,
} from 'lucide-react'
import { useAuth } from '@/store/auth'
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

export default function Sidebar() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  if (!user) return null

  const biz     = BIZ[user.business_id as BizId]
  const av      = avatarColor(user.full_name, user.avatar_color)
  const logoSrc = BIZ_LOGOS[user.business_id]

  // Wellbuild logo is white-on-black — needs special bg handling
  const isWhiteLogo = user.business_id === 'wellbuild' || user.business_id === 'tcchemical'

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      background: 'linear-gradient(180deg, #1a2430 0%, #141b22 60%, #111820 100%)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      flexShrink: 0,
      overflow: 'hidden',
      position: 'relative',
      borderRight: '1px solid rgba(91,148,144,0.12)',
    }}>

      {/* Ambient teal glow top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 200,
        background: 'radial-gradient(ellipse at 50% -10%, rgba(91,148,144,0.18) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── IMS header logo ─────────────────────────── */}
      <div style={{
        padding: '18px 16px 14px',
        borderBottom: '1px solid rgba(91,148,144,0.12)',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #d4a017, #e0b530)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(212,160,23,0.45)',
            flexShrink: 0,
          }}>
            <Boxes size={19} color="#141b22" strokeWidth={2.5} />
          </div>
          <div>
            <p style={{ color: '#fff', fontWeight: 800, fontSize: 15, fontFamily: 'var(--font-head)', letterSpacing: '-.02em', lineHeight: 1.1 }}>IMS</p>
            <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 9.5, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase' }}>Inventory Platform</p>
          </div>
        </div>
      </div>

      {/* ── Business unit logo card ───────────────── */}
      <div style={{
        padding: '12px 12px 10px',
        borderBottom: '1px solid rgba(91,148,144,0.10)',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          borderRadius: 12,
          background: isWhiteLogo ? 'rgba(0,0,0,0.40)' : 'rgba(255,255,255,0.96)',
          border: `1px solid ${biz.color}28`,
          overflow: 'hidden',
          boxShadow: `0 2px 12px ${biz.color}18`,
        }}>
          {/* Logo image */}
          <div style={{
            padding: user.business_id === 'tcchemical' ? '10px 16px' : '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 56,
          }}>
            <img
              src={logoSrc}
              alt={biz.name}
              style={{
                maxHeight: user.business_id === 'tcchemical' ? 36 : 40,
                maxWidth: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>

          {/* Business name strip */}
          <div style={{
            background: biz.color,
            padding: '5px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
          }}>
            <p style={{
              color: '#141b22',
              fontWeight: 800,
              fontSize: 10.5,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-head)',
              lineHeight: 1,
            }}>
              {biz.name}
            </p>
            <p style={{
              color: 'rgba(20,27,34,0.60)',
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: '.02em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {biz.desc}
            </p>
          </div>
        </div>
      </div>

      {/* ── Navigation ───────────────────────────── */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, position: 'relative', zIndex: 1 }}>
        <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 9.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', padding: '4px 12px 8px' }}>Menu</p>

        {MAIN.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? 'rgba(212,160,23,0.22)' : 'transparent',
                  transition: 'background .15s',
                }}>
                  <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span style={{ flex: 1 }}>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {user.role === 'admin' && (
          <>
            <div style={{ margin: '10px 10px 2px', borderTop: '1px solid rgba(91,148,144,0.14)' }} />
            <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 9.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', padding: '6px 12px 8px' }}>Admin</p>
            {ADMIN.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                {({ isActive }) => (
                  <>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isActive ? 'rgba(212,160,23,0.22)' : 'transparent',
                      transition: 'background .15s',
                    }}>
                      <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span style={{ flex: 1 }}>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Ambient bottom glow */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 140,
        background: 'radial-gradient(ellipse at 50% 120%, rgba(78,107,101,0.22) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── User footer ──────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(91,148,144,0.12)', padding: '10px 10px 12px', position: 'relative', zIndex: 1 }}>
        <NavLink
          to="/profile"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          style={{ marginBottom: 4, padding: '10px 12px' }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: `linear-gradient(135deg, ${av} 0%, ${av}bb 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 14, color: '#fff',
            boxShadow: `0 4px 12px ${av}70`,
            fontFamily: 'var(--font-head)',
          }}>
            {user.full_name[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'rgba(255,255,255,0.90)', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
              {user.full_name}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.30)', fontSize: 11, fontFamily: 'var(--mono)', lineHeight: 1.2 }}>@{user.username}</p>
          </div>
          <ChevronRight size={13} style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
        </NavLink>

        <button
          onClick={() => { logout(); nav('/login') }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: '8px 12px', borderRadius: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.30)', fontSize: 13, fontFamily: 'var(--font)',
            transition: 'all .15s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'rgba(212,90,90,0.12)'
            el.style.color = '#f5b8b8'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'none'
            el.style.color = 'rgba(255,255,255,0.30)'
          }}
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
