import { NextResponse } from 'next/server'
import { guard, service, logAudit } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'
export async function POST(req: Request) {
  const g = await guard(['settings.edit']); if ('error' in g) return g.error
  const { settings } = await req.json().catch(() => ({}))
  if (!settings || typeof settings !== 'object') return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  const svc = service()
  const { data: existing } = await svc.from('platform_settings').select('id').single()
  const { error } = (existing as any)?.id
    ? await svc.from('platform_settings').update(settings).eq('id', (existing as any).id)
    : await svc.from('platform_settings').insert(settings)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit(g.caller, 'settings.update', 'settings', (existing as any)?.id ?? 'new', { keys: Object.keys(settings) })
  return NextResponse.json({ ok: true })
}
