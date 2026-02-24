import { useLocation, NavLink } from 'react-router-dom'
import { Menu, Sun, Moon } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { useTheme } from '@/store/theme'
import { BIZ, BizId } from '@/types'
import { avatarColor } from '@/lib/utils'

const META: Record<string, { title: string; emoji: string; sub: string }> = {
  '/':             { title: 'Dashboard',    emoji: '📊', sub: 'Overview & key metrics'  },
  '/inventory':    { title: 'Inventory',    emoji: '📦', sub: 'Products & stock levels' },
  '/transactions': { title: 'Transactions', emoji: '↕️', sub: 'Stock movements'         },
  '/suppliers':    { title: 'Suppliers',    emoji: '🚚', sub: 'Supplier directory'       },
  '/profile':      { title: 'My Profile',   emoji: '👤', sub: 'Account settings'        },
  '/staff':        { title: 'Staff',        emoji: '👥', sub: 'Team management'         },
  '/reports':      { title: 'Reports',      emoji: '📈', sub: 'Analytics'               },
  '/categories':   { title: 'Categories',   emoji: '🏷️', sub: 'Product categories'      },
}

interface Props { onMenuClick: () => void }

export default function Topbar({ onMenuClick }: Props) {
  const { user } = useAuth()
  const { dark, toggle } = useTheme()
  const { pathname } = useLocation()
  if (!user) return null

  const meta = META[pathname] ?? { title: 'IMS', emoji: '📦', sub: '' }
  const biz  = BIZ[user.business_id as BizId]
  const av   = avatarColor(user.full_name, user.avatar_color)
  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  return (
    <div style={{
      height: 'var(--header-h)',
      background: 'var(--c-white)',
      borderBottom: '1px solid var(--c-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 22px', flexShrink: 0, position: 'relative', zIndex: 10,
      boxShadow: 'var(--shadow-xs)',
      gap: 12,
      transition: 'background .22s, border-color .22s',
    }}>

      {/* Left — page identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
        {/* Hamburger (mobile) */}
        <button className="hamburger" onClick={onMenuClick} aria-label="Toggle sidebar">
          <Menu size={17} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'var(--c-bg)', border: '1.5px solid var(--c-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>
            {meta.emoji}
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              fontSize: 15, fontWeight: 800, color: 'var(--c-text)',
              letterSpacing: '-.025em', fontFamily: 'var(--font-head)',
              lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {meta.title}
            </h1>
            <p style={{
              fontSize: 11.5, color: 'var(--c-text3)', marginTop: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {meta.sub}
            </p>
          </div>
        </div>
      </div>

      {/* Right — controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

        {/* Date chip */}
        <div className="topbar-date" style={{
          padding: '5px 11px', borderRadius: 7,
          background: 'var(--c-bg)', border: '1.5px solid var(--c-border)',
          fontSize: 11.5, color: 'var(--c-text3)', fontWeight: 600,
          whiteSpace: 'nowrap', fontFamily: 'var(--mono)',
          transition: 'background .22s, border-color .22s',
        }}>
          {today}
        </div>

        {/* Business badge */}
        <div className="topbar-biz-name" style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '5px 12px', borderRadius: 7,
          background: `color-mix(in srgb, ${biz.color} 12%, transparent)`,
          border: `1.5px solid ${biz.color}30`,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: biz.color, boxShadow: `0 0 6px ${biz.color}`,
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11.5, fontWeight: 700, color: biz.color,
            letterSpacing: '.04em', fontFamily: 'var(--font-head)',
          }}>
            {biz.name}
          </span>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 22, background: 'var(--c-border)', margin: '0 1px' }} />

        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 7,
            background: dark ? 'var(--c-gold-dim)' : 'var(--c-bg)',
            border: `1.5px solid ${dark ? 'rgba(212,160,23,0.25)' : 'var(--c-border)'}`,
            cursor: 'pointer',
            color: dark ? 'var(--c-gold)' : 'var(--c-text3)',
            transition: 'all .18s',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'var(--c-border2)'
            el.style.color = dark ? 'var(--c-gold)' : 'var(--c-text2)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = dark ? 'rgba(212,160,23,0.25)' : 'var(--c-border)'
            el.style.color = dark ? 'var(--c-gold)' : 'var(--c-text3)'
          }}
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* User avatar */}
        <NavLink
          to="/profile"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 12px 5px 6px', borderRadius: 24,
            border: '1.5px solid var(--c-border)', textDecoration: 'none',
            background: 'transparent', transition: 'all .16s', boxShadow: 'var(--shadow-xs)',
          }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--c-bg)'; el.style.borderColor = 'var(--c-border2)' }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.borderColor = 'var(--c-border)' }}
        >
          <div style={{
            width: 27, height: 27, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${av}, ${av}bb)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 12, color: '#fff',
            boxShadow: `0 2px 8px ${av}55`,
          }}>
            {user.full_name[0]?.toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-text)', lineHeight: 1.1 }}>
              {user.full_name.split(' ')[0]}
            </p>
            <p style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.1, textTransform: 'capitalize' }}>
              {user.role}
            </p>
          </div>
        </NavLink>
      </div>
    </div>
  )
}
