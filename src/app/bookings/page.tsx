// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/bookings/page.tsx
// Bookings — analytics summary, advanced filters (status / type / search),
// LIST + CALENDAR views, status badges, quick access to student & teacher
// detail pages. Reads bookings with student/teacher joins (real data).
// ============================================================
'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { format } from 'date-fns'
import {
  CalendarDays, List, Search, ChevronLeft, ChevronRight, BookOpen,
  CheckCircle2, Clock, XCircle, DollarSign, ArrowUpRight, User, GraduationCap,
} from 'lucide-react'

const GOLD = '#C9A227', INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F8F5EE', GREEN = '#16A34A', RED = '#DC2626'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#FEF3C7', color: '#D97706' },
  confirmed: { bg: '#F8F5EE', color: '#C9A227' },
  completed: { bg: 'rgba(22,163,74,0.1)', color: GREEN },
  cancelled: { bg: '#FEE2E2', color: RED },
}
const STATUSES = ['pending', 'confirmed', 'completed']
const TYPES = [{ k: 'all', l: 'All types' }, { k: 'trial', l: 'Trial' }, { k: 'paid', l: 'Paid' }]
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type Booking = {
  id: string; status: string; price_usd: number; is_trial: boolean
  start_date: string; session_time: string; recurrence: string; created_at: string
  student_id: string; teacher_id: string
  courses: { title: string }
  student: { first_name: string; last_name: string; email: string }
  teacher: { first_name: string; last_name: string }
}

