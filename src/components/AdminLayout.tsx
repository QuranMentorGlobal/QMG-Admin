// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/components/AdminLayout.tsx
// (Admin chrome — charcoal-gold redesign to match the platform portal.
//  Solid #111111 sidebar + top bar, gold nav, rounded cream content panel.
//  Nav items + routes UNCHANGED; added pending/ticket count badges.)
// ============================================================
'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { canAccessRoute, type AdminCtx } from '@/lib/permissions'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  Star, Settings, LogOut, Menu, X, ChevronRight, Search, Bell,
  CreditCard, MessageSquare, ShieldCheck, ShieldAlert, BarChart3, CalendarCheck, UserCog, ScrollText, GitCompareArrows,
  SlidersHorizontal, Briefcase, RotateCcw, Award } from 'lucide-react'

// Two-level nav: primary rail = categories; clicking a category opens a drawer
// listing its pages (sub-items). New pages slot into a category here — the rail
// never grows. NAV_ITEMS is derived flat for the search palette + active logic.
const CATEGORIES = [
  { key: 'overview', label: 'Admin Overview', l1: 'Admin', l2: 'Overview', icon: LayoutDashboard, items: [
    { href: '/dashboard',  label: 'Admin Dashboard',   icon: LayoutDashboard },
    { href: '/analytics',  label: 'Admin Analytics',   icon: BarChart3       },
    { href: '/attendance', label: 'Attendance Center', icon: CalendarCheck   },
  ] },
  { key: 'ops', label: 'Operations Management', l1: 'Operations', l2: 'Management', icon: Briefcase, items: [
    { href: '/bookings', label: 'Bookings Overview',  icon: BookOpen      },
    { href: '/payments', label: 'Payments & Revenue', icon: CreditCard    },
    { href: '/refunds',  label: 'Refunds & Cancellations', icon: RotateCcw },
    { href: '/support',  label: 'Support Tickets',    icon: MessageSquare },
  ] },
  { key: 'trust', label: 'Verification & Trust', l1: 'Verification', l2: '& Trust', icon: ShieldCheck, items: [
    { href: '/verification-queue', label: 'Verification Queue', icon: ShieldCheck      },
    { href: '/moderation',         label: 'Trust & Safety',     icon: ShieldAlert      },
    { href: '/reviews',            label: 'Reviews Moderation', icon: Star             },
    { href: '/badges',             label: 'Badge Management',   icon: Award            },
    { href: '/badge-guide',        label: 'Badge Guide',        icon: BookOpen         },
  ] },
  { key: 'people', label: 'People Management', l1: 'People', l2: 'Management', icon: Users, items: [
    { href: '/teachers', label: 'Teacher Management', icon: GraduationCap },
    { href: '/students', label: 'Student Management', icon: Users         },
  ] },
  { key: 'system', label: 'System & Access', l1: 'System', l2: '& Access', icon: SlidersHorizontal, items: [
    { href: '/settings',         label: 'Platform Settings', icon: Settings   },
    { href: '/admin-management', label: 'Admin Management',   icon: UserCog    },
    { href: '/audit-log',        label: 'Audit Logs',         icon: ScrollText },
  ] },
]
const NAV_ITEMS = CATEGORIES.flatMap(c => c.items)

const LOGO_SRC = '/logo.png'

// Wordmark — light (on dark chrome) or dark (on cream), matching the portal.
function Wordmark({ size = 16, light = true }: { size?: number; light?: boolean }) {
  return (
    <span style={{ fontFamily: "'Fraunces', serif", fontSize: size, fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.1, color: light ? '#ffffff' : '#111111', whiteSpace: 'nowrap' }}>
      Quran<span style={{ color: '#E3C04A' }}>Mentor</span>Global
    </span>
  )
}

