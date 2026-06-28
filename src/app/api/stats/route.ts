import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Always compute live — these are money/lifecycle figures that must match the
// Payout Management, Finance, and Refunds pages. Never serve a cached snapshot.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [students, teachers, bookings, payments, pending, reviews] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
    supabase.from('bookings').select('id', { count: 'exact', head: true }),
    // Pull status + gross so refunded/failed don't inflate, and we can report GTV.
    supabase.from('payments').select('gross_amount_usd, platform_fee_usd, status, student_id').limit(100000), // [5.7] no 2000 cap
    supabase.from('teacher_profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('is_published', false),
  ])

  const okPays = ((payments.data as any[]) || []).filter((p: any) => p.status === 'succeeded')
  // [5.6] Be explicit: GTV (gross) vs platform revenue (commission) are different.
  const gtv = okPays.reduce((s: number, p: any) => s + (Number(p.gross_amount_usd) || 0), 0)

  // Refunds (best-effort; table is additive).
  let totalRefunded = 0
  let refundCount = 0
  try {
    const { data: refs } = await supabase.from('booking_refunds').select('amount_usd').limit(100000)
    refundCount = (refs || []).length
    totalRefunded = (refs || []).reduce((s: number, r: any) => s + (Number(r.amount_usd) || 0), 0)
  } catch { /* booking_refunds not present yet */ }

  // ── Ledger-driven money stages (single source of truth = teacher_earnings) ──
  let teacherLiability = 0    // money owed to teachers, not yet paid
  let paidOut = 0             // money already transferred to teachers
  let realizedCommission = 0  // platform cut on accepted (non-reversed) earnings
  try {
    const { data: ledger } = await supabase
      .from('teacher_earnings').select('net_amount_usd, commission_usd, status').limit(100000)
    for (const e of (ledger || []) as any[]) {
      const net = Number(e.net_amount_usd) || 0
      if (net > 0) realizedCommission += Number(e.commission_usd) || 0  // reversed rows are net 0
      if (['pending', 'available', 'payout_pending'].includes(e.status)) teacherLiability += net
      else if (e.status === 'paid') paidOut += net
    }
  } catch { /* ledger unavailable */ }

  // Payout pipeline by lifecycle stage (manual-payout workflow).
  let requestedPayouts = 0, approvedPayouts = 0, processingPayouts = 0, completedPayouts = 0, pendingPayouts = 0
  try {
    const { data: po } = await supabase
      .from('teacher_payouts').select('amount_usd, status').limit(100000)
    const sumBy = (arr: string[]) => ((po || []) as any[]).filter(p => arr.includes(String(p.status))).reduce((s, p) => s + (Number(p.amount_usd) || 0), 0)
    requestedPayouts  = sumBy(['requested', 'pending', 'under_review'])
    approvedPayouts   = sumBy(['approved'])
    processingPayouts = sumBy(['processing'])
    completedPayouts  = sumBy(['completed'])
    pendingPayouts    = sumBy(['requested', 'pending', 'under_review', 'approved', 'processing']) // all awaiting transfer (back-compat)
  } catch {}

  let mrr = 0
  try {
    const { data: subs } = await supabase
      .from('subscriptions').select('monthly_amount_usd, price_per_month_usd, status').limit(100000)
    mrr = ((subs || []) as any[])
      .filter(s => s.status === 'active')
      .reduce((s, x) => s + (Number(x.monthly_amount_usd ?? x.price_per_month_usd) || 0), 0)
  } catch {}

  const payingStudents = new Set(
    okPays.filter((p: any) => (Number(p.gross_amount_usd) || 0) > 0).map((p: any) => p.student_id)
  )
  const arpu = payingStudents.size > 0 ? gtv / payingStudents.size : 0

  return NextResponse.json({
    totalStudents:   students.count  ?? 0,
    totalTeachers:   teachers.count  ?? 0,
    totalBookings:   bookings.count  ?? 0,
    gtv:             Math.round(gtv * 100) / 100,              // gross transaction value
    platformRevenue: Math.round(realizedCommission * 100) / 100, // platform commission income (realized)
    totalRevenue:    Math.round(realizedCommission * 100) / 100, // back-compat
    teacherLiability: Math.round(teacherLiability * 100) / 100,
    paidOut:          Math.round(paidOut * 100) / 100,
    pendingPayouts:   Math.round(pendingPayouts * 100) / 100,
    requestedPayouts:  Math.round(requestedPayouts * 100) / 100,
    approvedPayouts:   Math.round(approvedPayouts * 100) / 100,
    processingPayouts: Math.round(processingPayouts * 100) / 100,
    completedPayouts:  Math.round(completedPayouts * 100) / 100,
    mrr:              Math.round(mrr * 100) / 100,
    arpu:             Math.round(arpu * 100) / 100,
    totalRefunded:   Math.round(totalRefunded * 100) / 100,
    refundCount,
    pendingTeachers: pending.count   ?? 0,
    pendingReviews:  reviews.count   ?? 0,
  })
}
