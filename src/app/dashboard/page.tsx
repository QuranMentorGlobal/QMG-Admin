// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/dashboard/page.tsx
// Executive Dashboard (Phase 2) — KPI overview + revenue/booking/growth charts,
// date-range filter, skeleton loaders, CSV export. Reads /api/analytics (real data).
// ============================================================
'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Download, Users, GraduationCap, Clock, MessageSquare } from 'lucide-react'

const GOLD = '#B8952A', GOLD_L = '#D4AF50', INK = '#1A1A1A', INK_MID = '#3D3D3D'
const GRID = '#EDE6D6', BORDER = '#E8E4DA', MUTED = '#9A9A8A', RED = '#DC2626'

const RANGES = [
  { key: '7',   label: '7 Days'  },
  { key: '30',  label: '30 Days' },
  { key: '90',  label: '90 Days' },
  { key: '365', label: '1 Year'  },
  { key: 'all', label: 'All Time' },
]

type KPI = { value: number; growth?: number; suffix?: string; note?: string }

function fmtMoney(n: number) {
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'k'
  return '$' + Math.round(n).toLocaleString()
}
function fmtNum(n: number) { return Math.round(n).toLocaleString() }
function fmtShortDate(d: string) { const x = new Date(d); return `${x.getDate()}/${x.getMonth() + 1}` }

// Aggregate daily rows into week/month buckets for the revenue granularity toggle
function aggregate(rows: any[], gran: 'day' | 'week' | 'month', keys: string[]) {
  if (gran === 'day') return rows
  const out: Record<string, any> = {}
  for (const r of rows) {
    const dt = new Date(r.d)
    let k: string
    if (gran === 'month') k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    else { const onejan = new Date(dt.getFullYear(), 0, 1); const wk = Math.ceil((((dt as any) - (onejan as any)) / 86400000 + onejan.getDay() + 1) / 7); k = `${dt.getFullYear()}-W${wk}` }
    if (!out[k]) { out[k] = { d: k }; keys.forEach(kk => out[k][kk] = 0) }
    keys.forEach(kk => out[k][kk] += Number(r[kk]) || 0)
  }
  return Object.values(out)
}

function GrowthChip({ g }: { g?: number }) {
  if (g === undefined || g === null) return null
  const up = g >= 0
  const color = g === 0 ? MUTED : up ? GOLD : RED
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color }}>
      <Icon size={12} />{up ? '+' : ''}{g}%
    </span>
  )
}

