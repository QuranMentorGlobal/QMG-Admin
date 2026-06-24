import { NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'
const r1 = (n: number) => Math.round(n * 10) / 10

export async function GET() {
  // Auth handled by middleware (admin-only on /api/*); read via service role.
  const svc = service()

  // Resilient fetch. Earlier this ordered by created_at in BOTH the embed query
  // AND the fallback, so if that column/embed was unavailable the whole route
  // returned empty — while the sidebar badge (an order-less COUNT) still saw the
  // ticket. We now never depend on order/embed: try richest → plainest, then
  // sort in JS. Rows are only lost if the table itself is unreadable.
  let raw: any[] = []
  let r: any = await svc.from('support_tickets')
    .select('*, profiles!support_tickets_user_id_fkey(first_name, last_name, email)')
  if (r.error) r = await svc.from('support_tickets').select('*')
  if (r.error) r = await svc.from('support_tickets').select('id, subject, message, status, priority, category, user_id, admin_reply, created_at, updated_at, resolved_at')
  if (r.error) return NextResponse.json({ metrics: { total: 0, open: 0, inProgress: 0, resolved: 0, urgentOpen: 0, responded: 0, responseRate: 0, resolutionRate: 0, avgResolutionHours: 0 }, byCategory: [], byPriority: [], tickets: [], error: r.error.message })
  raw = r.data || []
  // Newest first, defensively (created_at may be missing on some rows).
  raw.sort((a: any, b: any) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())

  const tickets = raw.map((t: any) => ({
    id: t.id, subject: t.subject || t.title || 'Support request', message: t.message || t.body || '',
    status: t.status || 'open', priority: t.priority || 'normal', category: t.category || 'general',
    role: t.role || '', adminReply: t.admin_reply || null,
    createdAt: t.created_at, updatedAt: t.updated_at || t.created_at, resolvedAt: t.resolved_at || null,
    userName: t.profiles ? `${t.profiles.first_name || ''} ${t.profiles.last_name || ''}`.trim() || 'Unknown' : 'Unknown',
    userEmail: t.profiles?.email || '', userId: t.user_id,
  }))

  const total = tickets.length
  const open = tickets.filter((t: any) => t.status === 'open').length
  const inProgress = tickets.filter((t: any) => t.status === 'in_progress').length
  const resolved = tickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length
  const urgentOpen = tickets.filter((t: any) => t.priority === 'urgent' && t.status === 'open').length
  const responded = tickets.filter((t: any) => !!t.adminReply).length
  const responseRate = total ? Math.round((responded / total) * 100) : 0
  const resolutionRate = total ? Math.round((resolved / total) * 100) : 0

  const resolvedTk = tickets.filter((t: any) => (t.status === 'resolved' || t.status === 'closed'))
  let avgResolutionHours = 0
  if (resolvedTk.length) {
    const sum = resolvedTk.reduce((s: number, t: any) => {
      const end = new Date(t.resolvedAt || t.updatedAt).getTime(); const start = new Date(t.createdAt).getTime()
      return s + Math.max(0, (end - start) / 3600000)
    }, 0)
    avgResolutionHours = r1(sum / resolvedTk.length)
  }

  const tally = (key: string) => {
    const m: Record<string, number> = {}
    tickets.forEach((t: any) => { const k = t[key] || 'unknown'; m[k] = (m[k] || 0) + 1 })
    return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  }

  return NextResponse.json({
    metrics: { total, open, inProgress, resolved, urgentOpen, responded, responseRate, resolutionRate, avgResolutionHours },
    byCategory: tally('category'), byPriority: tally('priority'), tickets,
  })
}
