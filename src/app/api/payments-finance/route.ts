import { NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'
const r1 = (n: number) => Math.round(n * 10) / 10
const growth = (cur: number, prev: number) => prev > 0 ? r1(((cur - prev) / prev) * 100) : (cur > 0 ? 100 : 0)
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export async function GET() {
  const g = await guard(['payments.view']); if ('error' in g) return g.error
  const svc = service()

  // Resilient: drop optional columns (provider/payment_type) if they don't exist.
  // [6.1] Explicit high limit on every variant — Supabase silently caps at 1000.
  let pres: any = await svc.from('payments').select('gross_amount_usd, platform_fee_usd, teacher_payout_usd, status, provider, payment_type, created_at, teacher_id').limit(100000)
  if (pres.error) pres = await svc.from('payments').select('gross_amount_usd, platform_fee_usd, teacher_payout_usd, status, created_at, teacher_id').limit(100000)
  if (pres.error) pres = await svc.from('payments').select('gross_amount_usd, platform_fee_usd, status, created_at').limit(100000)
  const all: any[] = pres.data || []
  const ok = all.filter(p => p.status === 'succeeded')

  // Totals
  const gross = ok.reduce((s, p) => s + (Number(p.gross_amount_usd) || 0), 0)
  const commission = ok.reduce((s, p) => s + (Number(p.platform_fee_usd) || 0), 0)
  const payout = ok.reduce((s, p) => s + (Number(p.teacher_payout_usd) || 0), 0)
  const counts = { succeeded: ok.length, failed: all.filter(p => p.status === 'failed').length, refunded: all.filter(p => p.status === 'refunded').length, pending: all.filter(p => p.status === 'pending').length, total: all.length }
  // [6.2] AOV over PAID orders only (exclude $0 / trial rows that deflate it).
  const paidOrders = ok.filter(p => (Number(p.gross_amount_usd) || 0) > 0 && p.payment_type !== 'trial')
  const paidGross = paidOrders.reduce((s, p) => s + (Number(p.gross_amount_usd) || 0), 0)
  const aov = paidOrders.length ? r1(paidGross / paidOrders.length) : 0

  // Last 12 months series
  const now = new Date(); const keys: string[] = []
  for (let i = 11; i >= 0; i--) keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  const mMap: Record<string, any> = {}
  keys.forEach(k => mMap[k] = { m: k, gross: 0, commission: 0, payout: 0 })
  ok.forEach(p => { const k = monthKey(new Date(p.created_at)); if (mMap[k]) { mMap[k].gross += Number(p.gross_amount_usd) || 0; mMap[k].commission += Number(p.platform_fee_usd) || 0; mMap[k].payout += Number(p.teacher_payout_usd) || 0 } })
  const byMonth = keys.map(k => ({ m: k, gross: r1(mMap[k].gross), commission: r1(mMap[k].commission), payout: r1(mMap[k].payout) }))

  // This vs last month
  const thisK = keys[11], lastK = keys[10]
  const monthly = { thisMonth: r1(mMap[thisK].gross), lastMonth: r1(mMap[lastK].gross), growth: growth(mMap[thisK].gross, mMap[lastK].gross) }

  // Breakdown by type + provider
  const byType: Record<string, { count: number; gross: number }> = {}
  const byProvider: Record<string, { count: number; gross: number }> = {}
  ok.forEach(p => {
    const t = p.payment_type || 'other'; (byType[t] = byType[t] || { count: 0, gross: 0 }); byType[t].count++; byType[t].gross += Number(p.gross_amount_usd) || 0
    const pr = p.provider || 'other'; (byProvider[pr] = byProvider[pr] || { count: 0, gross: 0 }); byProvider[pr].count++; byProvider[pr].gross += Number(p.gross_amount_usd) || 0
  })
  const typeBreakdown = Object.entries(byType).map(([k, v]) => ({ name: k, count: v.count, gross: r1(v.gross) })).sort((a, b) => b.gross - a.gross)
  const providerBreakdown = Object.entries(byProvider).map(([k, v]) => ({ name: k, count: v.count, gross: r1(v.gross) })).sort((a, b) => b.gross - a.gross)

  // Top payout teachers
  const tAgg: Record<string, { payout: number; count: number }> = {}
  ok.forEach(p => { const id = p.teacher_id; if (!id) return; (tAgg[id] = tAgg[id] || { payout: 0, count: 0 }); tAgg[id].payout += Number(p.teacher_payout_usd) || 0; tAgg[id].count++ })
  const tIds = Object.keys(tAgg)
  const nameMap: Record<string, string> = {}
  if (tIds.length) {
    const { data: profs } = await svc.from('profiles').select('id, first_name, last_name').in('id', tIds)
    ;(profs || []).forEach((p: any) => nameMap[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Teacher')
  }
  const topPayouts = tIds.map(id => ({ name: nameMap[id] || 'Teacher', payout: r1(tAgg[id].payout), count: tAgg[id].count })).sort((a, b) => b.payout - a.payout).slice(0, 6)

  // Forecast next month (least squares on byMonth gross)
  let forecast = 0
  const ys = byMonth.map(x => x.gross)
  const n = ys.length
  if (n >= 2) {
    const xs = ys.map((_, i) => i)
    const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0)
    const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0), sxx = xs.reduce((a, x) => a + x * x, 0)
    const denom = n * sxx - sx * sx
    if (denom !== 0) { const slope = (n * sxy - sx * sy) / denom; const intercept = (sy - slope * sx) / n; forecast = Math.max(0, r1(slope * n + intercept)) }
  }

  // Recent transactions (with names)
  let rcRes: any = await svc.from('payments')
    .select(`id, gross_amount_usd, platform_fee_usd, teacher_payout_usd, status, provider, payment_type, created_at,
      student:profiles!payments_student_id_fkey(first_name, last_name),
      teacher:profiles!payments_teacher_id_fkey(first_name, last_name)`)
    .order('created_at', { ascending: false }).limit(60)
  if (rcRes.error) rcRes = await svc.from('payments')
    .select('id, gross_amount_usd, platform_fee_usd, teacher_payout_usd, status, provider, payment_type, created_at')
    .order('created_at', { ascending: false }).limit(60)
  const recentRaw = rcRes.data || []
  const recent = (recentRaw || []).map((p: any) => ({
    id: p.id, gross: Number(p.gross_amount_usd) || 0, commission: Number(p.platform_fee_usd) || 0, payout: Number(p.teacher_payout_usd) || 0,
    status: p.status, provider: p.provider, type: p.payment_type, createdAt: p.created_at,
    student: p.student ? `${p.student.first_name || ''} ${p.student.last_name || ''}`.trim() : 'Unknown',
    teacher: p.teacher ? `${p.teacher.first_name || ''} ${p.teacher.last_name || ''}`.trim() : 'Unknown',
  }))

  return NextResponse.json({
    totals: { gross: r1(gross), commission: r1(commission), payout: r1(payout), aov, ...counts },
    monthly, byMonth, typeBreakdown, providerBreakdown, topPayouts, forecast, recent,
  })
}
