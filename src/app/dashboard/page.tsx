// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/dashboard/page.tsx
// Executive Command Center — ADAPTIVE (widgets gate by permission) + PREMIUM
// (animated counters, hover-glow KPI cards, staggered fade-in, top teachers/
// courses, attention center, recent activity feed, quick actions). Preserves
// the range filter, all charts, skeleton loaders, and CSV export.
// Reads /api/analytics, /api/analytics/deep, /api/audit-log (real data).
// ============================================================
'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Download, Users, GraduationCap, Clock, MessageSquare,
  AlertTriangle, CreditCard, Award, BookOpen, Activity, ArrowUpRight, ShieldCheck, Zap, RotateCcw,
  Target, Video, Library,
} from 'lucide-react'

const GOLD = '#C9A227', GOLD_L = '#E3C04A', INK = '#111111', INK_MID = '#3D3D3D'
const GRID = '#EDE6D6', BORDER = '#E8E4DA', MUTED = '#9A9A8A', RED = '#DC2626', CREAM = '#F8F5EE'

const RANGES = [
  { key: '7', label: '7 Days' }, { key: '30', label: '30 Days' }, { key: '90', label: '90 Days' },
  { key: '365', label: '1 Year' }, { key: 'all', label: 'All Time' },
]

// Dashboard KPI cards grouped into labelled categories (4 per category).
// Pure presentation — same cards, same data, just arranged like the Courses block.
const KPI_CATEGORIES: { label: string; icon: any; keys: string[] }[] = [
  { label: 'Revenue & Growth',   icon: CreditCard, keys: ['totalRevenue', 'commission', 'mrr', 'conversionRate'] },
  { label: 'People',             icon: Users,      keys: ['activeStudents', 'activeTeachers', 'newToday', 'newRegistrations'] },
  { label: 'Sales & Value',      icon: Activity,   keys: ['trialRequests', 'paidEnrollments', 'arpu', 'arpt'] },
  { label: 'Retention & Refunds', icon: RotateCcw, keys: ['studentRetention', 'teacherRetention', 'totalRefunded', 'refundCount'] },
  { label: 'Payouts & Liabilities', icon: CreditCard, keys: ['pendingPayouts', 'approvedPayouts', 'completedPayouts', 'totalPaidOut', 'teacherLiability'] },
]

// Per-card icon for each KPI (so every dashboard card has an icon like the Courses cards).
const KPI_ICONS: Record<string, any> = {
  totalRevenue: CreditCard, commission: TrendingUp, mrr: Activity, conversionRate: Target,
  activeStudents: Users, activeTeachers: GraduationCap, newToday: Clock, newRegistrations: ArrowUpRight,
  trialRequests: Target, paidEnrollments: BookOpen, arpu: CreditCard, arpt: Award,
  studentRetention: Users, teacherRetention: GraduationCap, totalRefunded: RotateCcw, refundCount: RotateCcw,
  pendingPayouts: Clock, approvedPayouts: ShieldCheck, completedPayouts: TrendingUp, totalPaidOut: CreditCard, teacherLiability: Activity,
}

type KPI = { value: number; growth?: number; suffix?: string; note?: string }

function fmtMoney(n: number) {
  return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtNum(n: number) { return Math.round(n).toLocaleString() }
function fmtShortDate(d: string) { const x = new Date(d); return `${x.getDate()}/${x.getMonth() + 1}` }
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return m + 'm ago'
  const h = Math.floor(m / 60); if (h < 24) return h + 'h ago'
  const d = Math.floor(h / 24); return d + 'd ago'
}
const ACTION_LABEL: Record<string, string> = {
  'teacher.approve': 'approved a teacher', 'teacher.reject': 'rejected a teacher',
  'teacher.suspend': 'suspended a teacher', 'teacher.reinstate': 'reinstated a teacher',
  'student.activate': 'activated a student', 'student.deactivate': 'deactivated a student',
  'review.publish': 'published a review', 'review.unpublish': 'unpublished a review',
  'settings.update': 'updated settings', 'ticket.update': 'updated a support ticket',
  'sub_admin.create': 'created a sub-admin', 'sub_admin.update': 'edited a sub-admin',
  'sub_admin.suspend': 'suspended a sub-admin', 'sub_admin.activate': 'activated a sub-admin',
  'sub_admin.delete': 'deleted a sub-admin',
}
function actionLabel(a: string) {
  if (ACTION_LABEL[a]) return ACTION_LABEL[a]
  if (a.startsWith('verification.')) return 'reviewed verification (' + a.split('.')[1] + ')'
  return a
}

