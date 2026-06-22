import { NextResponse } from 'next/server'
import { getCaller, service } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'

export async function GET() {
  const caller = await getCaller()
  if (!caller.userId || caller.role !== 'admin') return NextResponse.json({ items: [], total: 0 })
  if (caller.status === 'suspended') return NextResponse.json({ items: [], total: 0 })
  const can = (p: string) => caller.adminRole !== 'sub' || caller.permissions.includes(p)
  const svc = service()

  const count = async (fn: () => any): Promise<number> => { try { const { count } = await fn(); return count ?? 0 } catch { return 0 } }
  const items: any[] = []

  if (can('verification.access') || can('teachers.view')) {
    const n = await count(() => svc.from('teacher_profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'))
    if (n > 0) items.push({ type: 'verification', label: 'Teacher applications pending review', count: n, href: '/verification-queue', severity: 'gold' })
    const rv = await count(() => svc.from('profile_change_requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'changes_requested']))
    if (rv > 0) items.push({ type: 'reverification', label: 'Profile changes need re-verification', count: rv, href: '/re-verification', severity: 'gold' })
  }
  if (can('support.view')) {
    const open = await count(() => svc.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'))
    if (open > 0) items.push({ type: 'ticket', label: 'Open support tickets', count: open, href: '/support', severity: 'gold' })
    let urgent = 0
    try { const { count: u } = await svc.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('priority', 'urgent'); urgent = u ?? 0 } catch {}
    if (urgent > 0) items.push({ type: 'urgent', label: 'Urgent tickets need attention', count: urgent, href: '/support', severity: 'red' })
  }
  if (can('support.view')) {
    const openFlags = await count(() => svc.from('conversation_flags').select('id', { count: 'exact', head: true }).eq('status', 'open'))
    if (openFlags > 0) {
      const high = await count(() => svc.from('conversation_flags').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('risk', 'high'))
      items.push({ type: 'moderation', label: high > 0 ? 'High-risk conversations flagged' : 'Conversations flagged for review', count: openFlags, href: '/moderation', severity: high > 0 ? 'red' : 'gold' })
    }
  }
  if (can('analytics.deep')) {
    // Attendance anomaly: students with repeated absences (>= 3).
    try {
      const { data: rows } = await svc.from('lesson_attendance').select('student_id, status').eq('status', 'absent').limit(5000)
      const per: Record<string, number> = {}
      ;((rows as any[]) || []).forEach(r => { if (r.student_id) per[r.student_id] = (per[r.student_id] || 0) + 1 })
      const flagged = Object.values(per).filter(n => n >= 3).length
      if (flagged > 0) items.push({ type: 'attendance_anomaly', label: 'Students with repeated absences', count: flagged, href: '/attendance', severity: 'red' })
    } catch {}
  }
  if (can('payments.view')) {
    const n = await count(() => svc.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'failed'))
    if (n > 0) items.push({ type: 'payment', label: 'Failed payments', count: n, href: '/payments', severity: 'red' })
  }
  if (can('reviews.view')) {
    const n = await count(() => svc.from('reviews').select('id', { count: 'exact', head: true }).eq('is_published', false))
    if (n > 0) items.push({ type: 'review', label: 'Reviews awaiting moderation', count: n, href: '/reviews', severity: 'gold' })
  }
  if (can('bookings.view')) {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const n = await count(() => svc.from('bookings').select('id', { count: 'exact', head: true }).gte('created_at', start.toISOString()))
    if (n > 0) items.push({ type: 'booking', label: 'New bookings today', count: n, href: '/bookings', severity: 'neutral' })
  }

  return NextResponse.json({ items, total: items.reduce((s, i) => s + i.count, 0) })
}
