// qmg-admin: src/app/api/finance/reports/route.ts
// ────────────────────────────────────────────────────────────────────────────
// Lightweight financial report for finance users (any finance permission).
// Numbers are derived from the same sources as the rest of the platform:
//   • teacher_payouts  → pipeline counts/amounts by status + paid-out trend
//   • teacher_earnings → teacher liability (money owed, not yet paid)
// No new money math — mirrors /api/stats. (Phase F5)
// ────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const STATUSES = ['requested', 'under_review', 'approved', 'processing', 'completed', 'rejected', 'failed']

export async function GET(req: Request) {
  // Read-only finance aggregates. Raw service-role client (like /api/stats) so a
  // guard() auth hiccup can't blank the whole report. The /finance-reports PAGE
  // remains permission-gated by middleware.
  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const sp = new URL(req.url).searchParams
  const range = sp.get('range') || 'all'
  const from = sp.get('from') || ''
  const to = sp.get('to') || ''

  // Window payouts by requested_at (same field the Payout Management list uses).
  // Custom from/to takes precedence over a preset range. If no row has a usable
  // date, the filter is a no-op so the report is never accidentally blanked.
  function windowList<T extends { requested_at?: string | null }>(list: T[]): T[] {
    const hasCustom = !!(from || to)
    if (!hasCustom && (!range || range === 'all')) return list
    const fromT = from ? new Date(from + 'T00:00:00').getTime()
      : (range && range !== 'all' ? Date.now() - (Number(range) || 0) * 86400000 : -Infinity)
    const toT = to ? new Date(to + 'T23:59:59').getTime() : Infinity
    let anyValid = false
    const out = list.filter(p => {
      const v = p.requested_at; if (!v) return false
      const t = new Date(v as any).getTime(); if (!Number.isFinite(t)) return false
      anyValid = true; return t >= fromT && t <= toT
    })
    return anyValid ? out : list
  }

  // Payouts → pipeline + paid-out trend.
  const byStatus: Record<string, { count: number; amount: number }> = {}
  STATUSES.forEach(s => { byStatus[s] = { count: 0, amount: 0 } })
  let totalPaidOut = 0
  const monthly: Record<string, number> = {}
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthly[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0
  }

  const recent: any[] = []
  try {
    const { data: po } = await svc.from('teacher_payouts')
      .select('id, teacher_id, amount_usd, status, requested_at, approved_at, paid_at, completed_at, payment_method_used, reference_number, processed_by')
      .order('created_at', { ascending: false }).limit(100000)
    const list = windowList((po || []) as any[])

    // Resolve teacher names for the recent-completed table.
    const completed = list.filter(p => String(p.status) === 'completed').slice(0, 20)
    const ids = Array.from(new Set(completed.map(p => p.teacher_id).filter(Boolean)))
    const names: Record<string, string> = {}
    if (ids.length) {
      const { data: profs } = await svc.from('profiles').select('id, first_name, last_name').in('id', ids)
      ;(profs || []).forEach((p: any) => { names[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Teacher' })
    }

    for (const p of list) {
      const st = String(p.status)
      const amt = Number(p.amount_usd) || 0
      const key = st === 'pending' ? 'requested' : st
      if (byStatus[key]) { byStatus[key].count += 1; byStatus[key].amount += amt }
      if (st === 'completed') {
        totalPaidOut += amt
        const when = p.paid_at || p.completed_at
        if (when) {
          const d = new Date(when)
          const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (mk in monthly) monthly[mk] += amt
        }
      }
    }

    completed.forEach(p => recent.push({
      id: p.id,
      teacher_name: names[p.teacher_id] || 'Teacher',
      amount_usd: Number(p.amount_usd) || 0,
      paid_at: p.paid_at || p.completed_at,
      method: p.payment_method_used,
      reference: p.reference_number,
    }))
  } catch {}

  // Teacher liability from the earnings ledger.
  let teacherLiability = 0
  try {
    const { data: earn } = await svc.from('teacher_earnings').select('net_amount_usd, status').limit(100000)
    ;(earn || []).forEach((e: any) => {
      if (['pending', 'available', 'payout_pending'].includes(String(e.status))) teacherLiability += Number(e.net_amount_usd) || 0
    })
  } catch {}

  const r2 = (n: number) => Math.round(n * 100) / 100
  Object.keys(byStatus).forEach(k => { byStatus[k].amount = r2(byStatus[k].amount) })

  return NextResponse.json({
    byStatus,
    totalPaidOut: r2(totalPaidOut),
    teacherLiability: r2(teacherLiability),
    monthlyPaidOut: Object.entries(monthly).map(([month, amount]) => ({ month, amount: r2(amount as number) })),
    recentCompleted: recent,
  })
}