// Daily → week/month buckets for the revenue granularity toggle
function aggregate(rows: any[], gran: 'day' | 'week' | 'month', keys: string[]) {
  if (gran === 'day') return rows
  const out: Record<string, any> = {}
  for (const r of rows) {
    const dt = new Date(r.d); let k: string
    if (gran === 'month') k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    else { const onejan = new Date(dt.getFullYear(), 0, 1); const wk = Math.ceil((((dt as any) - (onejan as any)) / 86400000 + onejan.getDay() + 1) / 7); k = `${dt.getFullYear()}-W${wk}` }
    if (!out[k]) { out[k] = { d: k }; keys.forEach(kk => out[k][kk] = 0) }
    keys.forEach(kk => out[k][kk] += Number(r[kk]) || 0)
  }
  return Object.values(out)
}

// Smooth count-up for premium animated counters
function useCountUp(target: number, dur = 900) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf = 0; const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(target * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, dur])
  return n
}

function GrowthChip({ g }: { g?: number }) {
  if (g === undefined || g === null) return null
  const up = g >= 0, color = g === 0 ? MUTED : up ? GOLD : RED, Icon = up ? TrendingUp : TrendingDown
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color }}>
      <Icon size={12} />{up ? '+' : ''}{g}%
    </span>
  )
}

