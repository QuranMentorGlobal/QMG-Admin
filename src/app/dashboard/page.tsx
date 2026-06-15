'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { Users, GraduationCap, BookOpen, DollarSign, Clock, Star } from 'lucide-react'

type Stats = {
  totalStudents: number
  totalTeachers: number
  totalBookings: number
  totalRevenue: number
  pendingTeachers: number
  pendingReviews: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0, totalTeachers: 0, totalBookings: 0,
    totalRevenue: 0, pendingTeachers: 0, pendingReviews: 0,
  })
  const [adminName, setAdminName] = useState('Admin')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles').select('first_name').eq('id', user.id).single()
          setAdminName((profile as any)?.first_name || 'Admin')
        }
      } catch {}
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [])

  const statCards = [
    { label: 'Total Students',   value: stats.totalStudents,                  icon: Users,         bg: '#E8F5EE', color: '#1B5E37', urgent: false },
    { label: 'Total Teachers',   value: stats.totalTeachers,                  icon: GraduationCap, bg: '#F0E4B8', color: '#B8952A', urgent: false },
    { label: 'Total Bookings',   value: stats.totalBookings,                  icon: BookOpen,      bg: '#EDE6D6', color: '#097434', urgent: false },
    { label: 'Platform Revenue', value: `$${stats.totalRevenue.toFixed(0)}`,  icon: DollarSign,    bg: '#E8F5EE', color: '#1B5E37', urgent: false },
    { label: 'Pending Teachers', value: stats.pendingTeachers,                icon: Clock,         bg: '#FEF3C7', color: '#B8952A', urgent: stats.pendingTeachers > 0 },
    { label: 'Pending Reviews',  value: stats.pendingReviews,                 icon: Star,          bg: '#FEE2E2', color: '#DC2626', urgent: stats.pendingReviews > 0 },
  ]

  const quickActions = [
    { label: 'Review Applications', href: '/teachers/pending', emoji: '📋', color: '#1B5E37', bg: '#E8F5EE' },
    { label: 'Moderate Reviews',    href: '/reviews',          emoji: '⭐', color: '#B8952A', bg: '#F0E4B8' },
    { label: 'View Bookings',       href: '/bookings',         emoji: '📅', color: '#097434', bg: '#EDE6D6' },
    { label: 'Platform Settings',   href: '/settings',         emoji: '⚙️', color: '#1B5E37', bg: '#E8F5EE' },
  ]

  return (
    <AdminLayout adminName={adminName}>
      <div style={{ maxWidth: 1100 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 800, color: '#097434', margin: 0 }}>
            Welcome back, {adminName} 👋
          </h1>
          <p style={{ fontSize: 13, color: '#6B7A6B', marginTop: 4 }}>
            Here's what's happening on QuranMentorGlobal today.
          </p>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
          {loading
            ? [...Array(6)].map((_, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 16, height: 100, border: '1px solid #E8E4DA' }}>
                  <div style={{ margin: 20, height: 16, background: '#F0EDE6', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
                  <div style={{ margin: '8px 20px', height: 28, background: '#F0EDE6', borderRadius: 8, width: '50%', animation: 'pulse 1.5s infinite' }} />
                </div>
              ))
            : statCards.map(({ label, value, icon: Icon, bg, color, urgent }) => (
                <div key={label} style={{
                  background: '#fff', borderRadius: 16, padding: '18px 20px',
                  border: `1px solid ${urgent ? '#FECACA' : '#E8E4DA'}`,
                  display: 'flex', alignItems: 'center', gap: 14,
                  boxShadow: urgent ? '0 0 0 2px rgba(220,38,38,0.08)' : 'none',
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={20} style={{ color }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 22, fontWeight: 800, color, margin: 0, lineHeight: 1.1 }}>{value}</p>
                    <p style={{ fontSize: 12, color: '#9A9A8A', margin: '3px 0 0', fontWeight: 500 }}>{label}</p>
                    {urgent && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626' }}>Needs attention</span>
                    )}
                  </div>
                </div>
              ))
          }
        </div>

        {/* Quick Actions */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '22px 24px', border: '1px solid #E8E4DA' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#097434', margin: '0 0 16px', letterSpacing: '0.01em' }}>
            Quick Actions
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {quickActions.map(({ label, href, emoji, color, bg }) => (
              <a key={href} href={href} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '16px 12px', borderRadius: 12, textAlign: 'center',
                textDecoration: 'none', fontSize: 12, fontWeight: 700, color,
                background: bg, border: `1px solid ${bg}`,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}>
                <span style={{ fontSize: 24 }}>{emoji}</span>
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
