// src/app/api/exchange-rate/route.ts
// ────────────────────────────────────────────────────────────────────────────
// Manual USD→PKR rate. Admin-set, updated monthly. This is the single rate used
// to convert a Pakistani teacher's USD (international) earning into PKR. The FX
// cron skips pkr, so this value is never overwritten by the auto feed.
// ────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { guard, service, logAudit } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guard(['settings.view']); if ('error' in g) return g.error
  const svc = service()
  const { data } = await svc.from('exchange_rates')
    .select('rate, updated_at')
    .eq('base_currency', 'usd').eq('quote_currency', 'pkr').maybeSingle()
  return NextResponse.json({ rate: Number(data?.rate) || null, updated_at: data?.updated_at || null })
}

export async function POST(req: Request) {
  const g = await guard(['settings.edit']); if ('error' in g) return g.error
  const { rate } = await req.json().catch(() => ({}))
  const r = Number(rate)
  if (!Number.isFinite(r) || r <= 0) {
    return NextResponse.json({ error: 'Enter a valid rate greater than 0.' }, { status: 400 })
  }
  const svc = service()
  const now = new Date().toISOString()
  const { data: existing } = await svc.from('exchange_rates')
    .select('rate').eq('base_currency', 'usd').eq('quote_currency', 'pkr').maybeSingle()
  const op = existing
    ? await svc.from('exchange_rates').update({ rate: r, updated_at: now })
        .eq('base_currency', 'usd').eq('quote_currency', 'pkr')
    : await svc.from('exchange_rates').insert({ base_currency: 'usd', quote_currency: 'pkr', rate: r, updated_at: now })
  if (op.error) return NextResponse.json({ error: op.error.message }, { status: 500 })
  await logAudit(g.caller, 'settings.exchange_rate', 'exchange_rate', 'usd_pkr', { rate: r })
  return NextResponse.json({ ok: true, rate: r, updated_at: now })
}
