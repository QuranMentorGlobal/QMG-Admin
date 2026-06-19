import { NextResponse } from 'next/server'
import { guard, service, logAudit } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'
export async function POST(req: Request) {
  const g = await guard(['support.manage']); if ('error' in g) return g.error
  const { ticketId, status, reply } = await req.json().catch(() => ({}))
  if (!ticketId) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  const patch: any = { updated_at: new Date().toISOString() }
  if (status) patch.status = status
  if (typeof reply === 'string') patch.admin_reply = reply
  const { error } = await service().from('support_tickets').update(patch).eq('id', ticketId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit(g.caller, 'ticket.update', 'ticket', ticketId, { status: status ?? null })
  return NextResponse.json({ ok: true })
}