function KpiCard({ label, kpi, fmt, accent }: { label: string; kpi?: KPI; fmt: (n: number) => string; accent?: boolean }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '16px 18px', border: `1px solid ${BORDER}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 92,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p style={{ fontSize: 11.5, color: MUTED, margin: 0, fontWeight: 600, letterSpacing: '0.01em' }}>{label}</p>
        <GrowthChip g={kpi?.growth} />
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color: accent ? GOLD : INK, margin: 0, lineHeight: 1, fontFamily: "'Fraunces',serif" }}>
        {kpi ? fmt(kpi.value) + (kpi.suffix || '') : '—'}
      </p>
      {kpi?.note && <p style={{ fontSize: 9.5, color: MUTED, margin: 0 }}>{kpi.note}</p>}
    </div>
  )
}

function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: INK, margin: 0, fontFamily: "'Fraunces',serif" }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [range, setRange] = useState('30')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [gran, setGran] = useState<'day' | 'week' | 'month'>('day')

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: p } = await supabase.from('profiles').select('first_name').eq('id', user.id).single()
          setAdminName((p as any)?.first_name || 'Admin')
        }
      } catch {}
    })()
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics?range=${range}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range])

  const k = data?.kpis || {}
  const revenueSeries = useMemo(
    () => aggregate(data?.series?.revenue || [], gran, ['gross', 'commission']),
    [data, gran]
  )

  function exportCSV() {
    if (!data) return
    const lines: string[] = ['Metric,Value,Growth %']
    const labels: Record<string, string> = {
      totalRevenue: 'Total Revenue (GTV)', commission: 'Platform Commission', mrr: 'MRR (proxy)',
      activeStudents: 'Active Students', activeTeachers: 'Active Teachers', newToday: 'New Today',
      trialRequests: 'Trial Requests', paidEnrollments: 'Paid Enrollments', conversionRate: 'Conversion Rate',
      arpu: 'ARPU', arpt: 'ARPT', studentRetention: 'Student Retention', teacherRetention: 'Teacher Retention',
      newRegistrations: 'New Registrations',
    }
    Object.entries(labels).forEach(([key, lab]) => {
      const v = (data.kpis as any)[key]; if (v) lines.push(`"${lab}",${v.value}${v.suffix || ''},${v.growth ?? ''}`)
    })
    lines.push('', 'Date,Gross Revenue,Commission')
    ;(data.series?.revenue || []).forEach((r: any) => lines.push(`${r.d},${r.gross},${r.commission}`))
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `qmg-analytics-${range}-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  const kpiCards: { label: string; key: string; fmt: (n: number) => string; accent?: boolean }[] = [
    { label: 'Total Revenue (GTV)', key: 'totalRevenue', fmt: fmtMoney, accent: true },
    { label: 'Platform Commission', key: 'commission', fmt: fmtMoney, accent: true },
    { label: 'MRR', key: 'mrr', fmt: fmtMoney },
    { label: 'Conversion Rate', key: 'conversionRate', fmt: fmtNum },
    { label: 'Active Students', key: 'activeStudents', fmt: fmtNum },
    { label: 'Active Teachers', key: 'activeTeachers', fmt: fmtNum },
    { label: 'New Today', key: 'newToday', fmt: fmtNum },
    { label: 'New Registrations', key: 'newRegistrations', fmt: fmtNum },
    { label: 'Trial Requests', key: 'trialRequests', fmt: fmtNum },
    { label: 'Paid Enrollments', key: 'paidEnrollments', fmt: fmtNum },
    { label: 'ARPU', key: 'arpu', fmt: fmtMoney },
    { label: 'Avg Revenue / Teacher', key: 'arpt', fmt: fmtMoney },
    { label: 'Student Retention', key: 'studentRetention', fmt: fmtNum },
    { label: 'Teacher Retention', key: 'teacherRetention', fmt: fmtNum },
  ]

  const splitData = data ? [
    { name: 'Platform Commission', value: data.split?.commission || 0 },
    { name: 'Teacher Payout', value: data.split?.teacherPayout || 0 },
  ] : []

  const ops = [
    { label: 'Pending Verifications', value: data?.totals?.pendingTeachers ?? 0, href: '/teachers/pending', icon: Clock },
    { label: 'Open Support Tickets', value: data?.totals?.openTickets ?? 0, href: '/support', icon: MessageSquare },
    { label: 'Total Students', value: data?.totals?.totalStudents ?? 0, href: '/students', icon: Users },
    { label: 'Total Teachers', value: data?.totals?.totalTeachers ?? 0, href: '/teachers', icon: GraduationCap },
  ]

  return (
    <AdminLayout adminName={adminName}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 26, fontWeight: 800, color: INK, margin: 0 }}>
            Welcome back, {adminName} 👋
          </h1>
          <p style={{ fontSize: 13, color: '#6B6B6B', margin: '6px 0 0' }}>Executive overview of QuranMentorGlobal.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 3 }}>
            {RANGES.map(r => (
              <button key={r.key} onClick={() => setRange(r.key)}
                style={{
                  border: 'none', cursor: 'pointer', padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                  fontFamily: "'Inter',sans-serif",
                  background: range === r.key ? INK : 'transparent', color: range === r.key ? '#fff' : '#6B6B6B',
                  transition: 'all .15s',
                }}>{r.label}</button>
            ))}
          </div>
          <button onClick={exportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 11, border: 'none', cursor: 'pointer', background: GOLD, color: '#1A1400', fontSize: 12.5, fontWeight: 700, fontFamily: "'Inter',sans-serif" }}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="qmg-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {loading
          ? [...Array(14)].map((_, i) => <div key={i} style={{ background: '#fff', borderRadius: 16, height: 92, border: `1px solid ${BORDER}`, animation: 'pulse 1.5s infinite' }} />)
          : kpiCards.map(c => <KpiCard key={c.key} label={c.label} kpi={k[c.key]} fmt={c.fmt} accent={c.accent} />)
        }
      </div>

      {/* Revenue trend */}
      <div style={{ marginBottom: 18 }}>
        <Panel title="Revenue Trend"
          right={
            <div style={{ display: 'flex', gap: 4 }}>
              {(['day', 'week', 'month'] as const).map(g => (
                <button key={g} onClick={() => setGran(g)} style={{
                  border: 'none', cursor: 'pointer', padding: '5px 11px', borderRadius: 8, fontSize: 11.5, fontWeight: 700,
                  textTransform: 'capitalize', fontFamily: "'Inter',sans-serif",
                  background: gran === g ? '#F7F1E2' : 'transparent', color: gran === g ? GOLD : MUTED,
                }}>{g === 'day' ? 'Daily' : g === 'week' ? 'Weekly' : 'Monthly'}</button>
              ))}
            </div>
          }>
          {loading ? <Skel h={280} /> : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueSeries} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} /><stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gCom" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={INK} stopOpacity={0.22} /><stop offset="100%" stopColor={INK} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: MUTED }} tickFormatter={gran === 'day' ? fmtShortDate : undefined} minTickGap={24} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => '$' + (v >= 1000 ? (v / 1000) + 'k' : v)} />
                <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }} formatter={(v: any) => fmtMoney(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="gross" name="Gross Revenue" stroke={GOLD} strokeWidth={2.5} fill="url(#gGross)" />
                <Area type="monotone" dataKey="commission" name="Commission" stroke={INK} strokeWidth={2} fill="url(#gCom)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Two-up: revenue split + bookings */}
      <div className="qmg-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 18, marginBottom: 18 }}>
        <Panel title="Revenue Split">
          {loading ? <Skel h={250} /> : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={splitData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
                  <Cell fill={GOLD} /><Cell fill={INK_MID} />
                </Pie>
                <Tooltip formatter={(v: any) => fmtMoney(Number(v))} contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel title="Bookings (Trial vs Paid)">
          {loading ? <Skel h={250} /> : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data?.series?.bookings || []} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: MUTED }} tickFormatter={fmtShortDate} minTickGap={24} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="trial" name="Trial" stackId="a" fill={GOLD_L} radius={[0, 0, 0, 0]} />
                <Bar dataKey="paid" name="Paid" stackId="a" fill={GOLD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Signups growth */}
      <div style={{ marginBottom: 18 }}>
        <Panel title="New Registrations (Students vs Teachers)">
          {loading ? <Skel h={240} /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data?.series?.signups || []} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: MUTED }} tickFormatter={fmtShortDate} minTickGap={24} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="students" name="Students" stroke={GOLD} strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="teachers" name="Teachers" stroke={INK} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Operations center */}
      <div className="qmg-ops" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 8 }}>
        {ops.map(({ label, value, href, icon: Icon }) => (
          <a key={href} href={href} style={{
            display: 'flex', alignItems: 'center', gap: 13, padding: '16px 18px', borderRadius: 14, textDecoration: 'none',
            background: '#fff', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'all .15s',
          }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: '#F7F1E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={19} style={{ color: GOLD }} />
            </div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, color: INK, margin: 0, lineHeight: 1, fontFamily: "'Fraunces',serif" }}>{fmtNum(value)}</p>
              <p style={{ fontSize: 11.5, color: MUTED, margin: '4px 0 0', fontWeight: 600 }}>{label}</p>
            </div>
          </a>
        ))}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .qmg-skel{background:linear-gradient(90deg,#F1ECE2 25%,#E8E2D6 50%,#F1ECE2 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:10px}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @media(max-width:1100px){ .qmg-kpi-grid{grid-template-columns:repeat(3,1fr)!important} .qmg-two{grid-template-columns:1fr!important} .qmg-ops{grid-template-columns:repeat(2,1fr)!important} }
        @media(max-width:640px){ .qmg-kpi-grid{grid-template-columns:repeat(2,1fr)!important} }
        @media(max-width:380px){ .qmg-kpi-grid{grid-template-columns:1fr!important} .qmg-ops{grid-template-columns:1fr!important} }
      `}</style>
    </AdminLayout>
  )
}

function Skel({ h }: { h: number }) {
  return <div className="qmg-skel" style={{ width: '100%', height: h }} />
}
