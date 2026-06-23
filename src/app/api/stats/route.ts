import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
  const platformRevenue = okPays.reduce((s: number, p: any) => s + (Number(p.platform_fee_usd) || 0), 0)

  // Refunds (best-effort; table is additive).
  let totalRefunded = 0
  let refundCount = 0
  try {
    const { data: refs } = await supabase.from('booking_refunds').select('amount_usd').limit(100000)
    refundCount = (refs || []).length
    totalRefunded = (refs || []).reduce((s: number, r: any) => s + (Number(r.amount_usd) || 0), 0)
  } catch { /* booking_refunds not present yet */ }

  // ── Ledger-driven money stages (single source of truth = teacher_earnings) ──
  let teacherLiability = 0  // money owed to teachers, not yet paid
  let paidOut = 0           // money already transferred to teachers
  try {
    const { data: ledger } = await supabase
      .from('teacher_earnings').select('net_amount_usd, status').limit(100000)
    for (const e of (ledger || []) as any[]) {
      const net = Number(e.net_amount_usd) || 0
      if (['pending', 'available', 'payout_pending'].includes(e.status)) teacherLiability += net
      else if (e.status === 'paid') paidOut += net
    }
  } catch { /* ledger unavailable */ }

  let pendingPayouts = 0    // payout requests awaiting transfer
  try {
    const { data: po } = await supabase
      .from('teacher_payouts').select('amount_usd, status').limit(100000)
    pendingPayouts = ((po || []) as any[])
      .filter(p => ['pending', 'approved', 'processing'].includes(p.status))
      .reduce((s, p) => s + (Number(p.amount_usd) || 0), 0)
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
    platformRevenue: Math.round(platformRevenue * 100) / 100, // platform commission income
    totalRevenue:    Math.round(platformRevenue * 100) / 100, // back-compat
    teacherLiability: Math.round(teacherLiability * 100) / 100,
    paidOut:          Math.round(paidOut * 100) / 100,
    pendingPayouts:   Math.round(pendingPayouts * 100) / 100,
    mrr:              Math.round(mrr * 100) / 100,
    arpu:             Math.round(arpu * 100) / 100,
    totalRefunded:   Math.round(totalRefunded * 100) / 100,
    refundCount,
    pendingTeachers: pending.count   ?? 0,
    pendingReviews:  reviews.count   ?? 0,
  })
}
