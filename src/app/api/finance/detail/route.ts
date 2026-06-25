// qmg-admin: src/app/api/finance/detail/route.ts
// ────────────────────────────────────────────────────────────────────────────
// Full detail for one payout: the row, its lifecycle timeline
// (teacher_payout_events with actor names), and a short-lived signed URL for the
// payment proof if one exists. Requires any finance permission. (Phase F3)
// ────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(['finance.view', 'finance.review', 'finance.process'])
  if ('error' in g) return g.error

  const payoutId = new URL(req.url).searchParams.get('payoutId')
  if (!payoutId) return NextResponse.json({ error: 'payoutId required' }, { status: 400 })

  const svc = service()

  const { data: payout, error } = await svc.from('teacher_payouts').select('*').eq('id', payoutId).single()
  if (error || !payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 })

  // Timeline.
  const { data: rawEvents } = await svc.from('teacher_payout_events')
    .select('id, actor_id, actor_role, action, from_status, to_status, note, created_at')
    .eq('payout_id', payoutId).order('created_at', { ascending: true })
  const events = rawEvents || []

  // Actor names (events + processed_by/approved_by).
  const ids = new Set<string>()
  events.forEach((e: any) => { if (e.actor_id) ids.add(e.actor_id) })
  ;[payout.processed_by, payout.approved_by, payout.rejected_by, payout.under_review_by].forEach((x: any) => { if (x) ids.add(x) })
  const names: Record<string, string> = {}
  if (ids.size) {
    const { data: profs } = await svc.from('profiles').select('id, first_name, last_name').in('id', Array.from(ids))
    ;(profs || []).forEach((p: any) => { names[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Admin' })
  }

  // Signed proof URL (5 min).
  let proofUrl: string | null = null
  if (payout.payment_proof_url) {
    const { data: signed } = await svc.storage.from('payout-proofs').createSignedUrl(payout.payment_proof_url, 300)
    proofUrl = signed?.signedUrl || null
  }

  return NextResponse.json({
    payout,
    processedByName: payout.processed_by ? (names[payout.processed_by] || null) : null,
    approvedByName: payout.approved_by ? (names[payout.approved_by] || null) : null,
    events: events.map((e: any) => ({ ...e, actor_name: e.actor_id ? (names[e.actor_id] || 'System') : 'System' })),
    proofUrl,
  })
}
