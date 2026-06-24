// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/api/analytics/deep/route.ts
// Advanced analytics — funnel, geography, course intelligence, support,
// forecast base + AI-insight inputs. Service-role; ?range=7|30|90|365|all
// Every optional-schema query is guarded so a missing column never 500s.
// ============================================================
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
const DAY = 86400000
const round1 = (n: number) => Math.round(n * 10) / 10

export async function GET(req: Request) {
  const url = new URL(req.url)
  const range = url.searchParams.get('range') || '30'
  const days = range === 'all' ? null : parseInt(range, 10)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const startISO = days ? new Date(now.getTime() - days * DAY).toISOString() : null
  const prevStartISO = days ? new Date(now.getTime() - 2 * days * DAY).toISOString() : null
  const inCur = (d: string) => !startISO || d >= startISO
  const inPrev = (d: string) => !!startISO && !!prevStartISO && d >= prevStartISO && d < startISO

  // profiles (id/role/country) for geography + funnel
  const profQ = supabase.from('profiles').select('id, role, country, is_active, created_at, first_name, last_name')
  const payQ = supabase.from('payments').select('gross_amount_usd, platform_fee_usd, teacher_payout_usd, status, created_at, student_id, teacher_id')
  const bookQ = supabase.from('bookings').select('status, is_trial, price_usd, created_at, course_id, courses(title)')
  // Realised payout per teacher from the earnings ledger (excludes held + reversed).
  const earnQ = supabase.from('teacher_earnings').select('net_amount_usd, created_at, teacher_id')

  const [profsRes, paysRes, booksRes, earnsRes] = await Promise.all([
    profQ.limit(20000),
    (prevStartISO ? payQ.gte('created_at', prevStartISO) : payQ).limit(20000),
    (prevStartISO ? bookQ.gte('created_at', prevStartISO) : bookQ).limit(20000),
    (prevStartISO ? earnQ.gte('created_at', prevStartISO) : earnQ).limit(20000),
  ])
  const profs = (profsRes.data as any[]) || []
  const pays = (paysRes.data as any[]) || []
  const books = (booksRes.data as any[]) || []
  const earnsCur = ((earnsRes.data as any[]) || []).filter(e => (Number(e.net_amount_usd) || 0) > 0 && inCur(e.created_at))

  // ── Geography ──────────────────────────────────────────────────────────────
  const studentCountry: Record<string, string> = {}
  const studByC: Record<string, number> = {}
  const teachByC: Record<string, number> = {}
  profs.forEach(p => {
    if (p.role === 'student') studentCountry[p.id] = p.country || 'Unknown'
    if (p.country) {
      if (p.role === 'student') studByC[p.country] = (studByC[p.country] || 0) + 1
      if (p.role === 'teacher') teachByC[p.country] = (teachByC[p.country] || 0) + 1
    }
  })
  const revByC: Record<string, number> = {}
  pays.filter(p => p.status === 'succeeded' && inCur(p.created_at)).forEach(p => {
    const c = studentCountry[p.student_id] || 'Unknown'
    revByC[c] = (revByC[c] || 0) + (Number(p.gross_amount_usd) || 0)
  })
  const mergeCountries = () => {
    const all = new Set([...Object.keys(studByC), ...Object.keys(teachByC), ...Object.keys(revByC)])
    return Array.from(all).map(c => ({
      country: c, students: studByC[c] || 0, teachers: teachByC[c] || 0, revenue: round1(revByC[c] || 0),
    })).sort((a, b) => b.students - a.students)
  }
  const geography = mergeCountries()

  // ── Conversion funnel (current window) ──────────────────────────────────────
  const bCur = books.filter(b => inCur(b.created_at))
  const signups = profs.filter(p => p.role === 'student' && inCur(p.created_at)).length
  const trialBooked = bCur.filter(b => b.is_trial).length
  const trialCompleted = bCur.filter(b => b.is_trial && b.status === 'completed').length
  const paidEnroll = bCur.filter(b => !b.is_trial).length
  const activeStudents = profs.filter(p => p.role === 'student' && p.is_active).length
  const funnel = [
    { stage: 'Signups', value: signups },
    { stage: 'Trial Booked', value: trialBooked },
    { stage: 'Trial Completed', value: trialCompleted },
    { stage: 'Paid Enrollment', value: paidEnroll },
    { stage: 'Active Student', value: activeStudents },
  ]

  // ── Course intelligence (from bookings) ─────────────────────────────────────
  const byCourse: Record<string, any> = {}
  bCur.forEach(b => {
    const title = (b.courses as any)?.title || 'Unknown Course'
    if (!byCourse[title]) byCourse[title] = { course: title, enrollments: 0, revenue: 0, completed: 0, total: 0 }
    byCourse[title].total++
    if (b.status === 'completed') byCourse[title].completed++
    if (!b.is_trial) { byCourse[title].enrollments++; byCourse[title].revenue += Number(b.price_usd) || 0 }
  })
  // optional per-course rating (guarded — column may not exist)
  const ratingByCourse: Record<string, { sum: number; n: number }> = {}
  const revRes = await supabase.from('reviews').select('rating, course_id')
  if (!revRes.error && revRes.data) {
    const courseTitleById: Record<string, string> = {}
    bCur.forEach(b => { if (b.course_id) courseTitleById[b.course_id] = (b.courses as any)?.title || '' })
    ;(revRes.data as any[]).forEach(r => {
      const t = courseTitleById[r.course_id]; if (!t) return
      if (!ratingByCourse[t]) ratingByCourse[t] = { sum: 0, n: 0 }
      ratingByCourse[t].sum += Number(r.rating) || 0; ratingByCourse[t].n++
    })
  }
  const courses = Object.values(byCourse).map((c: any) => ({
    ...c, revenue: round1(c.revenue),
    completionRate: c.total ? Math.round((c.completed / c.total) * 100) : 0,
    rating: ratingByCourse[c.course]?.n ? round1(ratingByCourse[c.course].sum / ratingByCourse[c.course].n) : null,
  })).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 12)

  // ── Support analytics (guarded) ─────────────────────────────────────────────
  let support: any = { open: 0, resolved: 0, avgResponseHrs: null, trend: [], hasData: false }
  const supRes = await supabase.from('support_tickets').select('status, created_at, resolved_at').limit(20000)
  if (!supRes.error && supRes.data) {
    const t = (supRes.data as any[])
    const cur = t.filter(x => inCur(x.created_at))
    support.open = t.filter(x => x.status === 'open').length
    support.resolved = t.filter(x => x.status === 'resolved' || x.status === 'closed').length
    const resolvedWithTimes = cur.filter(x => x.resolved_at && x.created_at)
    if (resolvedWithTimes.length) {
      const hrs = resolvedWithTimes.reduce((s, x) => s + (new Date(x.resolved_at).getTime() - new Date(x.created_at).getTime()) / 3600000, 0)
      support.avgResponseHrs = round1(hrs / resolvedWithTimes.length)
    }
    const tmap: Record<string, any> = {}
    cur.forEach(x => { const k = x.created_at.slice(0, 10); if (!tmap[k]) tmap[k] = { d: k, opened: 0 }; tmap[k].opened++ })
    support.trend = Object.values(tmap)
    support.hasData = t.length > 0
  } else {
    const sup2 = await supabase.from('support_tickets').select('status', { count: 'exact', head: true })
    support.hasData = !sup2.error
  }

  // ── Monthly revenue (last 12 months) for forecasting ────────────────────────
  const monthMap: Record<string, number> = {}
  pays.filter(p => p.status === 'succeeded').forEach(p => {
    const d = new Date(p.created_at); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap[k] = (monthMap[k] || 0) + (Number(p.gross_amount_usd) || 0)
  })
  const monthly = Object.entries(monthMap).map(([m, v]) => ({ m, revenue: round1(v) })).sort((a, b) => a.m.localeCompare(b.m)).slice(-12)

  // ── AI-insight inputs ────────────────────────────────────────────────────────
  const okCur = pays.filter(p => p.status === 'succeeded' && inCur(p.created_at))

  // ── Top teachers (by payout) + failed payments ──────────────────────────────
  const nameById: Record<string, string> = {}
  profs.forEach(p => { if (p.role === 'teacher') nameById[p.id] = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Teacher' })
  const tAgg: Record<string, any> = {}
  okCur.forEach(p => {
    const id = p.teacher_id; if (!id) return
    if (!tAgg[id]) tAgg[id] = { id, revenue: 0, payout: 0, lessons: 0 }
    tAgg[id].revenue += Number(p.gross_amount_usd) || 0
    tAgg[id].lessons++
  })
  // Realised payout per teacher (held trial/long excluded until acceptance).
  earnsCur.forEach(e => {
    const id = e.teacher_id; if (!id) return
    if (!tAgg[id]) tAgg[id] = { id, revenue: 0, payout: 0, lessons: 0 }
    tAgg[id].payout += Number(e.net_amount_usd) || 0
  })
  const topTeachers = Object.values(tAgg).map((t: any) => ({
    name: nameById[t.id] || 'Teacher', revenue: round1(t.revenue), payout: round1(t.payout), lessons: t.lessons,
  })).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5)
  const failedPayments = pays.filter(p => p.status === 'failed' && inCur(p.created_at)).length

  const okPrev = pays.filter(p => p.status === 'succeeded' && inPrev(p.created_at))
  const gC = okCur.reduce((s, p) => s + (Number(p.gross_amount_usd) || 0), 0)
  const gP = okPrev.reduce((s, p) => s + (Number(p.gross_amount_usd) || 0), 0)
  const revenueGrowth = gP > 0 ? round1(((gC - gP) / gP) * 100) : (gC > 0 ? 100 : 0)
  const topStudentCountry = [...geography].sort((a, b) => b.students - a.students)[0]?.country || null
  const topRevenueCountry = [...geography].sort((a, b) => b.revenue - a.revenue)[0]?.country || null
  const topCourse = courses[0]?.course || null
  const convBaseStudents = new Set(bCur.filter(b => b.is_trial).map((b: any) => b.student_id || b.course_id)).size
  const conversionRate = trialBooked > 0 ? round1((paidEnroll / trialBooked) * 100) : 0

  return NextResponse.json({
    meta: { range, generatedAt: now.toISOString() },
    funnel,
    geography: geography.slice(0, 20),
    courses,
    topTeachers,
    attention: { failedPayments, openTickets: support.open },
    support,
    monthly,
    insights: { revenueGrowth, topStudentCountry, topRevenueCountry, topCourse, conversionRate, trialBooked, paidEnroll, activeStudents, openTickets: support.open, avgResponseHrs: support.avgResponseHrs },
  })
}
