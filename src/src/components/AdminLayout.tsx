'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  Star, Settings, LogOut, Menu, X, ChevronRight,
  ClipboardList, CreditCard, MessageSquare,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',        label: 'Dashboard',            icon: LayoutDashboard },
  { href: '/teachers/pending', label: 'Teacher Applications', icon: ClipboardList   },
  { href: '/teachers',         label: 'Teacher Management',   icon: GraduationCap   },
  { href: '/students',         label: 'Student Management',   icon: Users           },
  { href: '/bookings',         label: 'Bookings Overview',    icon: BookOpen        },
  { href: '/reviews',          label: 'Reviews Moderation',   icon: Star            },
  { href: '/payments',         label: 'Payments & Revenue',   icon: CreditCard      },
  { href: '/support',          label: 'Support Tickets',      icon: MessageSquare   },
  { href: '/settings',         label: 'Platform Settings',    icon: Settings        },
]

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
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        background: 'linear-gradient(180deg, rgb(0,87,34) 0%, rgb(15,137,61) 100%)',
      }}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="QMG" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain', flexShrink: 0, background: 'rgba(255,255,255,0.1)', padding: 3 }} />
            <div>
              <p style={{ color: '#ffffff', fontWeight: 800, fontSize: 14, fontFamily: "'Playfair Display', serif", lineHeight: 1.2, margin: 0 }}>
                Quran<span style={{ color: '#D4AF50' }}>Mentor</span>
              </p>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
                padding: '2px 7px', borderRadius: 20, display: 'inline-block', marginTop: 2,
                background: 'rgba(184,149,42,0.3)', color: '#D4AF50',
              }}>Admin Panel</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <button
                key={href}
                onClick={() => { router.push(href); setSidebarOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 10, marginBottom: 1,
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: '#ffffff',          // ← always pure white
                  border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: active ? 700 : 400,
                  fontFamily: "'DM Sans', sans-serif",
                  opacity: active ? 1 : 0.82,  // subtle dim for inactive, still readable
                  transition: 'all 0.15s', textAlign: 'left',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'
                    ;(e.currentTarget as HTMLElement).style.opacity = '1'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.opacity = '0.82'
                  }
                }}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{label}</span>
                {active && <ChevronRight size={13} style={{ color: '#D4AF50', flexShrink: 0 }} />}
              </button>
            )
          })}
        </nav>

        {/* Sign Out */}
        <div style={{ padding: '8px 8px 16px', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
          <button
            onClick={handleSignOut}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'transparent', color: '#ffffff', opacity: 0.7,
              fontSize: 13, fontWeight: 400, fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.opacity = '1' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.opacity = '0.7' }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    )
  }

  const activePage = NAV_ITEMS.find(n => isActive(n.href))

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F5F0E8' }}>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col" style={{ width: 220, flexShrink: 0, height: '100%' }}>
        <SidebarContent />
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          <div style={{ width: 220, flexShrink: 0, height: '100%' }}>
            <SidebarContent />
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }} onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          height: 54, background: '#ffffff', borderBottom: '1px solid #E8E4DA',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ padding: '6px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            {sidebarOpen ? <X size={20} color="#6B6B6B" /> : <Menu size={20} color="#6B6B6B" />}
          </button>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#9A9A8A', fontFamily: "'DM Sans', sans-serif" }}>Admin</span>
            {activePage && <>
              <span style={{ fontSize: 12, color: '#C8C4B8' }}>/</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1B5E37', fontFamily: "'DM Sans', sans-serif" }}>{activePage.label}</span>
            </>}
          </div>

          <div style={{ flex: 1 }} />

          {/* Admin avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="hidden sm:block" style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.2, fontFamily: "'DM Sans', sans-serif" }}>
                {adminName || 'Admin'}
              </p>
              <p style={{ fontSize: 11, color: '#9A9A8A' }}>Super Admin</p>
            </div>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgb(0,87,34), rgb(15,137,61))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ffffff', fontSize: 14, fontWeight: 800, flexShrink: 0,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {(adminName || 'A')[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 24px' }} className="lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