const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function keyOf(b: Booking): string | null { if (!b.start_date) return null; const d = new Date(b.start_date); return isNaN(d.getTime()) ? null : toYMD(d) }
function money(n: number) { return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <div className="adminx-stat" style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={14} style={{ color: GOLD }} /></div>
        <p style={{ fontSize: 11, color: MUTED, margin: 0, fontWeight: 600 }}>{label}</p>
      </div>
      <p style={{ fontSize: 21, fontWeight: 800, color: accent ? GOLD : INK, margin: 0, lineHeight: 1, fontFamily: "'Fraunces',serif" }}>{value}</p>
    </div>
  )
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => { fetchBookings() }, [])

  async function fetchBookings() {
    const supabase = createClient()
    const { data } = await supabase
      .from('bookings')
      .select(`*, courses(title),
        student:profiles!bookings_student_id_fkey(first_name, last_name, email),
        teacher:profiles!bookings_teacher_id_fkey(first_name, last_name)`)
      .order('created_at', { ascending: false }) as any
    setBookings(data || [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return bookings.filter(b => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false
      if (typeFilter === 'trial' && !b.is_trial) return false
      if (typeFilter === 'paid' && b.is_trial) return false
      if (q) {
        const hay = `${b.courses?.title} ${b.student?.first_name} ${b.student?.last_name} ${b.student?.email} ${b.teacher?.first_name} ${b.teacher?.last_name}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [bookings, statusFilter, typeFilter, search])

  const stats = useMemo(() => {
    let completed = 0, upcoming = 0, cancelled = 0, trial = 0, paid = 0, revenue = 0
    bookings.forEach(b => {
      if (b.status === 'completed') { completed++; revenue += Number(b.price_usd) || 0 }
      else if (b.status === 'pending' || b.status === 'confirmed') upcoming++
      else if (b.status === 'cancelled') cancelled++
      if (b.is_trial) trial++; else paid++
    })
    return { total: bookings.length, completed, upcoming, cancelled, trial, paid, revenue }
  }, [bookings])

  const byDay = useMemo(() => {
    const m: Record<string, Booking[]> = {}
    filtered.forEach(b => { const k = keyOf(b); if (k) (m[k] = m[k] || []).push(b) })
    return m
  }, [filtered])

  // Calendar grid
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const leading = monthStart.getDay()
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const todayKey = toYMD(new Date())
  const cells: (number | null)[] = [...Array(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const dayBookings = selectedDay ? (byDay[selectedDay] || []) : []

  return (
    <AdminLayout>
      <div className="w-full">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 800, color: INK, margin: 0 }}>Bookings</h1>
            <p style={{ fontSize: 13, color: '#6B6B6B', margin: '5px 0 0' }}>{stats.total} bookings across the platform</p>
          </div>
          <div style={{ display: 'flex', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 3 }}>
            {([['list', List], ['calendar', CalendarDays]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', padding: '7px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, textTransform: 'capitalize', fontFamily: "'Inter',sans-serif", background: view === v ? INK : 'transparent', color: view === v ? '#fff' : '#6B6B6B' }}>
                <Icon size={14} /> {v}
              </button>
            ))}
          </div>
        </div>

        {/* Analytics */}
        <div className="qmg-bstats" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10, marginBottom: 18 }}>
          <Stat icon={BookOpen} label="Total" value={String(stats.total)} />
          <Stat icon={CheckCircle2} label="Completed" value={String(stats.completed)} />
          <Stat icon={Clock} label="Upcoming" value={String(stats.upcoming)} />
          <Stat icon={XCircle} label="Cancelled" value={String(stats.cancelled)} />
          <Stat icon={BookOpen} label="Trial / Paid" value={`${stats.trial}/${stats.paid}`} />
          <Stat icon={DollarSign} label="Revenue" value={money(stats.revenue)} accent />
        </div>

        {/* Filters */}
        <div className="qmg-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUSES.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '7px 13px', borderRadius: 10, fontSize: 12, fontWeight: 700, textTransform: 'capitalize', cursor: 'pointer', border: statusFilter === s ? 'none' : `1px solid ${BORDER}`, background: statusFilter === s ? 'linear-gradient(135deg,#166534,#C9A227)' : '#fff', color: statusFilter === s ? '#111111' : '#6B6B6B' }}>{s}</button>
            ))}
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 12.5, color: INK, background: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            {TYPES.map(t => <option key={t.k} value={t.k}>{t.l}</option>)}
          </select>
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: 10, color: MUTED }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search course, student, teacher…" style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 13, background: '#fff', color: INK }} />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[...Array(4)].map((_, i) => <div key={i} className="qmg-skel" style={{ height: 78 }} />)}</div>
        ) : view === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(b => <BookingRow key={b.id} b={b} />)}
            {filtered.length === 0 && <Empty />}
          </div>
        ) : (
          <>
            {/* Calendar */}
            <div className="adminx-rise" style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, padding: 18, marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: INK, margin: 0, fontFamily: "'Fraunces',serif" }}>{format(monthStart, 'MMMM yyyy')}</h2>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} style={navBtn}><ChevronLeft size={16} /></button>
                  <button onClick={() => { setCursor(new Date()); setSelectedDay(todayKey) }} style={{ ...navBtn, width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 700 }}>Today</button>
                  <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} style={navBtn}><ChevronRight size={16} /></button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
                {WD.map(w => <div key={w} style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textAlign: 'center', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{w}</div>)}
                {cells.map((day, i) => {
                  if (day === null) return <div key={`b${i}`} />
                  const key = toYMD(new Date(cursor.getFullYear(), cursor.getMonth(), day))
                  const items = byDay[key] || []
                  const isToday = key === todayKey, isSel = key === selectedDay
                  return (
                    <button key={key} onClick={() => setSelectedDay(isSel ? null : key)} style={{
                      minHeight: 78, textAlign: 'left', padding: 7, borderRadius: 10, cursor: 'pointer',
                      border: isSel ? `2px solid ${GOLD}` : `1px solid ${BORDER}`,
                      background: isToday ? CREAM : '#fff', display: 'flex', flexDirection: 'column', gap: 3,
                    }}>
                      <span style={{ fontSize: 11.5, fontWeight: isToday ? 800 : 600, color: isToday ? GOLD : INK }}>{day}</span>
                      {items.slice(0, 2).map(b => { const sc = STATUS_COLORS[b.status] || { bg: '#F3F4F6', color: MUTED }; return (
                        <span key={b.id} style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: sc.bg, color: sc.color, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{b.courses?.title || 'Booking'}</span>
                      )})}
                      {items.length > 2 && <span style={{ fontSize: 9, color: MUTED, fontWeight: 600 }}>+{items.length - 2} more</span>}
                    </button>
                  )
                })}
              </div>
            </div>
            {selectedDay && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: INK, margin: 0 }}>{dayBookings.length} booking{dayBookings.length === 1 ? '' : 's'} on {format(new Date(selectedDay), 'dd MMM yyyy')}</p>
                {dayBookings.map(b => <BookingRow key={b.id} b={b} />)}
                {dayBookings.length === 0 && <p style={{ fontSize: 12.5, color: MUTED }}>No bookings this day.</p>}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .qmg-skel{background:linear-gradient(90deg,#F1ECE2 25%,#E8E2D6 50%,#F1ECE2 75%);background-size:200% 100%;animation:qmgsh 1.4s infinite;border-radius:14px}
        @keyframes qmgsh{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @media(max-width:1000px){ .qmg-bstats{grid-template-columns:repeat(3, minmax(0, 1fr))!important} }
        @media(max-width:520px){ .qmg-bstats{grid-template-columns:repeat(2, minmax(0, 1fr))!important} }
      `}</style>
    </AdminLayout>
  )
}

const navBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 9, border: `1px solid ${BORDER}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: INK }

function BookingRow({ b }: { b: Booking }) {
  const sc = STATUS_COLORS[b.status] || { bg: '#F3F4F6', color: MUTED }
  return (
    <div className="adminx-row" style={{ background: '#fff', borderRadius: 14, padding: 16, border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: INK, margin: 0 }}>{b.courses?.title || 'Course'}</p>
          {b.is_trial && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#F0E4B8', color: GOLD }}>Trial</span>}
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize', background: sc.bg, color: sc.color }}>{b.status}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: MUTED }}>
          <a href={`/students/${b.student_id}`} className="qmg-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#555', textDecoration: 'none', fontWeight: 600 }}>
            <User size={12} /> {b.student?.first_name} {b.student?.last_name} <ArrowUpRight size={11} style={{ color: MUTED }} />
          </a>
          <span>→</span>
          <a href={`/teachers/${b.teacher_id}`} className="qmg-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#555', textDecoration: 'none', fontWeight: 600 }}>
            <GraduationCap size={12} /> {b.teacher?.first_name} {b.teacher?.last_name} <ArrowUpRight size={11} style={{ color: MUTED }} />
          </a>
        </div>
        <p style={{ fontSize: 11.5, color: MUTED, margin: '5px 0 0' }}>📅 {b.start_date || '—'}{b.session_time ? ` at ${b.session_time}` : ''}{b.recurrence ? ` · ${b.recurrence}` : ''}</p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: INK, margin: 0, fontFamily: "'Fraunces',serif" }}>${b.price_usd ?? 0}</p>
        <p style={{ fontSize: 11, color: MUTED, margin: '3px 0 0' }}>{b.created_at ? format(new Date(b.created_at), 'dd MMM yyyy') : '—'}</p>
      </div>
    </div>
  )
}

function Empty() {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', border: `1px solid ${BORDER}` }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: CREAM, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><CalendarDays size={20} style={{ color: GOLD }} /></div>
      <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>No bookings match these filters.</p>
    </div>
  )
}
