// qmg-admin: src/app/attendance/page.tsx
// ────────────────────────────────────────────────────────────────────────────
// Admin Attendance Center (Phase 5). Platform-wide attendance health from the
// unified lesson_attendance table via /api/attendance-analytics: overall rate,
// monthly trend, by-teacher, by-course, most-absent and most-reliable students.
// ────────────────────────────────────────────────────────────────────────────
'use client'

import { useEffect, useState } from 'react'
import PageHead from '@/components/PageHead'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import RangeTabs from '@/components/RangeTabs'
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { CheckCircle2, Clock, XCircle, ShieldCheck, TrendingUp } from 'lucide-react'

const GOLD = '#C9A227', INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F8F5EE'
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
  const [range, setRange] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    (async () => { try { const sb = createClient(); const { data: { user } } = await sb.auth.getUser(); if (user) { const { data: p } = await sb.from('profiles').select('first_name').eq('id', user.id).single(); setAdminName((p as any)?.first_name || 'Admin') } } catch {} })()
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/attendance-analytics?range=${range}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`).then(r => r.ok ? r.json() : null).then(setD).catch(() => {}).finally(() => setLoading(false))
  }, [range, from, to])

  const o = d?.overall
  const kpis = [
    { label: 'Overall Rate', value: o ? `${o.rate}%` : '—', color: o ? rateColor(o.rate) : MUTED, icon: ShieldCheck },
    { label: 'Present', value: o?.present ?? 0, color: C.present, icon: CheckCircle2 },
    { label: 'Late', value: o?.late ?? 0, color: C.late, icon: Clock },
    { label: 'Absent', value: o?.absent ?? 0, color: C.absent, icon: XCircle },
    { label: 'Excused', value: o?.excused ?? 0, color: C.excused, icon: CheckCircle2 },
  ]

  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18 }

  const health = !o ? null
    : o.rate >= 80 ? { label: 'Healthy', color: '#16A34A', desc: 'Platform attendance is strong across teachers and courses.' }
    : o.rate >= 60 ? { label: 'Watch', color: GOLD, desc: 'Attendance is moderate — keep an eye on at-risk students and low-rate courses.' }
    : { label: 'Needs Attention', color: '#DC2626', desc: 'Platform attendance is low — consider teacher check-ins and student outreach.' }
  const trend = (() => {
    const m = d?.monthly || []
    if (m.length < 2) return null
    const last = m[m.length - 1].rate, prev = m[m.length - 2].rate
    return last > prev + 3 ? { arrow: '↑', label: 'up vs last month', color: '#16A34A' } : last < prev - 3 ? { arrow: '↓', label: 'down vs last month', color: '#DC2626' } : { arrow: '→', label: 'steady vs last month', color: GOLD }
  })()

  return (
    <AdminLayout adminName={adminName}>
      <div style={{ width: '100%' }}>
        <PageHead
          title="Attendance Center"
          subtitle="Platform-wide attendance health across all teachers, students and courses."
          range={{ value: range, onChange: setRange, from, to, onFrom: setFrom, onTo: setTo }}
        />

        {loading ? (
          <p style={{ color: MUTED }}>Loading…</p>
        ) : !d || (o && o.total === 0) ? (
          <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
            <p style={{ color: INK, fontWeight: 700, margin: 0 }}>No attendance data yet</p>
            <p style={{ color: MUTED, fontSize: 13, margin: '6px 0 0' }}>Once teachers start marking lessons, analytics will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Platform health */}
            {health && (
              <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderLeft: `4px solid ${health.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>Platform Attendance Health</span>
                  <span style={{ background: health.color, color: '#fff', fontSize: 13, fontWeight: 800, padding: '5px 14px', borderRadius: 999 }}>{health.label} · {o!.rate}%</span>
                  {trend && <span style={{ color: trend.color, fontSize: 13, fontWeight: 700 }}>{trend.arrow} {trend.label}</span>}
                </div>
                <span style={{ color: MUTED, fontSize: 13, flex: 1, minWidth: 200 }}>{health.desc}</span>
              </div>
            )}

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
              {kpis.map(k => (
                <div key={k.label} style={{ ...card, textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,162,39,0.12)" />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,162,39,0.12)" horizontal={false} />
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
                    <div style={{ height: 8, borderRadius: 4, background: 'rgba(201,162,39,0.1)', overflow: 'hidden' }}>
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
