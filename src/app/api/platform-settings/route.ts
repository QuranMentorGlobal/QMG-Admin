import { NextResponse } from 'next/server'
import { guard, service, logAudit } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'

// Pull the offending column name out of a Postgres / PostgREST error message
function badColumn(msg: string): string | null {
  const m = msg.match(/'([^']+)' column/) || msg.match(/column "([^"]+)"/) || msg.match(/Could not find the '([^']+)'/)
  return m ? m[1] : null
}

export async function POST(req: Request) {
  const g = await guard(['settings.edit']); if ('error' in g) return g.error
  const { settings } = await req.json().catch(() => ({}))
  if (!settings || typeof settings !== 'object') return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const svc = service()
  const { data: existing } = await svc.from('platform_settings').select('id').single()
  const payload: Record<string, any> = { ...settings }
  const stripped: string[] = []

  // Try to save; if a column doesn't exist, drop it and retry (future-proof: any
  // column that DOES exist persists, missing ones are skipped instead of erroring).
  for (let i = 0; i <= Object.keys(settings).length; i++) {
    if (Object.keys(payload).length === 0) break
    const op = (existing as any)?.id
      ? await svc.from('platform_settings').update(payload).eq('id', (existing as any).id)
      : await svc.from('platform_settings').insert(payload)
    if (!op.error) {
      await logAudit(g.caller, 'settings.update', 'settings', (existing as any)?.id ?? 'new', { keys: Object.keys(payload) })
      return NextResponse.json({ ok: true, savedKeys: Object.keys(payload), stripped })
    }
    const col = badColumn(op.error.message)
    if (col && col in payload) { delete payload[col]; stripped.push(col); continue }
    return NextResponse.json({ error: op.error.message }, { status: 500 })
  }
  // Nothing matched existing columns — not an error, just nothing to persist yet
  return NextResponse.json({ ok: true, savedKeys: [], stripped })
}

// Read settings — SERVICE ROLE (bypasses RLS so the admin always sees the row).
export async function GET() {
  const g = await guard(['settings.view']); if ('error' in g) return g.error
  const svc = service()
  const { data, error } = await svc.from('platform_settings').select('*').single()
  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? {})
}
