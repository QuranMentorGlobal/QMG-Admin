import { NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'
const r1 = (n: number) => Math.round(n * 10) / 10

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await guard(['teachers.view']); if ('error' in g) return g.error
  const svc = service()

  const { data: tp, error } = await svc
    .from('teacher_profiles')
    .select('*, profiles(first_name, last_name, email, country, is_active, created_at)')
    .eq('id', params.id).single()
  if (error || !tp) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
  const t: any = tp
  const userId = t.user_id

  // Revenue / payout / paid lessons
  let revenue = 0, payout = 0, paidLessons = 0
  try {
    const { data: pays } = await svc.from('payments').select('gross_amount_usd, teacher_payout_usd, status').eq('teacher_id', userId)
    ;(pays || []).forEach((p: any) => { if (p.status === 'succeeded') { revenue += Number(p.gross_amount_usd) || 0; payout += Number(p.teacher_payout_usd) || 0; paidLessons++ } })
  } catch {}

  // Bookings (completion + recent)
  let completed = 0, cancelled = 0, upcoming = 0, totalBookings = 0, recent: any[] = []
  try {
    const { data: bks } = await svc.from('bookings')
      .select('id, status, is_trial, start_date, created_at, courses(title)')
      .eq('teacher_id', userId).order('created_at', { ascending: false }).limit(200)
    ;(bks || []).forEach((b: any) => {
      totalBookings++
      if (b.status === 'completed') completed++
      else if (b.status === 'cancelled') cancelled++
      else if (b.status === 'confirmed' || b.status === 'pending') upcoming++
    })
    recent = (bks || []).slice(0, 6).map((b: any) => ({ id: b.id, status: b.status, isTrial: b.is_trial, course: b.courses?.title || '—', date: b.start_date || b.created_at }))
  } catch {}
  const denom = completed + cancelled
  const completionRate = denom > 0 ? r1((completed / denom) * 100) : (totalBookings > 0 ? r1((completed / totalBookings) * 100) : 0)

  // Satisfaction (guarded — reviews.teacher_id may not exist)
  let reviewCount = 0, avgRating = Number(t.avg_rating) || 0
  try {
    const { data: rv, error: rerr } = await svc.from('reviews').select('rating').eq('teacher_id', userId)
    if (!rerr && rv) { reviewCount = rv.length; if (rv.length) avgRating = r1(rv.reduce((s: number, x: any) => s + (Number(x.rating) || 0), 0) / rv.length) }
  } catch {}

  // Profile completeness
  const checks = [
    !!t.bio, !!t.hourly_rate_usd,
    Array.isArray(t.specializations) && t.specializations.length > 0,
    Array.isArray(t.languages) && t.languages.length > 0,
    !!t.years_experience, !!t.identity_verified, !!t.quran_mentor_verified, !!t.ijazah_verified,
  ]
  const completeness = Math.round((checks.filter(Boolean).length / checks.length) * 100)

  return NextResponse.json({
    profile: {
      id: t.id, userId, status: t.status,
      firstName: t.profiles?.first_name || '', lastName: t.profiles?.last_name || '',
      email: t.profiles?.email || '', country: t.profiles?.country || '',
      isActive: t.profiles?.is_active !== false, createdAt: t.profiles?.created_at || null,
      bio: t.bio || '', languages: t.languages || [], specializations: t.specializations || [],
      yearsExperience: t.years_experience || 0, hourlyRate: Number(t.hourly_rate_usd) || 0,
    },
    metrics: { revenue: r1(revenue), payout: r1(payout), paidLessons, totalLessons: t.total_lessons || paidLessons, completed, cancelled, upcoming, totalBookings, completionRate, avgRating, reviewCount, completeness },
    verification: { identity: !!t.identity_verified, quran_mentor: !!t.quran_mentor_verified, ijazah: !!t.ijazah_verified, phone: !!t.phone_verified },
    recent,
  })
}
