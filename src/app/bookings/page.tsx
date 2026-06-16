'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'

type Booking = {
  id: string; status: string; price_usd: number; is_trial: boolean
  scheduled_at: string; created_at: string
  courses: { title: string }
  student: { first_name: string; last_name: string; email: string }
  teacher: { first_name: string; last_name: string }
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#FEF3C7', color: '#B8952A' },
  confirmed: { bg: '#E8F5EE', color: '#1B5E37' },
  completed: { bg: '#EEF2FF', color: '#6366F1' },
  cancelled: { bg: '#FEE2E2', color: '#DC2626' },
}
const STATUSES = ['all', 'pending', 'confirmed', 'completed', 'cancelled']

export default function BookingsPage() {
  const [bookings, setBookings]       = useState<Booking[]>([])
  const [filtered, setFiltered]       = useState<Booking[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading]         = useState(true)

  useEffect(() => { fetchBookings() }, [])
  useEffect(() => {
    setFiltered(statusFilter === 'all' ? bookings : bookings.filter(b => b.status === statusFilter))
  }, [statusFilter, bookings])

  async function fetchBookings() {
    const supabase = createClient()
    const { data } = await supabase.from('bookings').select(`
      id, status, price_usd, is_trial, scheduled_at, created_at,
      courses(title),
      student:profiles!bookings_student_id_fkey(first_name,last_name,email),
      teacher:profiles!bookings_teacher_id_fkey(first_name,last_name)
    `).order('created_at', { ascending: false }) as any
    setBookings(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  function fmtDate(iso: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 800, color: '#097434', margin: 0 }}>Bookings Overview</h1>
          <p style={{ fontSize: 13, color: '#6B7A6B', marginTop: 4 }}>{bookings.length} total bookings across the platform</p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', textTransform: 'capitalize', fontFamily: "'DM Sans',sans-serif",
                background: statusFilter === s ? '#1B5E37' : '#fff',
                color: statusFilter === s ? '#fff' : '#6B6B6B',
                boxShadow: statusFilter === s ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
              }}>{s}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3,4].map(i => <div key={i} style={{ background: '#fff', borderRadius: 16, height: 76, border: '1px solid #E8E4DA', animation: 'pulse 1.5s infinite' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 20, padding: '60px 24px', textAlign: 'center', border: '1px solid #E8E4DA' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: '#097434', margin: 0 }}>
              No {statusFilter !== 'all' ? statusFilter : ''} bookings yet
            </p>
            <p style={{ fontSize: 13, color: '#9A9A8A', marginTop: 6 }}>
              {statusFilter !== 'all' ? 'Try a different status filter.' : 'Bookings will appear here once students start booking lessons.'}
            </p>
            {statusFilter !== 'all' && <button onClick={() => setStatusFilter('all')} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 10, background: '#1B5E37', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Show all</button>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(b => {
              const sc = STATUS_STYLE[b.status] || { bg: '#F3F4F6', color: '#6B6B6B' }
              return (
                <div key={b.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 20px', border: '1px solid #E8E4DA', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <p style={{ fontWeight: 700, color: '#097434', margin: 0, fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{b.courses?.title || 'Lesson'}</p>
                      {b.is_trial && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: '#F0E4B8', color: '#B8952A' }}>Trial</span>}
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: sc.bg, color: sc.color, textTransform: 'capitalize' }}>{b.status}</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#6B7A6B', margin: 0 }}>
                      👤 {b.student?.first_name} {b.student?.last_name} → 🎓 {b.teacher?.first_name} {b.teacher?.last_name}
                    </p>
                    <p style={{ fontSize: 12, color: '#9A9A8A', margin: '3px 0 0' }}>📅 {fmtDate(b.scheduled_at)}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontWeight: 800, color: '#097434', fontSize: 16, margin: 0 }}>${b.price_usd}</p>
                    <p style={{ fontSize: 11, color: '#9A9A8A', margin: '3px 0 0' }}>{fmtDate(b.created_at).split(',')[0]}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }`}</style>
    </AdminLayout>
  )
}
