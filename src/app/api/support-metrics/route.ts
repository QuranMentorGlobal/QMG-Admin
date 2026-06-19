import { NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'
const r1 = (n: number) => Math.round(n * 10) / 10

export async function GET() {
  const g = await guard(['support.view']); if ('error' in g) return g.error
  const svc = service()

  // Resilient fetch: try with the profiles join, fall back to a plain select if the
  // FK/embed isn't available in this schema (prevents a 500 → blank page).
  let raw: any[] = []
  let r: any = await svc.from('support_tickets')
    .select('*, profiles!support_tickets_user_id_fkey(first_name, last_name, email)')
    .order('created_at', { ascending: false })
  if (r.error) r = await svc.from('support_tickets').select('*').order('created_at', { ascending: false })
  if (r.error) return NextResponse.json({ metrics: { total: 0, open: 0, inProgress: 0, resolved: 0, urgentOpen: 0, responded: 0, responseRate: 0, resolutionRate: 0, avgResolutionHours: 0 }, byCategory: [], byPriority: [], tickets: [] })
  raw = r.data || []

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
