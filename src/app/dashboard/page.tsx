'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { Users, GraduationCap, BookOpen, DollarSign, Clock, TrendingUp } from 'lucide-react'

type Stats = {
  totalStudents: number
  totalTeachers: number
  totalBookings: number
  totalRevenue: number
  pendingTeachers: number
  pendingReviews: number
}

type StatCard = {
  label: string
  value: string | number
  numericValue: number
  icon: any
  color: string
  bg: string
  urgent?: boolean
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0, totalTeachers: 0, totalBookings: 0,
    totalRevenue: 0, pendingTeachers: 0, pendingReviews: 0,
  })
  const [adminName, setAdminName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles').select('first_name').eq('id', user.id).single()
      setAdminName((profile as any)?.first_name || 'Admin')

      // Run each query independently so one failure doesn't block the rest
      const [students, teachers, bookings, payments, pending, reviews] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }),
        supabase.from('payments').select('platform_fee_usd').limit(1000),
        supabase.from('teacher_profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('is_published', false),
      ])

      const revenue = ((payments.data as any[]) || []).reduce(
        (sum: number, p: any) => sum + (Number(p.platform_fee_usd) || 0), 0
      )

      setStats({
        totalStudents:  students.count  ?? 0,
        totalTeachers:  teachers.count  ?? 0,
        totalBookings:  bookings.count  ?? 0,
        totalRevenue:   revenue,
        pendingTeachers: pending.count  ?? 0,
        pendingReviews:  reviews.count  ?? 0,
      })
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [])

  const statCards: StatCard[] = [
    { label: 'Total Students',   value: stats.totalStudents,                numericValue: stats.totalStudents,   icon: Users,         color: '#1B5E37', bg: '#E8F5EE' },
    { label: 'Total Teachers',   value: stats.totalTeachers,                numericValue: stats.totalTeachers,   icon: GraduationCap, color: '#B8952A', bg: '#F0E4B8' },
    { label: 'Total Bookings',   value: stats.totalBookings,                numericValue: stats.totalBookings,   icon: BookOpen,      color: '#6366F1', bg: '#EEF2FF' },
    { label: 'Platform Revenue', value: `$${stats.totalRevenue.toFixed(0)}`, numericValue: stats.totalRevenue,  icon: DollarSign,    color: '#0891B2', bg: '#E0F7FA' },
    { label: 'Pending Teachers', value: stats.pendingTeachers,              numericValue: stats.pendingTeachers, icon: Clock,         color: '#DC2626', bg: '#FEE2E2', urgent: true },
    { label: 'Pending Reviews',  value: stats.pendingReviews,               numericValue: stats.pendingReviews,  icon: TrendingUp,    color: '#7C3AED', bg: '#F3E8FF', urgent: true },
  ]

  return (
    <AdminLayout adminName={adminName}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-ink">
            Welcome back, <span style={{ color: '#1B5E37' }}>{adminName}</span> 👋
          </h1>
          <p className="text-sm text-ink-light mt-1">Here's what's happening on the platform today.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 h-28 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
                <div className="h-8 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {statCards.map(({ label, value, numericValue, icon: Icon, color, bg, urgent }) => (
              <div key={label}
                className="bg-white rounded-2xl p-5 shadow-sm border flex items-center gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderColor: urgent && numericValue > 0 ? '#FECACA' : '#F3F4F6' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: bg }}>
                  <Icon size={22} style={{ color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                  <p className="text-xs text-ink-light font-medium mt-0.5">{label}</p>
                  {urgent && numericValue > 0 && (
                    <span className="text-xs font-bold text-red-500">Needs attention !</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-ink mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Review Applications', href: '/teachers/pending', emoji: '📋', color: '#1B5E37' },
              { label: 'Moderate Reviews',    href: '/reviews',          emoji: '⭐', color: '#B8952A' },
              { label: 'View Bookings',       href: '/bookings',         emoji: '📅', color: '#6366F1' },
              { label: 'Platform Settings',   href: '/settings',         emoji: '⚙️', color: '#0891B2' },
            ].map(({ label, href, emoji, color }) => (
              <a key={href} href={href}
                className="flex flex-col items-center gap-2 p-4 rounded-xl text-center text-sm font-semibold transition-all hover:-translate-y-1 hover:shadow-md border border-gray-100"
                style={{ color }}>
                <span className="text-2xl">{emoji}</span>
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
