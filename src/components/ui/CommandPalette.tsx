import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search, LayoutDashboard, Package, ArrowLeftRight, Truck, Users, BarChart3, Tag, UserCheck, ShoppingCart, TrendingUp, Command, ChevronRight } from 'lucide-react'

const ROUTES = [
  { path: '/',             label: 'Dashboard',     icon: LayoutDashboard, desc: 'Overview',       group: 'Pages', admin: false },
  { path: '/inventory',    label: 'Inventory',     icon: Package,         desc: 'Products',       group: 'Pages', admin: false },
  { path: '/transactions', label: 'Transactions',  icon: ArrowLeftRight,  desc: 'Movements',      group: 'Pages', admin: false },
  { path: '/pos',          label: 'POS',           icon: ShoppingCart,    desc: 'Point of sale',  group: 'Pages', admin: false },
  { path: '/suppliers',    label: 'Suppliers',     icon: Truck,           desc: 'Suppliers',      group: 'Pages', admin: false },
  { path: '/customers',    label: 'Customers',     icon: UserCheck,       desc: 'Customers',      group: 'Pages', admin: false },
  { path: '/staff',        label: 'Staff',         icon: Users,           desc: 'Team',           group: 'Admin', admin: true  },
  { path: '/reports',      label: 'Reports',       icon: BarChart3,       desc: 'Analytics',      group: 'Admin', admin: true  },
  { path: '/sales-reports',label: 'Sales Reports', icon: TrendingUp,      desc: 'Sales',          group: 'Admin', admin: true  },
  { path: '/categories',   label: 'Categories',    icon: Tag,             desc: 'Categories',     group: 'Admin', admin: true  },
]

interface Props { open: boolean; onClose: () => void; isAdmin?: boolean }

export default function CommandPalette({ open, onClose, isAdmin }: Props) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(0)
  const nav = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = ROUTES.filter(r => {
    if (r.admin && !isAdmin) return false
    if (!query) return true
    const q = query.toLowerCase()
    return r.label.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q)
  })

  useEffect(() => {
    if (open) { setQuery(""); setSelected(0); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [open])
  useEffect(() => { setSelected(0) }, [query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)) }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === "Enter" && filtered[selected]) { nav(filtered[selected].path); onClose() }
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, filtered, selected, nav, onClose])

  if (!open) return null

  const groups: Record<string, typeof ROUTES> = {}
  filtered.forEach(r => { if (!groups[r.group]) groups[r.group] = []; groups[r.group].push(r) })
  let idx = 0

  return createPortal(
    <div
      style={{ position:"fixed",inset:0,zIndex:99998,background:"rgba(15,20,28,0.65)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"15vh 20px 20px",animation:"fadeIn .16s ease" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background:"var(--c-white)",border:"1.5px solid var(--c-border)",borderRadius:"var(--radius-xl)",width:"100%",maxWidth:520,boxShadow:"var(--shadow-lg)",overflow:"hidden",animation:"scaleUp .2s cubic-bezier(.16,1,.3,1)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10,padding:"14px 16px",borderBottom:"1.5px solid var(--c-border)" }}>
          <Search size={16} style={{ color:"var(--c-text3)",flexShrink:0 }} />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search pages..." style={{ flex:1,border:"none",outline:"none",background:"transparent",fontSize:15,color:"var(--c-text)",fontFamily:"var(--font)" }} />
          <kbd style={{ padding:"2px 7px",borderRadius:5,fontSize:11,fontWeight:600,background:"var(--c-bg)",border:"1.5px solid var(--c-border)",color:"var(--c-text3)",fontFamily:"var(--mono)" }}>ESC</kbd>
        </div>
        <div style={{ maxHeight:360,overflowY:"auto",padding:"6px" }}>
          {filtered.length === 0
            ? <div style={{ padding:"32px",textAlign:"center",color:"var(--c-text3)",fontSize:13.5 }}>No results for "{query}"</div>
            : Object.entries(groups).map(([group,items]) => (
              <div key={group}>
                <p style={{ fontSize:10,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"var(--c-text4)",padding:"8px 10px 5px" }}>{group}</p>
                {items.map(item => {
                  const ci=idx++; const isSel=ci===selected; const Icon=item.icon
                  return (
                    <div key={item.path} onMouseEnter={()=>setSelected(ci)} onClick={()=>{nav(item.path);onClose()}}
                      style={{ display:"flex",alignItems:"center",gap:11,padding:"9px 10px",borderRadius:"var(--radius-sm)",cursor:"pointer",background:isSel?"var(--c-gold-dim)":"transparent",transition:"background .1s" }}>
                      <div style={{ width:32,height:32,borderRadius:8,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:isSel?"rgba(212,160,23,0.15)":"var(--c-bg)",border:"1.5px solid var(--c-border)" }}>
                        <Icon size={14} style={{ color:isSel?"var(--c-gold)":"var(--c-text3)" }} />
                      </div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <p style={{ fontSize:13.5,fontWeight:600,color:isSel?"var(--c-gold-d)":"var(--c-text)",lineHeight:1.2 }}>{item.label}</p>
                        <p style={{ fontSize:11.5,color:"var(--c-text3)",lineHeight:1.2 }}>{item.desc}</p>
                      </div>
                      <ChevronRight size={13} style={{ color:isSel?"var(--c-gold)":"var(--c-text4)",flexShrink:0 }} />
                    </div>
                  )
                })}
              </div>
            ))
          }
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:14,padding:"9px 16px",borderTop:"1.5px solid var(--c-border)",background:"var(--c-bg)" }}>
          {[["↑↓","Navigate"],["↵","Open"]].map(([k,l])=>(
            <span key={k} style={{ display:"flex",alignItems:"center",gap:5,fontSize:11.5,color:"var(--c-text3)" }}>
              <kbd style={{ padding:"1px 5px",borderRadius:4,fontSize:11,background:"var(--c-white)",border:"1.5px solid var(--c-border)",color:"var(--c-text3)",fontFamily:"var(--mono)" }}>{k}</kbd>
              {l}
            </span>
          ))}
          <span style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:5,fontSize:11.5,color:"var(--c-text4)" }}>
            <Command size={11} /><span>⌘K to open</span>
          </span>
        </div>
      </div>
    </div>,
    document.body
  )
}