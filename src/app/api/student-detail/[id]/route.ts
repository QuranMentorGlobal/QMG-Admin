import { NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'
const r1 = (n: number) => Math.round(n * 10) / 10
const daysBetween = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await guard(['students.view']); if ('error' in g) return g.error
  const svc = service()
  const id = params.id

  const { data: prof, error } = await svc.from('profiles')
    .select('id, first_name, last_name, email, country, phone, is_active, created_at')
    .eq('id', id).single()
  if (error || !prof) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  const p: any = prof

  // Spend
  let totalSpent = 0, paidCount = 0, lastPayment: string | null = null
  try {
    const { data: pays } = await svc.from('payments').select('gross_amount_usd, status, created_at').eq('student_id', id)
    ;(pays || []).forEach((x: any) => {
      if (x.status === 'succeeded') { totalSpent += Number(x.gross_amount_usd) || 0; paidCount++; if (!lastPayment || x.created_at > lastPayment) lastPayment = x.created_at }
    })
  } catch {}

  // Bookings
  let total = 0, completed = 0, cancelled = 0, upcoming = 0, trial = 0, paid = 0, lastBooking: string | null = null
  const courseSet = new Set<string>(); let recent: any[] = []
  try {
    const { data: bks } = await svc.from('bookings')
      .select('id, status, is_trial, course_id, start_date, created_at, courses(title)')
      .eq('student_id', id).order('created_at', { ascending: false }).limit(200)
    ;(bks || []).forEach((b: any) => {
      total++
      if (b.status === 'completed') completed++
      else if (b.status === 'cancelled') cancelled++
      else if (b.status === 'confirmed' || b.status === 'pending') upcoming++
      if (b.is_trial) trial++; else paid++
      if (b.course_id) courseSet.add(b.course_id)
      if (b.created_at && (!lastBooking || b.created_at > lastBooking)) lastBooking = b.created_at
    })
    recent = (bks || []).slice(0, 6).map((b: any) => ({ id: b.id, status: b.status, isTrial: b.is_trial, course: b.courses?.title || '—', date: b.start_date || b.created_at }))
  } catch {}

  // Enrollments (defensive — table may not exist)
  let enrollments = courseSet.size
  try {
    const { data: en, error: eerr } = await svc.from('enrollments').select('id', { count: 'exact' }).eq('student_id', id)
    if (!eerr && en) enrollments = Math.max(enrollments, en.length)
  } catch {}

  // Engagement / retention
  const lastActivity = [lastBooking, lastPayment].filter(Boolean).sort().pop() as string | null
  const daysSince = lastActivity ? daysBetween(lastActivity) : null
  const engagement = daysSince === null ? 'No activity' : daysSince <= 14 ? 'Active' : daysSince <= 45 ? 'Cooling off' : 'At risk'
  const isRepeatBuyer = paidCount > 1
  const trialToPaid = trial > 0 ? r1((paid / (trial + paid)) * 100) : (paid > 0 ? 100 : 0)

  return NextResponse.json({
    profile: {
      id: p.id, firstName: p.first_name || '', lastName: p.last_name || '', email: p.email || '',
      country: p.country || '', phone: p.phone || '', isActive: p.is_active !== false, createdAt: p.created_at || null,
    },
    metrics: {
      totalSpent: r1(totalSpent), paidCount, enrollments, total, completed, cancelled, upcoming, trial, paid,
      trialToPaid, lastActivity, daysSince, engagement, isRepeatBuyer,
    },
    recent,
  })
}