// Scoped chrome polish (unique adminx- prefix to avoid collisions).
const ADMINX_STYLES = `
.adminx-nav{display:flex;align-items:center;gap:11px;width:100%;padding:10px 13px;border-radius:12px;margin-bottom:2px;background:transparent;border:none;border-left:3px solid transparent;color:#fff;font-size:13.5px;font-weight:500;font-family:'Inter',sans-serif;text-align:left;cursor:pointer;transition:background .2s ease,transform .2s cubic-bezier(.4,0,.2,1),color .2s ease,border-color .2s ease}
.adminx-nav:hover{background:rgba(255,255,255,.06);transform:translateX(3px)}
.adminx-nav-active{background:linear-gradient(90deg,rgba(201,162,39,.24),rgba(201,162,39,.07));color:#E3C04A;border-left:3px solid #C9A227;font-weight:700;box-shadow:inset 0 0 0 1px rgba(201,162,39,.12)}
.adminx-badge{flex-shrink:0;min-width:20px;height:20px;padding:0 6px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:linear-gradient(135deg,#E3C04A,#C9A227);color:#111111;font-size:11px;font-weight:800;font-family:'Inter',sans-serif;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,.35);animation:adminxpop .25s cubic-bezier(.34,1.56,.64,1) both}
.adminx-badge-urgent{background:linear-gradient(135deg,#F87171,#DC2626);color:#fff}
@keyframes adminxpop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
.adminx-signout{display:flex;align-items:center;gap:11px;width:100%;padding:10px 13px;border-radius:12px;background:transparent;border:none;border-left:3px solid transparent;color:rgba(255,255,255,.62);font-size:13.5px;font-weight:500;font-family:'Inter',sans-serif;text-align:left;cursor:pointer;transition:background .2s ease,color .2s ease,transform .2s ease}
.adminx-signout:hover{background:rgba(239,68,68,.1);color:#FCA5A5;transform:translateX(3px)}
.adminx-portal-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#E3C04A;background:rgba(201,162,39,.12);border:1px solid rgba(201,162,39,.28)}
.adminx-portal-dot{width:5px;height:5px;border-radius:50%;background:#C9A227;box-shadow:0 0 6px rgba(201,162,39,.8)}
.adminx-avatar{transition:transform .2s ease,box-shadow .2s ease}
.adminx-avatar:hover{transform:scale(1.05)}
@media(min-width:1024px){.adminx-panel{border-top-left-radius:0;border-top-right-radius:0}}
.adminx-page{animation:adminxpagein .42s cubic-bezier(.4,0,.2,1) both}
@keyframes adminxpagein{from{opacity:0}to{opacity:1}}
@keyframes adminxrise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.adminx-rise{animation:adminxrise .5s cubic-bezier(.4,0,.2,1) both}
.adminx-stat{transition:transform .25s cubic-bezier(.4,0,.2,1),box-shadow .25s ease,border-color .25s ease}
.adminx-stat:hover{transform:translateY(-3px)!important;box-shadow:0 12px 30px rgba(201,162,39,.16),0 2px 8px rgba(0,0,0,.06)!important;border-color:rgba(201,162,39,.55)!important}
.adminx-row{transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
.adminx-row:hover{transform:translateY(-2px)!important;box-shadow:0 8px 20px rgba(0,0,0,.06)!important;border-color:rgba(201,162,39,.5)!important}
.qmg-skel{background:linear-gradient(90deg,#F1ECE2 25%,#E8E2D6 50%,#F1ECE2 75%);background-size:200% 100%;animation:qmgsh 1.4s infinite;border-radius:14px}
@keyframes qmgsh{0%{background-position:200% 0}100%{background-position:-200% 0}}
.adminx-iconbtn{position:relative;width:38px;height:38px;border-radius:11px;border:none;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .18s ease}
.adminx-iconbtn:hover{background:rgba(255,255,255,.13)}
.adminx-dot{position:absolute;top:8px;right:8px;width:8px;height:8px;border-radius:50%;background:#E3C04A;box-shadow:0 0 0 2px #111111}
.adminx-bell{position:absolute;top:46px;right:0;width:272px;background:#fff;border:1px solid #ECECEC;border-radius:14px;box-shadow:0 18px 44px rgba(0,0,0,.18);padding:14px;z-index:60;animation:adminxrise .2s ease both}
.adminx-bellrow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border-radius:9px;text-decoration:none;transition:background .15s ease}
.adminx-bellrow:hover{background:#F8F5EE}
.adminx-overlay{position:fixed;inset:0;background:rgba(15,15,15,.45);backdrop-filter:blur(2px);display:flex;align-items:flex-start;justify-content:center;padding-top:14vh;z-index:80;animation:adminxfade .15s ease both}
@keyframes adminxfade{from{opacity:0}to{opacity:1}}
.adminx-palette{width:min(560px,92vw);background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.3);overflow:hidden}
.adminx-palrow{display:flex;align-items:center;gap:11px;width:100%;padding:11px 12px;border:none;background:transparent;border-radius:10px;cursor:pointer;text-align:left;transition:background .14s ease}
.adminx-palrow:hover{background:#F8F5EE}
.adminx-menurow{display:flex;align-items:center;gap:10px;width:100%;padding:9px 8px;border-radius:9px;text-decoration:none;font-size:13px;font-weight:600;color:#111111;transition:background .15s ease}
.adminx-menurow:hover{background:#F8F5EE}
.adminx-panel{padding:28px}
@media(max-width:640px){.adminx-panel{padding:16px 14px}}
@media(max-width:640px){.qmg-bar{justify-content:center!important}}
.adminx-drawer{position:fixed;top:0;bottom:0;left:0;width:min(284px,86vw);z-index:55;background:linear-gradient(180deg,#111111 0%,#166534 100%);border-right:1px solid rgba(255,255,255,.08);box-shadow:10px 0 40px rgba(0,0,0,.5);display:flex;flex-direction:column;animation:adminxslide .2s cubic-bezier(.4,0,.2,1) both}
@media(min-width:1024px){.adminx-drawer{left:240px;width:250px}}
@keyframes adminxslide{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
.adminx-drawer-bd{position:fixed;inset:0;z-index:44;background:rgba(0,0,0,.2)}
.adminx-chev{transition:transform .2s ease}
.adminx-section{padding:14px 13px 5px;font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.4);font-family:'Inter',sans-serif;user-select:none;white-space:nowrap}
.adminx-section:first-child{padding-top:4px}
.adminx-nav-scroll{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent}
.adminx-nav-scroll::-webkit-scrollbar{width:6px}
.adminx-nav-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:99px}
.adminx-nav-scroll::-webkit-scrollbar-thumb:hover{background:rgba(201,162,39,.4)}
`

