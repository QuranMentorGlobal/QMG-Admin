import { NextResponse } from 'next/server'
import { guard, service, logAudit } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const g = await guard(['support.manage']); if ('error' in g) return g.error
  const { ticketId, status, reply, priority, category } = await req.json().catch(() => ({}))
  if (!ticketId) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const svc = service()
  const base: any = { updated_at: new Date().toISOString() }
  if (status) base.status = status
  if (typeof reply === 'string') base.admin_reply = reply

  // Optional columns — set them, but retry without if the column doesn't exist
  const optional: any = {}
  if (priority) optional.priority = priority
  if (category) optional.category = category
  if (status === 'resolved' || status === 'closed') optional.resolved_at = new Date().toISOString()

  let { data, error } = await svc.from('support_tickets').update({ ...base, ...optional }).eq('id', ticketId).select('*')
  if (error && /column|does not exist|schema cache|invalid input|enum|constraint|violates/i.test(error.message)) {
    // An optional column/value was rejected — retry with only the columns we trust.
    ;({ data, error } = await svc.from('support_tickets').update(base).eq('id', ticketId).select('*'))
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    // Update ran but matched no row — surface it instead of a silent success.
    return NextResponse.json({ error: 'Ticket not found — nothing was updated.' }, { status: 404 })
  }

  await logAudit(g.caller, 'ticket.update', 'ticket', ticketId, { status: status ?? null, priority: priority ?? null, category: category ?? null })
  return NextResponse.json({ ok: true, ticket: data[0] })
}
