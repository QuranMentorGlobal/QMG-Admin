// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/api/analytics/route.ts
// Executive analytics — computes KPIs + time series from real Supabase data.
// Uses the SERVICE ROLE key (server-only). ?range=7|30|90|365|all
// ============================================================
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const DAY = 86400000
const dayKey = (d: string | Date) => new Date(d).toISOString().slice(0, 10)
const round1 = (n: number) => Math.round(n * 10) / 10
function growth(cur: number, prev: number) {
  if (prev > 0) return round1(((cur - prev) / prev) * 100)
  return 0   // [5.9] no false +100% when the prior period had no baseline
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const range = url.searchParams.get('range') || '30'
  const days = range === 'all' ? null : parseInt(range, 10)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const start = days ? new Date(now.getTime() - days * DAY) : null
  const prevStart = days ? new Date(now.getTime() - 2 * days * DAY) : null
  const startISO = start ? start.toISOString() : null
  const prevStartISO = prevStart ? prevStart.toISOString() : null
  const todayISO = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  // ── Cheap exact counts ────────────────────────────────────────────────────
  const [
    totalStudents, totalTeachers, activeStudents, approvedTeachers,
    pendingTeachers, newToday, openTickets,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', true),
    supabase.from('teacher_profiles').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('teacher_profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
    supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ])

  // ── Rows across current + previous window (split in JS) ───────────────────
  const payQ = supabase.from('payments')
    .select('gross_amount_usd, platform_fee_usd, teacher_payout_usd, status, payment_type, created_at, student_id, teacher_id')
  const bookQ = supabase.from('bookings').select('status, is_trial, price_usd, created_at, student_id, teacher_id')
  const profQ = supabase.from('profiles').select('role, created_at, country')

  const [paysRes, booksRes, profsRes] = await Promise.all([
    (prevStartISO ? payQ.gte('created_at', prevStartISO) : payQ).limit(100000),
    (prevStartISO ? bookQ.gte('created_at', prevStartISO) : bookQ).limit(100000),
    (prevStartISO ? profQ.gte('created_at', prevStartISO) : profQ).limit(100000),
  ])

  const pays = (paysRes.data as any[]) || []
  const books = (booksRes.data as any[]) || []
  const profs = (profsRes.data as any[]) || []

  const inCur  = (d: string) => !startISO || d >= startISO
  const inPrev = (d: string) => !!startISO && !!prevStartISO && d >= prevStartISO && d < startISO

  // ── Payments-derived metrics ──────────────────────────────────────────────
  const okCur  = pays.filter(p => p.status === 'succeeded' && inCur(p.created_at))
  const okPrev = pays.filter(p => p.status === 'succeeded' && inPrev(p.created_at))
  const sum = (arr: any[], k: string) => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0)

  // [5.1] A *paid* payment is a real, non-trial transaction with money on it.
  // Free $0 trials create succeeded rows; excluding them keeps conversion,
  // retention and "paid student" sets honest.
  const isPaid = (p: any) => (Number(p.gross_amount_usd) || 0) > 0 && p.payment_type !== 'trial'
  const paidCurRows  = okCur.filter(isPaid)
  const paidPrevRows = okPrev.filter(isPaid)

  const gtvCur = sum(okCur, 'gross_amount_usd'),   gtvPrev = sum(okPrev, 'gross_amount_usd')
  const comCur = sum(okCur, 'platform_fee_usd'),   comPrev = sum(okPrev, 'platform_fee_usd')
  const payoutCur = sum(okCur, 'teacher_payout_usd')

  // [5.3] MRR: real recurring revenue from ACTIVE subscriptions, normalized to a
  // month. Computed in its own query so it never depends on the range filter.
  let mrr = 0
  try {
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('amount_usd, monthly_price_usd, price_usd, billing_interval, status')
      .eq('status', 'active')
      .limit(100000)
    const monthly = (per: any) => {
      const amt = Number(per.monthly_price_usd ?? per.amount_usd ?? per.price_usd) || 0
      switch ((per.billing_interval || 'monthly')) {
        case 'annual':      return amt / 12
        case 'semi_annual': return amt / 6
        case 'quarterly':   return amt / 3
        default:            return amt
      }
    }
    mrr = (subs || []).reduce((s: number, x: any) => s + monthly(x), 0)
  } catch {
    // Fallback proxy: last-30-day PAID (non-trial) revenue, range-independent.
    const cutoff = new Date(now.getTime() - 30 * DAY).toISOString()
    mrr = sum(pays.filter(p => p.status === 'succeeded' && isPaid(p) && p.created_at >= cutoff), 'gross_amount_usd')
  }

  // ── Bookings-derived metrics ──────────────────────────────────────────────
  const bCur  = books.filter(b => inCur(b.created_at))
  const bPrev = books.filter(b => inPrev(b.created_at))
  const trialCur = bCur.filter(b => b.is_trial).length,  trialPrev = bPrev.filter(b => b.is_trial).length
  const paidCur  = bCur.filter(b => !b.is_trial).length,  paidPrev = bPrev.filter(b => !b.is_trial).length
  const completedCur = bCur.filter(b => b.status === 'completed').length
  const cancelledCur = bCur.filter(b => b.status === 'cancelled').length
  const upcomingCur  = bCur.filter(b => b.status === 'confirmed' || b.status === 'pending').length

  // [5.1] Trial -> paid conversion (distinct students; "paid" excludes $0 trials)
  const trialStudents = new Set(bCur.filter(b => b.is_trial).map((b: any) => b.student_id))
  const paidStudents  = new Set(paidCurRows.map(p => p.student_id))
  const convBase = trialStudents.size
  let converted = 0; trialStudents.forEach(s => { if (paidStudents.has(s)) converted++ })
  const conversionRate = convBase > 0 ? round1((converted / convBase) * 100) : 0

  // ARPU / ARPT
  const earningTeachers = new Set(paidCurRows.map(p => p.teacher_id)).size
  // [5.5] Period-consistent ARPU: period GTV ÷ students active in the SAME period
  // (anyone who paid or booked in the window), not the all-time active count.
  const periodActiveStudents = new Set<string>()
  paidCurRows.forEach(p => { if (p.student_id) periodActiveStudents.add(p.student_id) })
  bCur.forEach(b => { if (b.student_id) periodActiveStudents.add(b.student_id) })
  const arpu = periodActiveStudents.size ? round1(gtvCur / periodActiveStudents.size) : 0
  const arpt = earningTeachers ? round1(payoutCur / earningTeachers) : 0

  // [5.2] Repeat-purchase retention (distinct PAID students/teachers in both windows)
  const curTeachers = new Set(paidCurRows.map(p => p.teacher_id))
  const prevPayStudents = new Set(paidPrevRows.map(p => p.student_id))
  const prevPayTeachers = new Set(paidPrevRows.map(p => p.teacher_id))
  let sRet = 0; prevPayStudents.forEach(s => { if (paidStudents.has(s)) sRet++ })
  let tRet = 0; prevPayTeachers.forEach(t => { if (curTeachers.has(t)) tRet++ })
  const studentRetention = prevPayStudents.size ? round1((sRet / prevPayStudents.size) * 100) : 0
  const teacherRetention = prevPayTeachers.size ? round1((tRet / prevPayTeachers.size) * 100) : 0

  // [5.8] New registrations in window — ALL roles, not just students.
  const newStudCur  = profs.filter(p => inCur(p.created_at)).length
  const newStudPrev = profs.filter(p => inPrev(p.created_at)).length

  // ── Daily series for the current window ───────────────────────────────────
  const allDates = [...okCur.map(p => p.created_at), ...bCur.map(b => b.created_at), ...profs.filter(p => inCur(p.created_at)).map(p => p.created_at)]
  const seriesStart = startISO ? new Date(startISO) : (allDates.length ? new Date(allDates.reduce((a, b) => a < b ? a : b)) : now)
  const revMap: Record<string, any> = {}
  const bookMap: Record<string, any> = {}
  const signMap: Record<string, any> = {}
  for (let t = new Date(dayKey(seriesStart)); t <= now; t = new Date(t.getTime() + DAY)) {
    const k = dayKey(t)
    revMap[k] = { d: k, gross: 0, commission: 0 }
    bookMap[k] = { d: k, total: 0, trial: 0, paid: 0 }
    signMap[k] = { d: k, students: 0, teachers: 0 }
  }
  okCur.forEach(p => { const k = dayKey(p.created_at); if (revMap[k]) { revMap[k].gross += Number(p.gross_amount_usd) || 0; revMap[k].commission += Number(p.platform_fee_usd) || 0 } })
  bCur.forEach(b => { const k = dayKey(b.created_at); if (bookMap[k]) { bookMap[k].total++; b.is_trial ? bookMap[k].trial++ : bookMap[k].paid++ } })
  profs.filter(p => inCur(p.created_at)).forEach(p => { const k = dayKey(p.created_at); if (signMap[k]) { p.role === 'teacher' ? signMap[k].teachers++ : signMap[k].students++ } })

  // ── Students by country (top 10) ──────────────────────────────────────────
  const countryStud: Record<string, number> = {}
  profs.filter(p => p.country).forEach(p => { countryStud[p.country] = (countryStud[p.country] || 0) + 1 })
  const byCountry = Object.entries(countryStud).map(([country, students]) => ({ country, students })).sort((a, b) => b.students - a.students).slice(0, 10)

  return NextResponse.json({
    meta: { range, generatedAt: now.toISOString() },
    kpis: {
      totalRevenue:    { value: round1(gtvCur),  growth: growth(gtvCur, gtvPrev) },
      commission:      { value: round1(comCur),  growth: growth(comCur, comPrev) },
      gtv:             { value: round1(gtvCur),  growth: growth(gtvCur, gtvPrev) },
      mrr:             { value: round1(mrr),     growth: 0, note: 'Active subscriptions, monthly-normalized' },
      activeStudents:  { value: activeStudents.count ?? 0, growth: 0 },
      activeTeachers:  { value: approvedTeachers.count ?? 0, growth: 0 },
      newToday:        { value: newToday.count ?? 0 },
      trialRequests:   { value: trialCur, growth: growth(trialCur, trialPrev) },
      paidEnrollments: { value: paidCur,  growth: growth(paidCur, paidPrev) },
      conversionRate:  { value: conversionRate, growth: 0, suffix: '%' },
      arpu:            { value: arpu, growth: 0 },
      arpt:            { value: arpt, growth: 0 },
      studentRetention:{ value: studentRetention, suffix: '%', note: 'Repeat purchasers vs prev period' },
      teacherRetention:{ value: teacherRetention, suffix: '%', note: 'Repeat earners vs prev period' },
      newRegistrations:{ value: newStudCur, growth: growth(newStudCur, newStudPrev) },
    },
    totals: {
      totalStudents: totalStudents.count ?? 0,
      totalTeachers: totalTeachers.count ?? 0,
      pendingTeachers: pendingTeachers.count ?? 0,
      openTickets: openTickets.count ?? 0,
    },
    bookings: { completed: completedCur, upcoming: upcomingCur, cancelled: cancelledCur, trial: trialCur, paid: paidCur },
    split: { commission: round1(comCur), teacherPayout: round1(payoutCur) },
    series: {
      revenue: Object.values(revMap),
      bookings: Object.values(bookMap),
      signups: Object.values(signMap),
    },
    byCountry,
  })
}