export default function AdminLayout({
  children,
  adminName,
}: {
  children: React.ReactNode
  adminName?: string
}) {
  const router   = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [openCat, setOpenCat] = useState<string | null>(null)
  const [ctxReady, setCtxReady] = useState(false)
  const [ctx, setCtx] = useState<(AdminCtx & { roleLabel?: string }) | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState<any[]>([])
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [name, setName] = useState(adminName || 'Admin')

  useEffect(() => {
    (async () => {
      try {
        const sb = createClient()
        const { data: { user } } = await sb.auth.getUser()
        if (!user) return
        const { data: p } = await sb.from('profiles')
          .select('role, admin_role, admin_permissions, admin_status, admin_role_label, first_name')
          .eq('id', user.id).single()
        const prof = (p as any) || {}
        setCtx({
          role: prof.role ?? null,
          adminRole: prof.admin_role ?? null,
          permissions: Array.isArray(prof.admin_permissions) ? prof.admin_permissions : [],
          status: prof.admin_status ?? 'active',
          roleLabel: prof.admin_role_label ?? undefined,
        })
        setName(prof.first_name || adminName || 'Admin')
      } catch {}
      finally { setCtxReady(true) }
    })()
  }, [])

  const isSub = ctx?.adminRole === 'sub'
  const isSuper = !isSub
  const visibleNav = isSub
    ? NAV_ITEMS.filter(n => canAccessRoute(n.href, ctx))
    : NAV_ITEMS

  useEffect(() => { fetch('/api/notifications').then(r => r.ok ? r.json() : null).then(j => setNotes(j?.items || [])).catch(() => {}) }, [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(o => !o) }
      if (e.key === 'Escape') { setSearchOpen(false); setBellOpen(false); setUserMenuOpen(false); setOpenCat(null) }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { setOpenCat(null); setSidebarOpen(false) }, [pathname])

  const can = (perm: string) => !isSub || (ctx?.permissions || []).includes(perm)
  const bellCount = notes.length

  // ── Sidebar badge counts (reuse the data already fetched for the bell) ──
  // Verification Queue → pending teacher applications.
  // Support Tickets   → open tickets (red if any are urgent).
  const findCount = (type: string) => (notes.find((n: any) => n?.type === type)?.count as number) || 0
  const urgentTickets = findCount('urgent')
  const badgeForHref = (href: string): { count: number; urgent: boolean } | null => {
    if (href === '/verification-queue') { const c = findCount('verification'); return c > 0 ? { count: c, urgent: false } : null }
    if (href === '/re-verification')    { const c = findCount('reverification'); return c > 0 ? { count: c, urgent: false } : null }
    if (href === '/support')            { const c = findCount('ticket');       return c > 0 ? { count: c, urgent: urgentTickets > 0 } : null }
    if (href === '/moderation')         { const c = findCount('moderation');   return c > 0 ? { count: c, urgent: (notes.find((n: any) => n?.type === 'moderation')?.severity === 'red') } : null }
    if (href === '/attendance')         { const c = findCount('attendance_anomaly'); return c > 0 ? { count: c, urgent: true } : null }
    return null
  }
  const SEV: Record<string, string> = { gold: '#C9A227', red: '#DC2626', neutral: '#6366F1' }
  const paletteResults = visibleNav.filter(n => n.label.toLowerCase().includes(query.toLowerCase()))

  // ── Category derivation (flat sections) ──
  const visibleCategories = CATEGORIES
    .map(c => ({ ...c, items: isSub ? c.items.filter(n => canAccessRoute(n.href, ctx)) : c.items }))
    .filter(c => c.items.length > 0)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/teachers') return pathname === '/teachers'
    return pathname === href || pathname.startsWith(href + '/')
  }

  function SidebarContent() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'linear-gradient(180deg, #111111 0%, #166534 100%)' }}>
        {/* Brand header */}
        <div style={{ padding: '18px 12px 14px', borderBottom: '1px solid rgba(255,255,255,0.09)', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
          <img src={LOGO_SRC} alt="QMG" style={{ width: 60, height: 60, objectFit: 'contain' }} />
          <Wordmark size={16} light />
          <span className="adminx-portal-pill"><span className="adminx-portal-dot" />Admin Panel</span>
        </div>

        {/* Nav — flat category sections; items listed directly, scrolls if tall */}
        <nav className="adminx-nav-scroll" style={{ flex: 1, padding: '6px 10px 12px', overflowY: 'auto', minHeight: 0 }}>
          {!ctxReady ? (
            [0, 1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ height: 36, margin: '5px 0', borderRadius: 11, background: 'rgba(255,255,255,0.05)' }} />
            ))
          ) : visibleCategories.map((cat) => (
            <div key={cat.key} style={{ marginBottom: 4 }}>
              <div className="adminx-section">{cat.label}</div>
              {cat.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href)
                const badge = badgeForHref(href)
                return (
                  <button
                    key={href}
                    onClick={() => { router.push(href); setSidebarOpen(false) }}
                    className={`adminx-nav ${active ? 'adminx-nav-active' : ''}`}
                  >
                    <Icon size={16} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, lineHeight: 1.2 }}>{label}</span>
                    {badge && (
                      <span className={`adminx-badge ${badge.urgent ? 'adminx-badge-urgent' : ''}`}>
                        {badge.count > 99 ? '99+' : badge.count}
                      </span>
                    )}
                    {active && <ChevronRight size={13} style={{ color: '#E3C04A', flexShrink: 0 }} />}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Sign Out + footer */}
        <div style={{ padding: '10px 10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <button onClick={handleSignOut} className="adminx-signout">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
          <p style={{ fontSize: 9, marginTop: 10, textAlign: 'center', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.4px' }}>
            QuranMentorGlobal.com
          </p>
        </div>
      </div>
    )
  }

  const activePage = NAV_ITEMS.find(n => isActive(n.href))

  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100%', maxWidth: '100vw', overflow: 'hidden', background: '#111111' }}>
      <style>{ADMINX_STYLES}</style>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col" style={{ width: 240, flexShrink: 0, height: '100%', position: 'relative', zIndex: 50 }}>
        <SidebarContent />
      </div>

      {/* Mobile Overlay + drawer */}
      {sidebarOpen && (
        <div className="lg:hidden" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          <div style={{ width: 240, flexShrink: 0, height: '100%', boxShadow: '6px 0 30px rgba(0,0,0,0.5)' }}><SidebarContent /></div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.55)' }} onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Right side (dark frame so the rounded panel corners read clean) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, background: '#111111' }}>

        {/* Top bar */}
        <header style={{
          height: 72, background: 'linear-gradient(90deg, #111111 0%, #166534 100%)',
          display: 'flex', alignItems: 'center', paddingLeft: 22, paddingRight: 22,
          gap: 14, flexShrink: 0, position: 'relative',
        }}>
          {/* Mobile hamburger */}
          <button className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ padding: 6, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', flexShrink: 0 }}>
            {sidebarOpen ? <X size={20} color="#fff" /> : <Menu size={20} color="#fff" />}
          </button>

          {/* Left: greeting */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#E3C04A', margin: 0, letterSpacing: '0.04em' }}>{(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' })()}</p>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: 0, fontFamily: "'Fraunces',serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span className="hidden sm:inline">Welcome back, </span>{name} 👋
            </p>
          </div>

          {/* Center: brand (desktop) */}
          <div className="hidden lg:flex" style={{ alignItems: 'center', gap: 9, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            <img src={LOGO_SRC} alt="QMG" style={{ width: 60, height: 60, objectFit: 'contain' }} />
            <Wordmark size={20} light />
          </div>

          {/* Right: search, notifications, identity + avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <button onClick={() => setSearchOpen(true)} title="Search (Ctrl/Cmd K)" className="adminx-iconbtn hidden sm:flex">
              <Search size={18} color="#fff" />
            </button>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setBellOpen(o => !o)} title="Notifications" className="adminx-iconbtn">
                <Bell size={18} color="#fff" />
                {bellCount > 0 && <span className="adminx-dot" />}
              </button>
              {bellOpen && <div onClick={() => setBellOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />}
              {bellOpen && (
                <div className="adminx-bell">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 8px' }}>
                    <p style={{ fontSize: 12.5, fontWeight: 800, color: '#111111', margin: 0 }}>Notifications</p>
                    {bellCount > 0 && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#C9A227', background: '#F8F5EE', borderRadius: 999, padding: '2px 8px' }}>{bellCount}</span>}
                  </div>
                  {notes.length === 0
                    ? <p style={{ fontSize: 12, color: '#9A9A8A', margin: '8px 0 4px' }}>You&apos;re all caught up ✨</p>
                    : notes.map((b, i) => (
                      <a key={i} href={b.href} onClick={() => setBellOpen(false)} className="adminx-bellrow">
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: SEV[b.severity] || '#C9A227', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12.5, color: '#111111', fontWeight: 600, lineHeight: 1.3 }}>{b.label}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: SEV[b.severity] || '#C9A227', background: '#F8F5EE', borderRadius: 7, padding: '1px 7px', flexShrink: 0 }}>{b.count}</span>
                      </a>
                    ))}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setUserMenuOpen(o => !o)} title="Account" style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <div className="hidden sm:block" style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', margin: 0, lineHeight: 1.2 }}>{name}</p>
                  <p style={{ fontSize: 11, color: '#E3C04A', margin: 0 }}>{isSuper ? 'Super Admin' : (ctx?.roleLabel || 'Sub Admin')}</p>
                </div>
                <div className="adminx-avatar" style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #C9A227, #E0BE63)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111111', fontSize: 15, fontWeight: 800, flexShrink: 0, boxShadow: '0 2px 8px rgba(201,162,39,0.35)' }}>
                  {(name || 'A')[0].toUpperCase()}
                </div>
              </button>
              {userMenuOpen && <div onClick={() => setUserMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />}
              {userMenuOpen && (
                <div className="adminx-bell" style={{ width: 232 }}>
                  <div style={{ padding: '2px 6px 10px', borderBottom: '1px solid #ECECEC', marginBottom: 8 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 800, color: '#111111', margin: 0 }}>{name}</p>
                    <p style={{ fontSize: 11.5, color: '#C9A227', fontWeight: 700, margin: '2px 0 0' }}>{isSuper ? 'Super Admin' : (ctx?.roleLabel || 'Sub Admin')}</p>
                  </div>
                  {can('settings.view') && (
                    <a href="/settings" onClick={() => setUserMenuOpen(false)} className="adminx-menurow"><Settings size={15} style={{ color: '#9A9A8A' }} /> Platform Settings</a>
                  )}
                  <button onClick={handleSignOut} className="adminx-menurow" style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#DC2626' }}><LogOut size={15} /> Sign Out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Cream rounded content panel — full width, internal scroll */}
        <main className="adminx-panel" style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden', minWidth: 0,
          width: '100%', maxWidth: '100%', boxSizing: 'border-box',
          background: '#F8F5EE',
        }}>
          <div className="adminx-page" key={pathname}>{children}</div>
        </main>
      </div>

      {searchOpen && (
        <div className="adminx-overlay" onClick={() => setSearchOpen(false)}>
          <div className="adminx-palette" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #ECECEC' }}>
              <Search size={18} color="#9A9A8A" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && paletteResults[0]) { router.push(paletteResults[0].href); setSearchOpen(false); setQuery('') } }}
                placeholder="Search pages…" style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#111111', background: 'transparent', fontFamily: "'Inter',sans-serif" }} />
              <span style={{ fontSize: 10.5, color: '#B0B0B0', border: '1px solid #E2E2E2', borderRadius: 6, padding: '2px 6px' }}>ESC</span>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', padding: 8 }}>
              {paletteResults.length === 0
                ? <p style={{ fontSize: 13, color: '#9A9A8A', padding: 16, textAlign: 'center', margin: 0 }}>No matching pages.</p>
                : paletteResults.map(({ href, label, icon: Icon }) => (
                  <button key={href} onClick={() => { router.push(href); setSearchOpen(false); setQuery('') }} className="adminx-palrow">
                    <Icon size={16} style={{ color: '#C9A227' }} />
                    <span style={{ fontSize: 14, color: '#111111', fontWeight: 600 }}>{label}</span>
                    <ChevronRight size={15} style={{ color: '#C8C8C8', marginLeft: 'auto' }} />
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