function KpiCard({ label, kpi, fmt, accent, i, icon: Icon }: { label: string; kpi?: KPI; fmt: (n: number) => string; accent?: boolean; i: number; icon?: any }) {
  const shown = useCountUp(kpi?.value || 0)
  return (
    <div className="adminx-stat adminx-rise" style={{
      background: '#fff', borderRadius: 16, padding: '16px 18px', border: `1px solid ${BORDER}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', gap: 7, minHeight: 92, animationDelay: `${i * 35}ms`,
    }}>
      {Icon && <span style={{ width: 30, height: 30, borderRadius: 9, background: '#F4EFE3', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={15} style={{ color: GOLD }} /></span>}
      <p style={{ fontSize: 11.5, color: MUTED, margin: 0, fontWeight: 600, letterSpacing: '0.01em', lineHeight: 1.3 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 800, color: accent ? GOLD : INK, margin: 0, lineHeight: 1.05, fontFamily: "'Fraunces',serif", wordBreak: 'break-word' }}>
        {kpi ? fmt(shown) + (kpi.suffix || '') : '—'}
      </p>
      <GrowthChip g={kpi?.growth} />
      {kpi?.note && <p style={{ fontSize: 9.5, color: MUTED, margin: 0 }}>{kpi.note}</p>}
    </div>
  )
}

function Panel({ title, children, right, icon: Icon }: { title: string; children: React.ReactNode; right?: React.ReactNode; icon?: any }) {
  return (
    <div className="adminx-rise" style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: INK, margin: 0, fontFamily: "'Fraunces',serif" }}>
          {Icon && <Icon size={16} style={{ color: GOLD }} />}{title}
        </h2>
        {right}
      </div>
      {children}
    </div>
  )
}

function Skel({ h }: { h: number }) { return <div className="qmg-skel" style={{ width: '100%', height: h }} /> }

export default function DashboardPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [ctx, setCtx] = useState<{ adminRole: string | null; perms: string[] } | null>(null)
  const [range, setRange] = useState('30')
  const [data, setData] = useState<any>(null)
  const [deep, setDeep] = useState<any>(null)
  const [refunds, setRefunds] = useState<{ total: number; count: number } | null>(null)
  const [pstats, setPstats] = useState<any>(null)
  const [activity, setActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [gran, setGran] = useState<'day' | 'week' | 'month'>('day')
  const [courseCounts, setCourseCounts] = useState<{ trial: number; recorded: number; live: number; long: number; completed: number; total: number } | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: p } = await supabase.from('profiles').select('first_name, admin_role, admin_permissions').eq('id', user.id).single()
          const prof = (p as any) || {}
          setAdminName(prof.first_name || 'Admin')
          setCtx({ adminRole: prof.admin_role ?? null, perms: Array.isArray(prof.admin_permissions) ? prof.admin_permissions : [] })
        } else setCtx({ adminRole: null, perms: [] })
      } catch { setCtx({ adminRole: null, perms: [] }) }
    })()
  }, [])

  const isSub = ctx?.adminRole === 'sub'
  const can = (perm: string) => !ctx ? true : !isSub || ctx.perms.includes(perm)
  const canAudit = !ctx ? true : !isSub || ['admin.create', 'admin.edit', 'admin.delete'].some(p => ctx.perms.includes(p))

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/analytics?range=${range}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/analytics/deep?range=${range}`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([a, d]) => { setData(a); setDeep(d); setLoading(false) })
  }, [range])

  useEffect(() => {
    fetch('/api/refunds').then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.totals) setRefunds({ total: j.totals.total || 0, count: j.totals.count || 0 }) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/stats').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPstats(d) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!ctx || !canAudit) return
    fetch('/api/audit-log').then(r => r.ok ? r.json() : null).then(d => setActivity((d?.logs || []).slice(0, 6))).catch(() => {})
  }, [ctx, canAudit])

  useEffect(() => {
    if (!ctx) return
    if (isSub && !ctx.perms.includes('courses.view') && !ctx.perms.includes('teachers.view') && !ctx.perms.includes('analytics.dashboard')) return
    fetch('/api/courses-hub?counts=1').then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.counts) setCourseCounts(j.counts) }).catch(() => {})
  }, [ctx, isSub])

  const k: any = { ...(data?.kpis || {}) }
  if (refunds) {
    k.totalRefunded = { value: refunds.total, note: 'Returned to students' }
    k.refundCount   = { value: refunds.count, note: 'Cancellations & declines' }
  }
  if (pstats) {
    k.pendingPayouts   = { value: pstats.requestedPayouts ?? 0, note: 'Awaiting review' }
    k.approvedPayouts  = { value: pstats.approvedPayouts ?? 0,  note: 'Approved · unpaid' }
    k.completedPayouts = { value: pstats.completedPayouts ?? 0, note: 'Paid to teachers' }
    k.totalPaidOut     = { value: pstats.paidOut ?? 0,          note: 'Lifetime' }
    k.teacherLiability = { value: pstats.teacherLiability ?? 0, note: 'Owed to teachers' }
  }
  const revenueSeries = useMemo(() => aggregate(data?.series?.revenue || [], gran, ['gross', 'commission']), [data, gran])

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

  const ALL_KPIS: { label: string; key: string; fmt: (n: number) => string; accent?: boolean; perm: string }[] = [
    { label: 'Total Revenue (GTV)', key: 'totalRevenue', fmt: fmtMoney, accent: true, perm: 'analytics.dashboard' },
    { label: 'Platform Commission', key: 'commission', fmt: fmtMoney, accent: true, perm: 'analytics.dashboard' },
    { label: 'MRR', key: 'mrr', fmt: fmtMoney, perm: 'analytics.dashboard' },
    { label: 'Conversion Rate', key: 'conversionRate', fmt: fmtNum, perm: 'analytics.dashboard' },
    { label: 'Active Students', key: 'activeStudents', fmt: fmtNum, perm: 'students.view' },
    { label: 'Active Teachers', key: 'activeTeachers', fmt: fmtNum, perm: 'teachers.view' },
    { label: 'New Today', key: 'newToday', fmt: fmtNum, perm: 'analytics.dashboard' },
    { label: 'New Registrations', key: 'newRegistrations', fmt: fmtNum, perm: 'analytics.dashboard' },
    { label: 'Trial Requests', key: 'trialRequests', fmt: fmtNum, perm: 'analytics.dashboard' },
    { label: 'Paid Enrollments', key: 'paidEnrollments', fmt: fmtNum, perm: 'analytics.dashboard' },
    { label: 'ARPU', key: 'arpu', fmt: fmtMoney, perm: 'analytics.dashboard' },
    { label: 'Avg Revenue / Teacher', key: 'arpt', fmt: fmtMoney, perm: 'analytics.dashboard' },
    { label: 'Student Retention', key: 'studentRetention', fmt: fmtNum, perm: 'analytics.dashboard' },
    { label: 'Teacher Retention', key: 'teacherRetention', fmt: fmtNum, perm: 'analytics.dashboard' },
    { label: 'Total Refunded', key: 'totalRefunded', fmt: fmtMoney, perm: 'payments.view' },
    { label: 'Refunds Issued', key: 'refundCount', fmt: fmtNum, perm: 'payments.view' },
    { label: 'Pending Payouts', key: 'pendingPayouts', fmt: fmtMoney, perm: 'analytics.dashboard' },
    { label: 'Approved Payouts', key: 'approvedPayouts', fmt: fmtMoney, perm: 'analytics.dashboard' },
    { label: 'Completed Payouts', key: 'completedPayouts', fmt: fmtMoney, perm: 'analytics.dashboard' },
    { label: 'Total Paid Out', key: 'totalPaidOut', fmt: fmtMoney, perm: 'analytics.dashboard' },
    { label: 'Teacher Liabilities', key: 'teacherLiability', fmt: fmtMoney, perm: 'analytics.dashboard' },
  ]
  const kpiCards = ALL_KPIS.filter(c => can(c.perm))
  const showCharts = can('analytics.dashboard')
  const showTopTeachers = can('analytics.dashboard') || can('teachers.view')
  const showTopCourses = can('analytics.dashboard')
  const canExport = can('analytics.export') || !isSub

  const splitData = data ? [
    { name: 'Platform Commission', value: data.split?.commission || 0 },
    { name: 'Teacher Payout', value: data.split?.teacherPayout || 0 },
  ] : []

  const topTeachers: any[] = deep?.topTeachers || []
  const topCourses: any[] = (deep?.courses || []).slice(0, 5)

  const attention = [
    (can('verification.access') || can('teachers.view')) && { label: 'Pending Verifications', value: data?.totals?.pendingTeachers ?? 0, href: '/verification-queue', icon: ShieldCheck, tone: GOLD },
    can('support.view') && { label: 'Open Support Tickets', value: data?.totals?.openTickets ?? 0, href: '/support', icon: MessageSquare, tone: INK },
    can('payments.view') && { label: 'Failed Payments', value: deep?.attention?.failedPayments ?? 0, href: '/payments', icon: AlertTriangle, tone: RED },
  ].filter(Boolean) as any[]

  const quickActions = [
    { label: 'Verification Queue', href: '/verification-queue', perm: 'verification.access', icon: ShieldCheck },
    { label: 'Teachers', href: '/teachers', perm: 'teachers.view', icon: GraduationCap },
    { label: 'Students', href: '/students', perm: 'students.view', icon: Users },
    { label: 'Bookings', href: '/bookings', perm: 'bookings.view', icon: Clock },
    { label: 'Payments', href: '/payments', perm: 'payments.view', icon: CreditCard },
    { label: 'Reviews', href: '/reviews', perm: 'reviews.view', icon: Award },
    { label: 'Support', href: '/support', perm: 'support.view', icon: MessageSquare },
    { label: 'Analytics', href: '/analytics', perm: 'analytics.deep', icon: Activity },
  ].filter(a => can(a.perm))

  const ops = [
    can('verification.access') && { label: 'Pending Verifications', value: data?.totals?.pendingTeachers ?? 0, href: '/verification-queue', icon: Clock },
    can('support.view') && { label: 'Open Support Tickets', value: data?.totals?.openTickets ?? 0, href: '/support', icon: MessageSquare },
    can('students.view') && { label: 'Total Students', value: data?.totals?.totalStudents ?? 0, href: '/students', icon: Users },
    can('teachers.view') && { label: 'Total Teachers', value: data?.totals?.totalTeachers ?? 0, href: '/teachers', icon: GraduationCap },
  ].filter(Boolean) as any[]

  return (
    <AdminLayout adminName={adminName}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 26, fontWeight: 800, color: INK, margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: '#6B6B6B', margin: '6px 0 0' }}>{isSub ? 'Your workspace overview.' : 'Executive overview of Muddarris.'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {showCharts && (
            <div style={{ display: 'flex', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 3 }}>
              {RANGES.map(r => (
                <button key={r.key} onClick={() => setRange(r.key)} style={{
                  border: 'none', cursor: 'pointer', padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, fontFamily: "'Inter',sans-serif",
                  background: range === r.key ? INK : 'transparent', color: range === r.key ? '#fff' : '#6B6B6B', transition: 'all .15s',
                }}>{r.label}</button>
              ))}
            </div>
          )}
          {canExport && (
            <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 11, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#166534,#C9A227)', color: '#fff', fontSize: 12.5, fontWeight: 700, fontFamily: "'Inter',sans-serif" }}>
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* KPI grid — grouped into labelled categories (4 per row) */}
      {loading ? (
        <div className="qmg-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
          {[...Array(8)].map((_, i) => <div key={i} className="qmg-skel" style={{ borderRadius: 16, height: 92 }} />)}
        </div>
      ) : kpiCards.length > 0 && (() => {
        const used = new Set<string>()
        const sections = KPI_CATEGORIES.map(cat => {
          const cards = kpiCards.filter(c => cat.keys.includes(c.key))
          cards.forEach(c => used.add(c.key))
          return { label: cat.label, icon: cat.icon, cards }
        }).filter(s => s.cards.length > 0)
        const leftover = kpiCards.filter(c => !used.has(c.key))
        if (leftover.length) sections.push({ label: 'Other Metrics', icon: Activity, cards: leftover })
        return (
          <div style={{ marginBottom: 4 }}>
            {sections.map(s => (
              <div key={s.label} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <s.icon size={15} style={{ color: GOLD }} />
                  <p style={{ fontSize: 13, fontWeight: 800, color: INK, margin: 0, fontFamily: "'Fraunces',serif" }}>{s.label}</p>
                </div>
                <div className="qmg-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                  {s.cards.map((c, i) => <KpiCard key={c.key} i={i} label={c.label} kpi={k[c.key]} fmt={c.fmt} accent={c.accent} icon={KPI_ICONS[c.key]} />)}
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Courses overview — 4 interlinked cards into the Courses Hub */}
      {courseCounts && (can('courses.view') || can('teachers.view')) && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Library size={15} style={{ color: GOLD }} />
              <p style={{ fontSize: 13, fontWeight: 800, color: INK, margin: 0, fontFamily: "'Fraunces',serif" }}>Courses</p>
            </div>
            <a href="/courses-hub" style={{ fontSize: 12, fontWeight: 700, color: '#166534', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Open Courses Hub <ArrowUpRight size={13} />
            </a>
          </div>
          <div className="qmg-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            {[
              { label: 'Trial Classes',    value: courseCounts.trial,    href: '/courses-hub?tab=trial',    icon: Target },
              { label: 'Recorded Courses', value: courseCounts.recorded, href: '/courses-hub?tab=recorded', icon: BookOpen },
              { label: 'Live Classes',     value: courseCounts.live,     href: '/courses-hub?tab=live',     icon: Video },
              { label: 'Long Courses',     value: courseCounts.long,     href: '/courses-hub?tab=long',     icon: GraduationCap },
            ].map(c => (
              <a key={c.href} href={c.href} className="adminx-row"
                style={{ display: 'block', textAlign: 'center', textDecoration: 'none', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <c.icon size={15} style={{ color: GOLD }} />
                  </div>
                </div>
                <p style={{ fontSize: 24, fontWeight: 800, color: INK, margin: 0, lineHeight: 1, fontFamily: "'Fraunces',serif" }}>{fmtNum(c.value)}</p>
                <p style={{ fontSize: 12, color: MUTED, margin: '4px 0 0', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>{c.label} <ArrowUpRight size={12} style={{ color: MUTED }} /></p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Attention center + Quick actions */}
      {(attention.length > 0 || quickActions.length > 0) && (
        <div className="qmg-two" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: 18, marginBottom: 18 }}>
          {attention.length > 0 && (
            <Panel title="Needs Attention" icon={Zap}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {attention.map((a, idx) => (
                  <a key={idx} href={a.href} className="adminx-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, textDecoration: 'none', background: CREAM, border: `1px solid ${BORDER}` }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <a.icon size={18} style={{ color: a.tone }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 20, fontWeight: 800, color: INK, margin: 0, lineHeight: 1, fontFamily: "'Fraunces',serif" }}>{fmtNum(a.value)}</p>
                      <p style={{ fontSize: 12, color: MUTED, margin: '3px 0 0', fontWeight: 600 }}>{a.label}</p>
                    </div>
                    <ArrowUpRight size={16} style={{ color: MUTED }} />
                  </a>
                ))}
              </div>
            </Panel>
          )}
          {quickActions.length > 0 && (
            <Panel title="Quick Actions" icon={Zap}>
              <div className="qmg-qa" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                {quickActions.map(a => (
                  <a key={a.href} href={a.href} className="adminx-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 8px', borderRadius: 12, textDecoration: 'none', background: '#fff', border: `1px solid ${BORDER}` }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><a.icon size={18} style={{ color: GOLD }} /></div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: INK, textAlign: 'center', lineHeight: 1.2 }}>{a.label}</span>
                  </a>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* Revenue trend */}
      {showCharts && (
        <div style={{ marginBottom: 18 }}>
          <Panel title="Revenue Trend" icon={TrendingUp}
            right={
              <div style={{ display: 'flex', gap: 4 }}>
                {(['day', 'week', 'month'] as const).map(g => (
                  <button key={g} onClick={() => setGran(g)} style={{ border: 'none', cursor: 'pointer', padding: '5px 11px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, textTransform: 'capitalize', fontFamily: "'Inter',sans-serif", background: gran === g ? CREAM : 'transparent', color: gran === g ? GOLD : MUTED }}>{g === 'day' ? 'Daily' : g === 'week' ? 'Weekly' : 'Monthly'}</button>
                ))}
              </div>
            }>
            {loading ? <Skel h={280} /> : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueSeries} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD} stopOpacity={0.35} /><stop offset="100%" stopColor={GOLD} stopOpacity={0.02} /></linearGradient>
                    <linearGradient id="gCom" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={INK} stopOpacity={0.22} /><stop offset="100%" stopColor={INK} stopOpacity={0.02} /></linearGradient>
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
      )}

      {/* Top teachers + Top courses */}
      {(showTopTeachers || showTopCourses) && (
        <div className="qmg-two" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 18, marginBottom: 18 }}>
          {showTopTeachers && (
            <Panel title="Top Performing Teachers" icon={Award}>
              {loading ? <Skel h={220} /> : topTeachers.length === 0 ? <Empty label="No teacher revenue in this period yet." />
                : <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {topTeachers.map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < topTeachers.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                      <span style={{ width: 24, height: 24, borderRadius: 7, background: i === 0 ? 'linear-gradient(135deg,#166534,#C9A227)' : CREAM, color: i === 0 ? '#111111' : GOLD, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: INK, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</p>
                        <p style={{ fontSize: 11, color: MUTED, margin: '2px 0 0' }}>{t.lessons} lessons · {fmtMoney(t.payout)} payout</p>
                      </div>
                      <span style={{ fontSize: 13.5, fontWeight: 800, color: GOLD, fontFamily: "'Fraunces',serif" }}>{fmtMoney(t.revenue)}</span>
                    </div>
                  ))}
                </div>}
            </Panel>
          )}
          {showTopCourses && (
            <Panel title="Top Performing Courses" icon={BookOpen}>
              {loading ? <Skel h={220} /> : topCourses.length === 0 ? <Empty label="No course revenue in this period yet." />
                : <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {topCourses.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < topCourses.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                      <span style={{ width: 24, height: 24, borderRadius: 7, background: i === 0 ? 'linear-gradient(135deg,#166534,#C9A227)' : CREAM, color: i === 0 ? '#111111' : GOLD, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: INK, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.course}</p>
                        <p style={{ fontSize: 11, color: MUTED, margin: '2px 0 0' }}>{c.enrollments} enrollments</p>
                      </div>
                      <span style={{ fontSize: 13.5, fontWeight: 800, color: GOLD, fontFamily: "'Fraunces',serif" }}>{fmtMoney(c.revenue)}</span>
                    </div>
                  ))}
                </div>}
            </Panel>
          )}
        </div>
      )}

      {/* Two-up: revenue split + bookings */}
      {showCharts && (
        <div className="qmg-two" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: 18, marginBottom: 18 }}>
          <Panel title="Revenue Split" icon={CreditCard}>
            {loading ? <Skel h={250} /> : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={splitData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}><Cell fill={GOLD} /><Cell fill={INK_MID} /></Pie>
                  <Tooltip formatter={(v: any) => fmtMoney(Number(v))} contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Panel>
          <Panel title="Bookings (Trial vs Paid)" icon={Clock}>
            {loading ? <Skel h={250} /> : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data?.series?.bookings || []} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="d" tick={{ fontSize: 10, fill: MUTED }} tickFormatter={fmtShortDate} minTickGap={24} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="trial" name="Trial" stackId="a" fill={GOLD_L} />
                  <Bar dataKey="paid" name="Paid" stackId="a" fill={GOLD} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>
      )}

      {/* Signups growth */}
      {showCharts && (
        <div style={{ marginBottom: 18 }}>
          <Panel title="New Registrations (Students vs Teachers)" icon={Users}>
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
      )}

      {/* Recent activity feed */}
      {canAudit && (
        <div style={{ marginBottom: 18 }}>
          <Panel title="Recent Platform Activity" icon={Activity} right={<a href="/audit-log" style={{ fontSize: 12, fontWeight: 700, color: GOLD, textDecoration: 'none' }}>View all →</a>}>
            {activity.length === 0 ? <Empty label="No recent admin activity yet." />
              : <div style={{ display: 'flex', flexDirection: 'column' }}>
                {activity.map((l, i) => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < activity.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Activity size={15} style={{ color: GOLD }} /></div>
                    <p style={{ flex: 1, fontSize: 13, color: INK, margin: 0 }}><strong>{l.actor_name || 'An admin'}</strong> <span style={{ color: '#6B6B6B' }}>{actionLabel(l.action)}</span></p>
                    <span style={{ fontSize: 11.5, color: MUTED, whiteSpace: 'nowrap' }}>{timeAgo(l.created_at)}</span>
                  </div>
                ))}
              </div>}
          </Panel>
        </div>
      )}

      {/* Operations row */}
      {ops.length > 0 && (
        <div className="qmg-ops" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, ops.length)}, 1fr)`, gap: 12, marginBottom: 8 }}>
          {ops.map(({ label, value, href, icon: Icon }) => (
            <a key={href} href={href} className="adminx-stat" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '16px 18px', borderRadius: 14, textDecoration: 'none', background: '#fff', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={19} style={{ color: GOLD }} /></div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 800, color: INK, margin: 0, lineHeight: 1, fontFamily: "'Fraunces',serif" }}>{fmtNum(value)}</p>
                <p style={{ fontSize: 11.5, color: MUTED, margin: '4px 0 0', fontWeight: 600 }}>{label}</p>
              </div>
            </a>
          ))}
        </div>
      )}

      <style>{`
        .qmg-skel{background:linear-gradient(90deg,#F1ECE2 25%,#E8E2D6 50%,#F1ECE2 75%);background-size:200% 100%;animation:qmgsh 1.4s infinite;border-radius:14px}
        @keyframes qmgsh{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes qmgrise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .adminx-rise{animation:qmgrise .5s cubic-bezier(.4,0,.2,1) both}
        .adminx-stat{transition:transform .25s cubic-bezier(.4,0,.2,1),box-shadow .25s ease,border-color .25s ease}
        .adminx-stat:hover{transform:translateY(-3px)!important;box-shadow:0 12px 30px rgba(201,162,39,.16),0 2px 8px rgba(0,0,0,.06)!important;border-color:rgba(201,162,39,.55)!important}
        .adminx-row{transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
        .adminx-row:hover{transform:translateY(-2px)!important;box-shadow:0 8px 20px rgba(0,0,0,.06)!important;border-color:rgba(201,162,39,.5)!important}
        @media(max-width:1100px){ .qmg-kpi-grid{grid-template-columns:repeat(3, minmax(0, 1fr))!important} .qmg-two{grid-template-columns:minmax(0,1fr)!important} .qmg-ops{grid-template-columns:repeat(2, minmax(0, 1fr))!important} }
        @media(max-width:640px){ .qmg-kpi-grid{grid-template-columns:repeat(2, minmax(0, 1fr))!important} .qmg-qa{grid-template-columns:repeat(2, minmax(0, 1fr))!important} }
        @media(max-width:380px){ .qmg-kpi-grid{grid-template-columns:minmax(0,1fr)!important} .qmg-ops{grid-template-columns:minmax(0,1fr)!important} }
      `}</style>
    </AdminLayout>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div style={{ padding: '34px 12px', textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: CREAM, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><BookOpen size={20} style={{ color: GOLD }} /></div>
      <p style={{ fontSize: 12.5, color: MUTED, margin: 0 }}>{label}</p>
    </div>
  )
}
