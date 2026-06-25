// ============================================================
// FOR qmg-admin REPO → src/app/api/admin-payouts/route.ts
// Manual-payout LIFECYCLE — the single source of truth for every admin/finance
// transition (Phase F2). Service role; verifies the caller and enforces the
// two finance roles:
//   • finance.review  → under_review | approve | reject | request_info
//   • finance.process → processing | complete | fail
//   (super-admins bypass both.)
//
// Earnings stay the source of truth (teacher_earnings):
//   reject / fail → reserved earnings (payout_pending → available) AND any
//   settled clawback adjustments are returned to the pool.
//   complete      → reserved earnings → paid (+ paid_at).
// Every transition writes teacher_payout_events + admin_audit_log + notifies.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

function svc() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const REVIEW_ACTIONS  = ['under_review', 'approve', 'reject', 'request_info']
const PROCESS_ACTIONS = ['processing', 'complete', 'fail']

// Which prior statuses each action is allowed from.
const ALLOWED_FROM: Record<string, string[]> = {
  under_review: ['requested', 'pending'],
  approve:      ['requested', 'pending', 'under_review'],
  reject:       ['requested', 'pending', 'under_review', 'approved'],
  request_info: ['requested', 'pending', 'under_review'],
  processing:   ['approved'],
  complete:     ['approved', 'processing'],
  fail:         ['approved', 'processing'],
}

async function logEvent(admin: any, payoutId: string, actorId: string | null, actorRole: string, action: string, from: string | null, to: string | null, note?: string, metadata?: any) {
  try {
    await admin.from('teacher_payout_events').insert({
      payout_id: payoutId, actor_id: actorId, actor_role: actorRole,
      action, from_status: from, to_status: to, note: note || null, metadata: metadata || null,
    })
  } catch {}
}

async function logAudit(admin: any, actorId: string | null, actorName: string, action: string, targetId: string, details: any) {
  try {
    await admin.from('admin_audit_log').insert({
      actor_id: actorId, actor_name: actorName, action,
      target_type: 'payout', target_id: targetId, details: details ?? null,
    })
  } catch {}
}

async function notifyUser(admin: any, userId: string, notif: { title: string; body: string; href: string; type?: string }) {
  try { await admin.from('notifications').insert({ user_id: userId, type: notif.type || 'booking_confirmed', title: notif.title, body: notif.body, href: notif.href }) } catch {}
}

async function notifyByPerm(admin: any, perm: string, notif: { title: string; body: string; href: string }) {
  try {
    const { data } = await admin.from('profiles').select('id, admin_role, admin_permissions').eq('role', 'admin')
    const ids = (data || [])
      .filter((p: any) => p.admin_role !== 'sub' || (Array.isArray(p.admin_permissions) && p.admin_permissions.includes(perm)))
      .map((p: any) => p.id)
    for (const id of ids) await admin.from('notifications').insert({ user_id: id, type: 'booking_confirmed', ...notif })
  } catch {}
}

// Return reserved earnings + settled clawback adjustments to the available pool.
async function restoreBalance(admin: any, payoutId: string) {
  const now = new Date().toISOString()
  await admin.from('teacher_earnings')
    .update({ status: 'available', payout_id: null, updated_at: now })
    .eq('payout_id', payoutId).eq('status', 'payout_pending')
  await admin.from('teacher_adjustments')
    .update({ payout_id: null }).eq('payout_id', payoutId)
}

