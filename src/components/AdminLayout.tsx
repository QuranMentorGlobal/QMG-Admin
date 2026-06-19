// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/components/AdminLayout.tsx
// (Admin chrome — charcoal-gold redesign to match the platform portal.
//  Solid #141414 sidebar + top bar, gold nav, rounded cream content panel.
//  Nav items, routes and sign-out logic are UNCHANGED.)
// ============================================================
'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { canAccessRoute, type AdminCtx } from '@/lib/permissions'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  Star, Settings, LogOut, Menu, X, ChevronRight, Search, Bell,
  CreditCard, MessageSquare, ShieldCheck, BarChart3, UserCog, ScrollText,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',            label: 'Dashboard',            icon: LayoutDashboard },
  { href: '/analytics',            label: 'Analytics',            icon: BarChart3       },
  { href: '/verification-queue',   label: 'Verification Queue',   icon: ShieldCheck     },
  { href: '/teachers',             label: 'Teacher Management',   icon: GraduationCap   },
  { href: '/students',             label: 'Student Management',   icon: Users           },
  { href: '/bookings',             label: 'Bookings Overview',    icon: BookOpen        },
  { href: '/reviews',              label: 'Reviews Moderation',   icon: Star            },
  { href: '/payments',             label: 'Payments & Revenue',   icon: CreditCard      },
  { href: '/support',              label: 'Support Tickets',      icon: MessageSquare   },
  { href: '/settings',             label: 'Platform Settings',    icon: Settings        },
  { href: '/admin-management',     label: 'Sub Admin Management',  icon: UserCog         },
  { href: '/audit-log',            label: 'Audit Log',             icon: ScrollText      },
]

const LOGO_SRC = '/logo.png'

// Wordmark — light (on dark chrome) or dark (on cream), matching the portal.
function Wordmark({ size = 16, light = true }: { size?: number; light?: boolean }) {
  return (
    <span style={{ fontFamily: "'Fraunces', serif", fontSize: size, fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.1, color: light ? '#ffffff' : '#111111', whiteSpace: 'nowrap' }}>
      Quran<span style={{ color: '#D4AF50' }}>Mentor</span>Global
    </span>
  )
}

