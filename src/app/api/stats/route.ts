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
    supabase.from('payments').select('platform_fee_usd').limit(1000),
    supabase.from('teacher_profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('is_published', false),
  ])

  const revenue = ((payments.data as any[]) || []).reduce(
    (sum: number, p: any) => sum + (Number(p.platform_fee_usd) || 0), 0
  )

  return NextResponse.json({
    totalStudents:   students.count  ?? 0,
    totalTeachers:   teachers.count  ?? 0,
    totalBookings:   bookings.count  ?? 0,
    totalRevenue:    revenue,
    pendingTeachers: pending.count   ?? 0,
    pendingReviews:  reviews.count   ?? 0,
  })
}
