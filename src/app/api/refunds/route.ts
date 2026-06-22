// qmg-admin: src/app/api/refunds/route.ts
// ────────────────────────────────────────────────────────────────────────────
// Refunds ledger for the admin Finance view. Reads the `refunds` table written
// by the frontend's /api/bookings/cancel endpoint (student cancel + teacher
// decline of paid bookings). Enriches with student/teacher names + course title,
// and returns totals + breakdowns (by initiator, by reason, last-12-months).
//
// Service-role read — bypasses RLS. Resilient: if the table doesn't exist yet
// (migration not run), returns empty totals instead of 500-ing.
// ────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const r1 = (n: number) => Math.round(n * 10) / 10
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export async function GET() {
  const g = await guard(['payments.view']); if ('error' in g) return g.error
  const svc = service()

  // Pull all refunds (resilient to a missing table / missing columns).
  let res: any = await svc.from('booking_refunds')
    .select('id, booking_id, payment_id, student_id, teacher_id, amount_usd, currency, reason, initiated_by, provider, status, created_at')
    .order('created_at', { ascending: false })
  if (res.error) {
    return NextResponse.json({
      totals: { total: 0, count: 0, thisMonth: 0, students: 0, teachers: 0, admins: 0 },
      byInitiator: [], byMonth: [], topReasons: [], recent: [],
      tableMissing: true,
    })
  }

  const rows: any[] = res.data || []

  // ── Totals ──────────────────────────────────────────────────────────────────
  const total = rows.reduce((s, r) => s + (Number(r.amount_usd) || 0), 0)
  const now = new Date()
  const thisK = monthKey(now)
  const thisMonth = rows
    .filter(r => monthKey(new Date(r.created_at)) === thisK)
    .reduce((s, r) => s + (Number(r.amount_usd) || 0), 0)

  const initAgg: Record<string, { count: number; amount: number }> = {}
  rows.forEach(r => {
    const k = r.initiated_by || 'system'
    initAgg[k] = initAgg[k] || { count: 0, amount: 0 }
    initAgg[k].count++; initAgg[k].amount += Number(r.amount_usd) || 0
  })
  const byInitiator = Object.entries(initAgg)
    .map(([name, v]) => ({ name, count: v.count, amount: r1(v.amount) }))
    .sort((a, b) => b.amount - a.amount)

  // ── Last 12 months ──────────────────────────────────────────────────────────
  const keys: string[] = []
  for (let i = 11; i >= 0; i--) keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  const mMap: Record<string, number> = {}; keys.forEach(k => mMap[k] = 0)
  rows.forEach(r => { const k = monthKey(new Date(r.created_at)); if (k in mMap) mMap[k] += Number(r.amount_usd) || 0 })
  const byMonth = keys.map(k => ({ m: k, amount: r1(mMap[k]) }))

  // ── Top reasons ───────────────────────────────────────────────────────────────
  const reasonAgg: Record<string, number> = {}
  rows.forEach(r => { const k = (r.reason || 'Unspecified').slice(0, 60); reasonAgg[k] = (reasonAgg[k] || 0) + 1 })
  const topReasons = Object.entries(reasonAgg)
    .map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 6)

  // ── Names + course titles for the recent table (cap 80) ──────────────────────
  const recentRaw = rows.slice(0, 80)
  const userIds = new Set<string>()
  const bookingIds = new Set<string>()
  recentRaw.forEach(r => { if (r.student_id) userIds.add(r.student_id); if (r.teacher_id) userIds.add(r.teacher_id); if (r.booking_id) bookingIds.add(r.booking_id) })

  const nameMap: Record<string, string> = {}
  if (userIds.size) {
    try {
      const { data: profs } = await svc.from('profiles').select('id, first_name, last_name').in('id', Array.from(userIds))
      ;(profs || []).forEach((p: any) => { nameMap[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'User' })
    } catch {}
  }

  const courseMap: Record<string, string> = {}
  if (bookingIds.size) {
    try {
      const { data: bks } = await svc.from('bookings').select('id, course_id').in('id', Array.from(bookingIds))
      const cIds = Array.from(new Set((bks || []).map((b: any) => b.course_id).filter(Boolean)))
      const titles: Record<string, string> = {}
      if (cIds.length) {
        const { data: cs } = await svc.from('courses').select('id, title').in('id', cIds)
        ;(cs || []).forEach((c: any) => { titles[c.id] = c.title })
      }
      ;(bks || []).forEach((b: any) => { courseMap[b.id] = titles[b.course_id] || 'Lesson' })
    } catch {}
  }

  const recent = recentRaw.map((r: any) => ({
    id: r.id,
    bookingId: r.booking_id,
    amount: Number(r.amount_usd) || 0,
    currency: r.currency || 'usd',
    reason: r.reason || '—',
    initiatedBy: r.initiated_by || 'system',
    provider: r.provider || 'mock',
    status: r.status || 'succeeded',
    createdAt: r.created_at,
    student: r.student_id ? (nameMap[r.student_id] || 'Unknown') : 'Unknown',
    teacher: r.teacher_id ? (nameMap[r.teacher_id] || 'Unknown') : 'Unknown',
    course: r.booking_id ? (courseMap[r.booking_id] || 'Lesson') : 'Lesson',
  }))

  return NextResponse.json({
    totals: {
      total: r1(total),
      count: rows.length,
      thisMonth: r1(thisMonth),
      students: initAgg['student']?.count || 0,
      teachers: initAgg['teacher']?.count || 0,
      admins: initAgg['admin']?.count || 0,
    },
    byInitiator, byMonth, topReasons, recent,
  })
}