export async function POST(request: NextRequest) {
  const admin = svc()

  // ── Authn + caller context ─────────────────────────────────────────────────
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: prof } = await admin.from('profiles')
    .select('role, admin_role, admin_permissions, admin_status, first_name, last_name')
    .eq('id', user.id).single()
  if (!prof || prof.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  if (prof.admin_status === 'suspended') return NextResponse.json({ error: 'Account suspended' }, { status: 403 })

  const isSuper = prof.admin_role !== 'sub'
  const perms: string[] = Array.isArray(prof.admin_permissions) ? prof.admin_permissions : []
  const can = (p: string) => isSuper || perms.includes(p)
  const actorName = `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || 'Admin'
  const actorRole = isSuper ? 'admin' : 'finance'

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Bad body' }, { status: 400 }) }
  const { action, payoutId } = body
  if (!payoutId || !action) return NextResponse.json({ error: 'payoutId and action required' }, { status: 400 })

  // ── Permission split ────────────────────────────────────────────────────────
  if (REVIEW_ACTIONS.includes(action) && !can('finance.review')) {
    return NextResponse.json({ error: 'You need the Payout Reviewer (finance.review) permission.' }, { status: 403 })
  }
  if (PROCESS_ACTIONS.includes(action) && !can('finance.process')) {
    return NextResponse.json({ error: 'You need the Payment Processor (finance.process) permission.' }, { status: 403 })
  }
  if (!REVIEW_ACTIONS.includes(action) && !PROCESS_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  // ── Load + validate transition ──────────────────────────────────────────────
  const { data: payout } = await admin.from('teacher_payouts')
    .select('id, teacher_id, amount_usd, status').eq('id', payoutId).single()
  if (!payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
  const from = String(payout.status)
  const allowed = ALLOWED_FROM[action] || []
  if (!allowed.includes(from)) {
    return NextResponse.json({ error: `Cannot ${action} a payout that is '${from}'.` }, { status: 409 })
  }
  const now = new Date().toISOString()
  const amt = Number(payout.amount_usd) || 0
  const teacherId = payout.teacher_id

  // ── REVIEW actions ──────────────────────────────────────────────────────────
  if (action === 'under_review') {
    await admin.from('teacher_payouts').update({ status: 'under_review', under_review_at: now, under_review_by: user.id }).eq('id', payoutId)
    await logEvent(admin, payoutId, user.id, actorRole, 'under_review', from, 'under_review')
    await logAudit(admin, user.id, actorName, 'payout.under_review', payoutId, { amount: amt })
    return NextResponse.json({ success: true, status: 'under_review' })
  }

  if (action === 'request_info') {
    const note = body.note || body.reason || null
    await admin.from('teacher_payouts').update({ status: 'under_review', info_requested: true, info_request_note: note, under_review_at: now, under_review_by: user.id }).eq('id', payoutId)
    await logEvent(admin, payoutId, user.id, actorRole, 'info_requested', from, 'under_review', note)
    await logAudit(admin, user.id, actorName, 'payout.request_info', payoutId, { note })
    await notifyUser(admin, teacherId, { title: 'Payout — Information Requested', body: `Finance needs more details on your $${amt.toFixed(2)} payout.${note ? ' ' + note : ''}`, href: '/platform/teacher/earnings', type: 'booking_confirmed' })
    return NextResponse.json({ success: true, status: 'under_review', info_requested: true })
  }

  if (action === 'approve') {
    await admin.from('teacher_payouts').update({ status: 'approved', approved_by: user.id, approved_at: now, info_requested: false }).eq('id', payoutId)
    await logEvent(admin, payoutId, user.id, actorRole, 'approved', from, 'approved')
    await logAudit(admin, user.id, actorName, 'payout.approve', payoutId, { amount: amt })
    await notifyUser(admin, teacherId, { title: 'Payout Approved', body: `Your $${amt.toFixed(2)} payout was approved and is now with the finance team.`, href: '/platform/teacher/earnings' })
    await notifyByPerm(admin, 'finance.process', { title: 'Payout Ready to Process', body: `An approved $${amt.toFixed(2)} payout is awaiting payment.`, href: '/payouts' })
    return NextResponse.json({ success: true, status: 'approved' })
  }

  if (action === 'reject') {
    await restoreBalance(admin, payoutId)
    await admin.from('teacher_payouts').update({ status: 'rejected', rejected_by: user.id, rejected_at: now, rejection_reason: body.reason || 'Not specified' }).eq('id', payoutId)
    await logEvent(admin, payoutId, user.id, actorRole, 'rejected', from, 'rejected', body.reason || null)
    await logEvent(admin, payoutId, user.id, actorRole, 'balance_restored', 'rejected', 'rejected', 'Reserved earnings + adjustments returned to available')
    await logAudit(admin, user.id, actorName, 'payout.reject', payoutId, { amount: amt, reason: body.reason || null })
    await notifyUser(admin, teacherId, { title: 'Payout Rejected', body: `Your $${amt.toFixed(2)} payout was rejected and the balance returned to available.${body.reason ? ' Reason: ' + body.reason : ''}`, href: '/platform/teacher/earnings', type: 'booking_cancelled' })
    return NextResponse.json({ success: true, status: 'rejected' })
  }

  // ── PROCESS actions ─────────────────────────────────────────────────────────
  if (action === 'processing') {
    await admin.from('teacher_payouts').update({ status: 'processing', processing_at: now, processing_by: user.id, payment_method_used: body.payment_method_used || null }).eq('id', payoutId)
    await logEvent(admin, payoutId, user.id, actorRole, 'processing', from, 'processing', body.payment_method_used || null)
    await logAudit(admin, user.id, actorName, 'payout.processing', payoutId, { method: body.payment_method_used || null })
    return NextResponse.json({ success: true, status: 'processing' })
  }

  if (action === 'complete') {
    // Reserved earnings → paid.
    await admin.from('teacher_earnings')
      .update({ status: 'paid', paid_at: now, updated_at: now })
      .eq('payout_id', payoutId).eq('status', 'payout_pending')
    await admin.from('teacher_payouts').update({
      status: 'completed',
      completed_at: now, paid_at: now, processed_at: now, processed_by: user.id,
      reference: body.reference_number || body.reference || null,
      reference_number: body.reference_number || body.reference || null,
      transaction_id: body.transaction_id || null,
      payment_method_used: body.payment_method_used || null,
      payment_proof_url: body.payment_proof_url || null,
      finance_notes: body.finance_notes || null,
    }).eq('id', payoutId)
    if (body.payment_proof_url) {
      await logEvent(admin, payoutId, user.id, actorRole, 'proof_uploaded', from, from, null, { path: body.payment_proof_url })
    }
    await logEvent(admin, payoutId, user.id, actorRole, 'completed', from, 'completed', body.reference_number || null, { transaction_id: body.transaction_id || null, method: body.payment_method_used || null })
    await logAudit(admin, user.id, actorName, 'payout.complete', payoutId, { amount: amt, reference: body.reference_number || null, method: body.payment_method_used || null })
    await notifyUser(admin, teacherId, { title: 'Payout Paid 🎉', body: `Your $${amt.toFixed(2)} payout has been sent${body.reference_number ? ' (ref ' + body.reference_number + ')' : ''}.`, href: '/platform/teacher/earnings' })
    await notifyByPerm(admin, 'finance.review', { title: 'Payout Completed', body: `A $${amt.toFixed(2)} payout was marked paid.`, href: '/payouts' })
    return NextResponse.json({ success: true, status: 'completed' })
  }

  if (action === 'fail') {
    await restoreBalance(admin, payoutId)
    await admin.from('teacher_payouts').update({ status: 'failed', failure_reason: body.reason || body.failure_reason || 'Payment failed', processed_by: user.id, processed_at: now }).eq('id', payoutId)
    await logEvent(admin, payoutId, user.id, actorRole, 'failed', from, 'failed', body.reason || body.failure_reason || null)
    await logEvent(admin, payoutId, user.id, actorRole, 'balance_restored', 'failed', 'failed', 'Reserved earnings + adjustments returned to available')
    await logAudit(admin, user.id, actorName, 'payout.fail', payoutId, { amount: amt, reason: body.reason || body.failure_reason || null })
    await notifyUser(admin, teacherId, { title: 'Payout Failed', body: `Your $${amt.toFixed(2)} payout could not be completed and the balance was returned to available. Please re-check your payout details.`, href: '/platform/teacher/earnings', type: 'booking_cancelled' })
    await notifyByPerm(admin, 'finance.review', { title: 'Payout Failed', body: `A $${amt.toFixed(2)} payout failed and the balance was restored.`, href: '/payouts' })
    return NextResponse.json({ success: true, status: 'failed' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
