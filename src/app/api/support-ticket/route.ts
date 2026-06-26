// PASTE INTO: src/app/api/support-ticket/route.ts
// Updates a support ticket (status / reply / priority / category) via service role.
// Hardened: layered retry that peels optional columns, AND an honest persistence
// check — the row returned by .select() is post-write (after any BEFORE trigger),
// so if the saved status differs from the requested one we report it instead of a
// silent "success". That makes a status-reverting DB trigger impossible to miss.
import { NextResponse } from 'next/server'
import { guard, service, logAudit } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'

const COLUMN_ERR = /column|does not exist|schema cache|could not find/i

export async function POST(req: Request) {
  const g = await guard(['support.manage']); if ('error' in g) return g.error
  const { ticketId, status, reply, priority, category } = await req.json().catch(() => ({}))
  if (!ticketId) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const svc = service()

  // Core columns we trust exist; optional ones may not be present on every schema.
  const core: any = { updated_at: new Date().toISOString() }
  if (status) core.status = status
  if (typeof reply === 'string') core.admin_reply = reply

  const optional: any = {}
  if (priority) optional.priority = priority
  if (category) optional.category = category
  if (status === 'resolved' || status === 'closed') optional.resolved_at = new Date().toISOString()

  const run = (payload: any) =>
    svc.from('support_tickets').update(payload).eq('id', ticketId).select('*')

  // 1) full → 2) drop optional cols → 3) drop admin_reply too (last resort)
  let { data, error } = await run({ ...core, ...optional })
  if (error && COLUMN_ERR.test(error.message)) {
    ;({ data, error } = await run(core))
  }
  if (error && COLUMN_ERR.test(error.message) && 'admin_reply' in core) {
    const { admin_reply, ...slim } = core
    ;({ data, error } = await run(slim))
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Ticket not found — nothing was updated.' }, { status: 404 })
  }

  const saved = data[0]

  // Honest persistence check: did the status we asked for actually stick?
  if (status && saved.status !== status) {
    return NextResponse.json({
      ok: false,
      persistedStatus: saved.status,
      requestedStatus: status,
      error: `The status was saved as "${saved.status}" instead of "${status}". A database trigger or rule on support_tickets is overriding it — run the support diagnostic SQL to find and fix it.`,
      ticket: saved,
    }, { status: 409 })
  }

  await logAudit(g.caller, 'ticket.update', 'ticket', ticketId, { status: status ?? null, priority: priority ?? null, category: category ?? null })
  return NextResponse.json({ ok: true, ticket: saved })
}
