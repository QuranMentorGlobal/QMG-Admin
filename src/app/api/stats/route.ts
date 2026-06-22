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
    // Pull status so refunded/failed payments don't inflate revenue.
    supabase.from('payments').select('platform_fee_usd, status').limit(2000),
    supabase.from('teacher_profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('is_published', false),
  ])

  // Revenue = platform commission on SUCCEEDED payments only.
  const revenue = ((payments.data as any[]) || [])
    .filter((p: any) => p.status === 'succeeded')
    .reduce((sum: number, p: any) => sum + (Number(p.platform_fee_usd) || 0), 0)

  // Refunds (best-effort; table is additive).
  let totalRefunded = 0
  let refundCount = 0
  try {
    const { data: refs } = await supabase.from('booking_refunds').select('amount_usd')
    refundCount = (refs || []).length
    totalRefunded = (refs || []).reduce((s: number, r: any) => s + (Number(r.amount_usd) || 0), 0)
  } catch { /* booking_refunds not present yet */ }

  return NextResponse.json({
    totalStudents:   students.count  ?? 0,
    totalTeachers:   teachers.count  ?? 0,
    totalBookings:   bookings.count  ?? 0,
    totalRevenue:    Math.round(revenue * 100) / 100,
    totalRefunded:   Math.round(totalRefunded * 100) / 100,
    refundCount,
    pendingTeachers: pending.count   ?? 0,
    pendingReviews:  reviews.count   ?? 0,
  })
}
