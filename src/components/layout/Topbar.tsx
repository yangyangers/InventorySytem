import { useLocation, NavLink } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { BIZ, BizId } from '@/types'
import { avatarColor } from '@/lib/utils'

const META: Record<string, { title: string; emoji: string; sub: string }> = {
  '/':             { title: 'Dashboard',    emoji: '📊', sub: 'Overview & key metrics'      },
  '/inventory':    { title: 'Inventory',    emoji: '📦', sub: 'Products & stock levels'     },
  '/transactions': { title: 'Transactions', emoji: '↕️', sub: 'Stock movement history'      },
  '/suppliers':    { title: 'Suppliers',    emoji: '🚚', sub: 'Supplier directory'           },
  '/profile':      { title: 'My Profile',   emoji: '👤', sub: 'Account & preferences'       },
  '/staff':        { title: 'Staff',        emoji: '👥', sub: 'Team member management'      },
  '/reports':      { title: 'Reports',      emoji: '📈', sub: 'Analytics & insights'        },
  '/categories':   { title: 'Categories',   emoji: '🏷️', sub: 'Product categorization'      },
}

export default function Topbar() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  if (!user) return null

  const meta = META[pathname] ?? { title: 'IMS', emoji: '📦', sub: '' }
  const biz  = BIZ[user.business_id as BizId]
  const av   = avatarColor(user.full_name, user.avatar_color)
  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div style={{
      height: 'var(--header-h)',
      background: 'var(--white)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      flexShrink: 0,
      boxShadow: '0 1px 0 var(--border), 0 2px 12px rgba(13,21,38,0.04)',
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Left — page identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'var(--bg)',
          border: '1.5px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>
          {meta.emoji}
        </div>
        <div>
          <h1 style={{
            fontSize: 17, fontWeight: 800, color: 'var(--ink)',
            letterSpacing: '-.03em', fontFamily: 'var(--font-head)', lineHeight: 1,
          }}>
            {meta.title}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{meta.sub}</p>
        </div>
      </div>

      {/* Right — controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Date chip */}
        <div style={{
          padding: '5px 12px', borderRadius: 8,
          background: 'var(--bg)', border: '1.5px solid var(--border)',
          fontSize: 12, color: 'var(--ink-3)', fontWeight: 600,
          whiteSpace: 'nowrap', letterSpacing: '.01em',
        }}>
          {today}
        </div>

        {/* Business badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '5px 13px', borderRadius: 8,
          background: biz.bg,
          border: `1.5px solid ${biz.color}30`,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: biz.color,
            boxShadow: `0 0 6px ${biz.color}`,
          }} />
          <span style={{
            fontSize: 12, fontWeight: 800,
            color: biz.color, letterSpacing: '.04em',
            fontFamily: 'var(--font-head)',
          }}>{biz.name}</span>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 26, background: 'var(--border)', margin: '0 2px' }} />

        {/* User profile button */}
        <NavLink
          to="/profile"
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '5px 13px 5px 6px',
            borderRadius: 30,
            border: '1.5px solid var(--border)',
            textDecoration: 'none',
            background: 'transparent',
            transition: 'all .18s',
            boxShadow: 'var(--shadow-xs)',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'var(--bg)'
            el.style.borderColor = 'var(--border-2)'
            el.style.boxShadow = 'var(--shadow-sm)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'transparent'
            el.style.borderColor = 'var(--border)'
            el.style.boxShadow = 'var(--shadow-xs)'
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: `linear-gradient(135deg, ${av} 0%, ${av}bb 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 12.5, color: '#fff',
            boxShadow: `0 2px 8px ${av}55`,
            fontFamily: 'var(--font-head)',
            flexShrink: 0,
          }}>
            {user.full_name[0]?.toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>
              {user.full_name.split(' ')[0]}
            </p>
            <p style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.1, textTransform: 'capitalize' }}>
              {user.role}
            </p>
          </div>
        </NavLink>
      </div>
    </div>
  )
}
