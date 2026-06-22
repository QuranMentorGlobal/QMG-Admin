// qmg-admin: src/app/attendance/page.tsx
// ────────────────────────────────────────────────────────────────────────────
// Admin Attendance Center (Phase 5). Platform-wide attendance health from the
// unified lesson_attendance table via /api/attendance-analytics: overall rate,
// monthly trend, by-teacher, by-course, most-absent and most-reliable students.
// ────────────────────────────────────────────────────────────────────────────
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { CheckCircle2, Clock, XCircle, ShieldCheck, TrendingUp } from 'lucide-react'

const GOLD = '#B8952A', INK = '#1A1A1A', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F7F1E2'
const C = { present: '#16A34A', late: '#EA580C', absent: '#DC2626', excused: '#2563EB' }
const rateColor = (r: number) => r >= 80 ? '#16A34A' : r >= 60 ? GOLD : '#DC2626'

type Row = { id?: string; name?: string; title?: string; present: number; late: number; absent: number; excused: number; total: number; rate: number }
type Data = {
  overall: { present: number; late: number; absent: number; excused: number; total: number; rate: number }
  byTeacher: Row[]; byCourse: Row[]
  monthly: { month: string; rate: number; present: number; late: number; absent: number }[]
  mostAbsent: Row[]; mostReliable: Row[]
}

export default function AdminAttendance() {
  const [adminName, setAdminName] = useState('Admin')
  const [d, setD] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => { try { const sb = createClient(); const { data: { user } } = await sb.auth.getUser(); if (user) { const { data: p } = await sb.from('profiles').select('first_name').eq('id', user.id).single(); setAdminName((p as any)?.first_name || 'Admin') } } catch {} })()
    fetch('/api/attendance-analytics').then(r => r.ok ? r.json() : null).then(setD).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const o = d?.overall
  const kpis = [
    { label: 'Overall Rate', value: o ? `${o.rate}%` : '—', color: o ? rateColor(o.rate) : MUTED, icon: ShieldCheck },
    { label: 'Present', value: o?.present ?? 0, color: C.present, icon: CheckCircle2 },
    { label: 'Late', value: o?.late ?? 0, color: C.late, icon: Clock },
    { label: 'Absent', value: o?.absent ?? 0, color: C.absent, icon: XCircle },
    { label: 'Excused', value: o?.excused ?? 0, color: C.excused, icon: CheckCircle2 },
  ]

  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18 }

  return (
    <AdminLayout adminName={adminName}>
      <div style={{ maxWidth: 1100 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 800, color: INK, margin: 0 }}>
          <TrendingUp size={24} color={GOLD} /> Attendance Center
        </h1>
        <p style={{ color: MUTED, fontSize: 14, margin: '6px 0 22px' }}>Platform-wide attendance health across all teachers, students and courses.</p>

        {loading ? (
          <p style={{ color: MUTED }}>Loading…</p>
        ) : !d || (o && o.total === 0) ? (
          <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
            <p style={{ color: INK, fontWeight: 700, margin: 0 }}>No attendance data yet</p>
            <p style={{ color: MUTED, fontSize: 13, margin: '6px 0 0' }}>Once teachers start marking lessons, analytics will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
              {kpis.map(k => (
                <div key={k.label} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <k.icon size={16} color={k.color} />
                    <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{k.label}</span>
                  </div>
                  <p style={{ fontSize: 28, fontWeight: 800, color: k.color, margin: '8px 0 0' }}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Monthly trend */}
            <div style={card}>
              <p style={{ fontWeight: 700, color: INK, margin: '0 0 12px' }}>Monthly Attendance Trend</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={d.monthly} margin={{ top: 6, right: 10, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(184,149,42,0.12)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: MUTED }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: MUTED }} />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Line type="monotone" dataKey="rate" stroke={GOLD} strokeWidth={3} dot={{ r: 4, fill: GOLD }} name="Attendance %" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* By teacher */}
            <div style={card}>
              <p style={{ fontWeight: 700, color: INK, margin: '0 0 12px' }}>Attendance by Teacher</p>
              <ResponsiveContainer width="100%" height={Math.max(220, d.byTeacher.length * 34)}>
                <BarChart layout="vertical" data={d.byTeacher} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(184,149,42,0.12)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: MUTED }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: INK }} />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Bar dataKey="rate" fill={GOLD} radius={[0, 6, 6, 0]} name="Attendance %" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* By course */}
            <div style={card}>
              <p style={{ fontWeight: 700, color: INK, margin: '0 0 12px' }}>Attendance by Course</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {d.byCourse.map(c => (
                  <div key={c.title}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: INK, fontWeight: 600 }}>{c.title}</span>
                      <span style={{ color: rateColor(c.rate), fontWeight: 700 }}>{c.rate}% <span style={{ color: MUTED, fontWeight: 400 }}>· {c.total} lessons</span></span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'rgba(184,149,42,0.1)', overflow: 'hidden' }}>
                      <div style={{ width: `${c.rate}%`, height: '100%', background: rateColor(c.rate), borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Most absent / most reliable */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18 }}>
              <div style={card}>
                <p style={{ fontWeight: 700, color: INK, margin: '0 0 12px' }}>Most Absent Students</p>
                {d.mostAbsent.length === 0 ? <p style={{ color: MUTED, fontSize: 13 }}>None — great consistency!</p> : d.mostAbsent.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 13, color: INK }}>{s.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.absent }}>{s.absent} absent · {s.rate}%</span>
                  </div>
                ))}
              </div>
              <div style={card}>
                <p style={{ fontWeight: 700, color: INK, margin: '0 0 12px' }}>Most Reliable Students</p>
                {d.mostReliable.length === 0 ? <p style={{ color: MUTED, fontSize: 13 }}>Not enough data yet.</p> : d.mostReliable.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 13, color: INK }}>{s.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.present }}>{s.rate}% · {s.present} present</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
