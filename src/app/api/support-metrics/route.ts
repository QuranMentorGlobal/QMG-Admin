import { NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'
const r1 = (n: number) => Math.round(n * 10) / 10

export async function GET() {
  const g = await guard(['support.view']); if ('error' in g) return g.error
  const svc = service()

  const { data: raw, error } = await svc.from('support_tickets')
    .select('*, profiles!support_tickets_user_id_fkey(first_name, last_name, email)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tickets = (raw || []).map((t: any) => ({
    id: t.id, subject: t.subject || t.title || 'Support request', message: t.message || t.body || '',
    status: t.status || 'open', priority: t.priority || 'normal', category: t.category || 'general',
    role: t.role || '', adminReply: t.admin_reply || null,
    createdAt: t.created_at, updatedAt: t.updated_at || t.created_at, resolvedAt: t.resolved_at || null,
    userName: t.profiles ? `${t.profiles.first_name || ''} ${t.profiles.last_name || ''}`.trim() : 'Unknown',
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

  // Avg resolution time (hours) — use resolved_at when present, else updated_at as proxy
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
    byCategory: tally('category'), byPriority: tally('priority'),
    tickets,
  })
}
