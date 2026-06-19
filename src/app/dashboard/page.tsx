'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { Users, GraduationCap, BookOpen, DollarSign, Clock, Star } from 'lucide-react'

type Stats = {
  totalStudents: number; totalTeachers: number; totalBookings: number
  totalRevenue: number; pendingTeachers: number; pendingReviews: number
}

export default function DashboardPage() {
  const [stats, setStats]         = useState<Stats>({ totalStudents:0,totalTeachers:0,totalBookings:0,totalRevenue:0,pendingTeachers:0,pendingReviews:0 })
  const [adminName, setAdminName] = useState('Admin')
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/stats')
      if (res.ok) setStats(await res.json())
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: p } = await supabase.from('profiles').select('first_name').eq('id', user.id).single()
          setAdminName((p as any)?.first_name || 'Admin')
        }
      } catch {}
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [])

  const cards = [
    { label: 'Total Students',   value: stats.totalStudents,                 icon: Users,         bg: '#F7F1E2', color: '#B8952A', urgent: false },
    { label: 'Total Teachers',   value: stats.totalTeachers,                 icon: GraduationCap, bg: '#F0E4B8', color: '#B8952A', urgent: false },
    { label: 'Total Bookings',   value: stats.totalBookings,                 icon: BookOpen,      bg: '#EDE6D6', color: '#1A1A1A', urgent: false },
    { label: 'Platform Revenue', value: `$${stats.totalRevenue.toFixed(0)}`, icon: DollarSign,    bg: '#F7F1E2', color: '#B8952A', urgent: false },
    { label: 'Pending Teachers', value: stats.pendingTeachers, icon: Clock, bg: stats.pendingTeachers > 0 ? '#FEF3C7' : '#F5F0E8', color: stats.pendingTeachers > 0 ? '#B8952A' : '#9A9A8A', urgent: stats.pendingTeachers > 0 },
    { label: 'Pending Reviews',  value: stats.pendingReviews,  icon: Star,  bg: stats.pendingReviews  > 0 ? '#FEE2E2' : '#F5F0E8', color: stats.pendingReviews  > 0 ? '#DC2626' : '#9A9A8A', urgent: stats.pendingReviews  > 0 },
  ]

  const quickActions = [
    { label: 'Review Applications', href: '/teachers/pending', emoji: '📋', color: '#B8952A', bg: '#F7F1E2' },
    { label: 'Moderate Reviews',    href: '/reviews',          emoji: '⭐', color: '#B8952A', bg: '#F0E4B8' },
    { label: 'View Bookings',       href: '/bookings',         emoji: '📅', color: '#1A1A1A', bg: '#EDE6D6' },
    { label: 'Platform Settings',   href: '/settings',         emoji: '⚙️', color: '#B8952A', bg: '#F7F1E2' },
  ]

  return (
    <AdminLayout adminName={adminName}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 26, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>
          Welcome back, {adminName} 👋
        </h1>
        <p style={{ fontSize: 13, color: '#6B6B6B', marginTop: 6, margin: '6px 0 0' }}>
          Here's what's happening on QuranMentorGlobal today.
        </p>
      </div>

      {/* Stat cards — 3 equal columns, full width */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}
        className="admin-stat-grid">
        {loading
          ? [...Array(6)].map((_, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 16, height: 86, border: '1px solid #E8E4DA', animation: 'pulse 1.5s infinite' }} />
            ))
          : cards.map(({ label, value, icon: Icon, bg, color, urgent }) => (
              <div key={label} style={{
                background: '#fff', borderRadius: 16, padding: '18px 20px',
                border: `1px solid ${urgent ? '#FECACA' : '#E8E4DA'}`,
                display: 'flex', alignItems: 'center', gap: 14,
                boxShadow: urgent ? '0 0 0 2px rgba(220,38,38,0.06)' : '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} style={{ color }} />
                </div>
                <div>
                  <p style={{ fontSize: 26, fontWeight: 800, color, margin: 0, lineHeight: 1 }}>{value}</p>
                  <p style={{ fontSize: 12, color: '#9A9A8A', margin: '4px 0 0', fontWeight: 500 }}>{label}</p>
                  {urgent && <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626' }}>Needs attention</span>}
                </div>
              </div>
            ))
        }
      </div>

      {/* Quick Actions — 4 equal columns, full width */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', border: '1px solid #E8E4DA', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: '0 0 14px' }}>
          Quick Actions
        </h2>
        {/* 4 equal columns — no auto-fill, always exactly 4 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}
          className="admin-quick-grid">
          {quickActions.map(({ label, href, emoji, color, bg }) => (
            <a key={href} href={href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '20px 12px', borderRadius: 12, textAlign: 'center',
              textDecoration: 'none', fontSize: 13, fontWeight: 700, color, background: bg,
              transition: 'all 0.15s', fontFamily: "'Inter',sans-serif", minHeight: 90,
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '' }}>
              <span style={{ fontSize: 26 }}>{emoji}</span>
              {label}
            </a>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @media(max-width:900px) { .admin-stat-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media(max-width:500px) { .admin-stat-grid { grid-template-columns: 1fr !important; } .admin-quick-grid { grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>
    </AdminLayout>
  )
}
