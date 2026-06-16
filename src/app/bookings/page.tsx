'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { format } from 'date-fns'

type Booking = {
  id: string
  status: string
  price_usd: number
  is_trial: boolean
  start_date: string
  session_time: string
  recurrence: string
  created_at: string
  courses: { title: string }
  student: { first_name: string; last_name: string; email: string }
  teacher: { first_name: string; last_name: string }
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#FEF3C7', color: '#D97706' },
  confirmed: { bg: '#E8F5EE', color: '#1B5E37' },
  completed: { bg: '#E0F2FE', color: '#0369A1' },
  cancelled: { bg: '#FEE2E2', color: '#DC2626' },
}

const STATUSES = ['all', 'pending', 'confirmed', 'completed', 'cancelled']

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filtered, setFiltered] = useState<Booking[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchBookings() }, [])

  useEffect(() => {
    setFiltered(statusFilter === 'all' ? bookings : bookings.filter(b => b.status === statusFilter))
  }, [statusFilter, bookings])

  async function fetchBookings() {
    const supabase = createClient()
    const { data } = await supabase
      .from('bookings')
      .select(`
        *,
        courses(title),
        student:profiles!bookings_student_id_fkey(first_name, last_name, email),
        teacher:profiles!bookings_teacher_id_fkey(first_name, last_name)
      `)
      .order('created_at', { ascending: false }) as any
    setBookings(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Bookings Overview</h1>
          <p className="text-sm text-ink-light mt-1">{bookings.length} total bookings across the platform</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap mb-5">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all"
              style={statusFilter === s
                ? { background: '#1B5E37', color: '#fff' }
                : { background: '#fff', color: '#6B6B6B', border: '1px solid #E5E7EB' }}>
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />)}</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(b => {
              const sc = STATUS_COLORS[b.status] || { bg: '#F3F4F6', color: '#6B6B6B' }
              return (
                <div key={b.id}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-bold text-ink text-sm">{b.courses?.title || 'Course'}</p>
                      {b.is_trial && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: '#F0E4B8', color: '#B8952A' }}>Trial</span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: sc.bg, color: sc.color }}>
                        {b.status}
                      </span>
                    </div>
                    <p className="text-xs text-ink-light">
                      👤 {b.student?.first_name} {b.student?.last_name} → 🎓 {b.teacher?.first_name} {b.teacher?.last_name}
                    </p>
                    <p className="text-xs text-ink-light mt-0.5">
                      📅 {b.start_date} at {b.session_time} · {b.recurrence}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-ink">${b.price_usd}</p>
                    <p className="text-xs text-ink-light mt-0.5">
                      {b.created_at ? format(new Date(b.created_at), 'dd MMM yyyy') : '—'}
                    </p>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center">
                <p className="text-ink-light">No bookings found for this filter.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