// Scoped chrome polish (unique adminx- prefix to avoid collisions).
const ADMINX_STYLES = `
.adminx-nav{display:flex;align-items:center;gap:11px;width:100%;padding:10px 13px;border-radius:12px;margin-bottom:2px;background:transparent;border:none;border-left:3px solid transparent;color:#fff;font-size:13.5px;font-weight:500;font-family:'Inter',sans-serif;text-align:left;cursor:pointer;transition:background .2s ease,transform .2s cubic-bezier(.4,0,.2,1),color .2s ease,border-color .2s ease}
.adminx-nav:hover{background:rgba(255,255,255,.06);transform:translateX(3px)}
.adminx-nav-active{background:linear-gradient(90deg,rgba(200,162,74,.24),rgba(200,162,74,.07));color:#E8C766;border-left:3px solid #C8A24A;font-weight:700;box-shadow:inset 0 0 0 1px rgba(200,162,74,.12)}
.adminx-signout{display:flex;align-items:center;gap:11px;width:100%;padding:10px 13px;border-radius:12px;background:transparent;border:none;border-left:3px solid transparent;color:rgba(255,255,255,.62);font-size:13.5px;font-weight:500;font-family:'Inter',sans-serif;text-align:left;cursor:pointer;transition:background .2s ease,color .2s ease,transform .2s ease}
.adminx-signout:hover{background:rgba(239,68,68,.1);color:#FCA5A5;transform:translateX(3px)}
.adminx-portal-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#E8C766;background:rgba(200,162,74,.12);border:1px solid rgba(200,162,74,.28)}
.adminx-portal-dot{width:5px;height:5px;border-radius:50%;background:#C8A24A;box-shadow:0 0 6px rgba(200,162,74,.8)}
.adminx-avatar{transition:transform .2s ease,box-shadow .2s ease}
.adminx-avatar:hover{transform:scale(1.05)}
@media(min-width:1024px){.adminx-panel{border-top-left-radius:22px;border-top-right-radius:22px}}
.adminx-page{animation:adminxrise .42s cubic-bezier(.4,0,.2,1) both}
@keyframes adminxrise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.adminx-rise{animation:adminxrise .5s cubic-bezier(.4,0,.2,1) both}
.adminx-stat{transition:transform .25s cubic-bezier(.4,0,.2,1),box-shadow .25s ease,border-color .25s ease}
.adminx-stat:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(184,149,42,.16),0 2px 8px rgba(0,0,0,.06);border-color:rgba(184,149,42,.4)}
.adminx-row{transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
.adminx-row:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.06);border-color:rgba(184,149,42,.45)}
.qmg-skel{background:linear-gradient(90deg,#F1ECE2 25%,#E8E2D6 50%,#F1ECE2 75%);background-size:200% 100%;animation:qmgsh 1.4s infinite;border-radius:14px}
@keyframes qmgsh{0%{background-position:200% 0}100%{background-position:-200% 0}}
.adminx-iconbtn{position:relative;width:38px;height:38px;border-radius:11px;border:none;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .18s ease}
.adminx-iconbtn:hover{background:rgba(255,255,255,.13)}
.adminx-dot{position:absolute;top:8px;right:8px;width:8px;height:8px;border-radius:50%;background:#D4AF50;box-shadow:0 0 0 2px #141414}
.adminx-bell{position:absolute;top:46px;right:0;width:272px;background:#fff;border:1px solid #ECECEC;border-radius:14px;box-shadow:0 18px 44px rgba(0,0,0,.18);padding:14px;z-index:60;animation:adminxrise .2s ease both}
.adminx-bellrow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border-radius:9px;text-decoration:none;transition:background .15s ease}
.adminx-bellrow:hover{background:#F7F1E2}
.adminx-overlay{position:fixed;inset:0;background:rgba(15,15,15,.45);backdrop-filter:blur(2px);display:flex;align-items:flex-start;justify-content:center;padding-top:14vh;z-index:80;animation:adminxfade .15s ease both}
@keyframes adminxfade{from{opacity:0}to{opacity:1}}
.adminx-palette{width:min(560px,92vw);background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.3);overflow:hidden}
.adminx-palrow{display:flex;align-items:center;gap:11px;width:100%;padding:11px 12px;border:none;background:transparent;border-radius:10px;cursor:pointer;text-align:left;transition:background .14s ease}
.adminx-palrow:hover{background:#F7F1E2}
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
  const [ctx, setCtx] = useState<(AdminCtx & { roleLabel?: string }) | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    (async () => {
      try {
        const sb = createClient()
        const { data: { user } } = await sb.auth.getUser()
        if (!user) return
        const { data: p } = await sb.from('profiles')
          .select('role, admin_role, admin_permissions, admin_status, admin_role_label')
          .eq('id', user.id).single()
        const prof = (p as any) || {}
        setCtx({
          role: prof.role ?? null,
          adminRole: prof.admin_role ?? null,
          permissions: Array.isArray(prof.admin_permissions) ? prof.admin_permissions : [],
          status: prof.admin_status ?? 'active',
          roleLabel: prof.admin_role_label ?? undefined,
        })
      } catch {}
    })()
  }, [])

  const isSub = ctx?.adminRole === 'sub'
  const isSuper = !isSub
  const visibleNav = isSub
    ? NAV_ITEMS.filter(n => canAccessRoute(n.href, ctx))
    : NAV_ITEMS

  useEffect(() => { fetch('/api/stats').then(r => r.ok ? r.json() : null).then(setStats).catch(() => {}) }, [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(o => !o) }
      if (e.key === 'Escape') { setSearchOpen(false); setBellOpen(false) }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [])

  const can = (perm: string) => !isSub || (ctx?.permissions || []).includes(perm)
  const bellItems = [
    (can('verification.access') || can('teachers.view')) && stats?.pendingTeachers ? { label: 'Pending teacher verifications', value: stats.pendingTeachers, href: '/verification-queue' } : null,
    can('reviews.view') && stats?.pendingReviews ? { label: 'Reviews awaiting moderation', value: stats.pendingReviews, href: '/reviews' } : null,
  ].filter(Boolean) as any[]
  const bellCount = bellItems.reduce((sum, b) => sum + (b.value || 0), 0)
  const paletteResults = visibleNav.filter(n => n.label.toLowerCase().includes(query.toLowerCase()))

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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#141414' }}>
        {/* Brand header */}
        <div style={{ padding: '18px 12px 14px', borderBottom: '1px solid rgba(255,255,255,0.09)', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
          <img src={LOGO_SRC} alt="QMG" style={{ width: 52, height: 52, objectFit: 'contain' }} />
          <Wordmark size={16} light />
          <span className="adminx-portal-pill"><span className="adminx-portal-dot" />Admin Panel</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          {visibleNav.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <button
                key={href}
                onClick={() => { router.push(href); setSidebarOpen(false) }}
                className={`adminx-nav ${active ? 'adminx-nav-active' : ''}`}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{label}</span>
                {active && <ChevronRight size={13} style={{ color: '#E8C766', flexShrink: 0 }} />}
              </button>
            )
          })}
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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#141414' }}>
      <style>{ADMINX_STYLES}</style>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col" style={{ width: 240, flexShrink: 0, height: '100%' }}>
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, background: '#141414' }}>

        {/* Top bar */}
        <header style={{
          height: 64, background: '#141414',
          display: 'flex', alignItems: 'center', paddingLeft: 22, paddingRight: 22,
          gap: 14, flexShrink: 0, position: 'relative',
        }}>
          {/* Mobile hamburger */}
          <button className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ padding: 6, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', flexShrink: 0 }}>
            {sidebarOpen ? <X size={20} color="#fff" /> : <Menu size={20} color="#fff" />}
          </button>

          {/* Left: breadcrumb */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutDashboard size={15} style={{ color: '#D4AF50', flexShrink: 0 }} />
            <span className="hidden sm:inline" style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Admin</span>
            <ChevronRight size={13} className="hidden sm:inline" style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
            <span style={{ fontSize: 14.5, fontWeight: 700, color: '#fff', fontFamily: "'Fraunces',serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activePage?.label || 'Dashboard'}</span>
          </div>

          {/* Center: brand (desktop) */}
          <div className="hidden lg:flex" style={{ alignItems: 'center', gap: 9, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            <img src={LOGO_SRC} alt="QMG" style={{ width: 38, height: 38, objectFit: 'contain' }} />
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
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', margin: '0 0 8px' }}>Notifications</p>
                  {bellItems.length === 0
                    ? <p style={{ fontSize: 12, color: '#9A9A8A', margin: 0 }}>You&apos;re all caught up ✨</p>
                    : bellItems.map((b, i) => (
                      <a key={i} href={b.href} onClick={() => setBellOpen(false)} className="adminx-bellrow">
                        <span style={{ fontSize: 12.5, color: '#1A1A1A', fontWeight: 600 }}>{b.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#B8952A' }}>{b.value}</span>
                      </a>
                    ))}
                </div>
              )}
            </div>
            <div className="hidden sm:block" style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', margin: 0, lineHeight: 1.2 }}>
                {adminName || 'Admin'}
              </p>
              <p style={{ fontSize: 11, color: '#D4AF50', margin: 0 }}>{isSuper ? 'Super Admin' : (ctx?.roleLabel || 'Sub Admin')}</p>
            </div>
            <div className="adminx-avatar" style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'linear-gradient(135deg, #C8A24A, #E0BE63)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#1A1400', fontSize: 15, fontWeight: 800, flexShrink: 0,
              boxShadow: '0 2px 8px rgba(184,149,42,0.35)',
            }}>
              {(adminName || 'A')[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Cream rounded content panel — full width, internal scroll */}
        <main className="adminx-panel" style={{
          flex: 1, overflowY: 'auto',
          padding: '28px',
          width: '100%', boxSizing: 'border-box',
          background: '#F5F0E8',
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
                placeholder="Search pages…" style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#1A1A1A', background: 'transparent', fontFamily: "'Inter',sans-serif" }} />
              <span style={{ fontSize: 10.5, color: '#B0B0B0', border: '1px solid #E2E2E2', borderRadius: 6, padding: '2px 6px' }}>ESC</span>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', padding: 8 }}>
              {paletteResults.length === 0
                ? <p style={{ fontSize: 13, color: '#9A9A8A', padding: 16, textAlign: 'center', margin: 0 }}>No matching pages.</p>
                : paletteResults.map(({ href, label, icon: Icon }) => (
                  <button key={href} onClick={() => { router.push(href); setSearchOpen(false); setQuery('') }} className="adminx-palrow">
                    <Icon size={16} style={{ color: '#B8952A' }} />
                    <span style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 600 }}>{label}</span>
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
