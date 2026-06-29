// ============================================================
// FOR qmg-admin REPO → src/app/api/admin-withdrawals/route.ts
// Wallet WITHDRAWAL lifecycle — mirror of admin-payouts. Service role; verifies
// the caller and enforces the SAME two finance roles:
//   • finance.review  → under_review | approve | reject | request_info
//   • finance.process → processing | complete | fail
//   (super-admins bypass both.)
//
// Funds live in the wallet ledger (wallet_transactions). A withdrawal RESERVES
// funds with a pending 'withdrawal' row:
//   reject / fail → reservation pending → 'failed'  (withdrawable restored).
//   complete      → reservation pending → 'completed' (spendable balance drops).
// Every transition writes wallet_withdrawal_events + admin_audit_log + notifies.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function svc() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const REVIEW_ACTIONS  = ['under_review', 'approve', 'reject', 'request_info']
const PROCESS_ACTIONS = ['processing', 'complete', 'fail']

const ALLOWED_FROM: Record<string, string[]> = {
  under_review: ['requested'],
  approve:      ['requested', 'under_review'],
  reject:       ['requested', 'under_review', 'approved'],
  request_info: ['requested', 'under_review'],
  processing:   ['approved'],
  complete:     ['approved', 'processing'],
  fail:         ['approved', 'processing'],
}

async function logEvent(admin: any, withdrawalId: string, actorId: string | null, action: string, from: string | null, to: string | null, note?: string) {
  try {
    await admin.from('wallet_withdrawal_events').insert({
      withdrawal_id: withdrawalId, actor_id: actorId, action, from_status: from, to_status: to, note: note || null,
    })
  } catch {}
}

async function logAudit(admin: any, actorId: string | null, actorName: string, action: string, targetId: string, details: any) {
  try {
    await admin.from('admin_audit_log').insert({
      actor_id: actorId, actor_name: actorName, action,
      target_type: 'wallet_withdrawal', target_id: targetId, details: details ?? null,
    })
  } catch {}
}

async function notifyUser(admin: any, userId: string, notif: { title: string; body: string; href: string; type?: string }) {
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.muddarris.com'
  try {
    const res = await fetch(`${frontendUrl}/api/notify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_API_SECRET || '' },
      body: JSON.stringify({ userId, type: notif.type || 'admin_action', title: notif.title, body: notif.body, href: notif.href, relatedType: 'wallet_withdrawal' }),
    })
    if (res.ok) return
  } catch {}
  try { await admin.from('notifications').insert({ user_id: userId, type: notif.type || 'admin_action', title: notif.title, body: notif.body, href: notif.href }) } catch {}
}

async function notifyByPerm(admin: any, perm: string, notif: { title: string; body: string; href: string }) {
  try {
    const { data } = await admin.from('profiles').select('id, admin_role, admin_permissions').eq('role', 'admin')
    const ids = (data || [])
      .filter((p: any) => p.admin_role !== 'sub' || (Array.isArray(p.admin_permissions) && p.admin_permissions.includes(perm)))
      .map((p: any) => p.id)
    for (const id of ids) await admin.from('notifications').insert({ user_id: id, type: 'admin_action', ...notif })
  } catch {}
}

// Move the reserving ledger row pending → newStatus ('failed' restores funds; 'completed' finalizes).
async function moveReservation(admin: any, w: any, newStatus: 'failed' | 'completed') {
  try {
    if (w.ledger_tx_id) {
      await admin.from('wallet_transactions').update({ status: newStatus }).eq('id', w.ledger_tx_id).eq('status', 'pending')
    } else {
      await admin.from('wallet_transactions').update({ status: newStatus })
        .eq('type', 'withdrawal').eq('status', 'pending').contains('metadata', { withdrawal_id: w.id })
    }
  } catch {}
}

async function caller(request: NextRequest, admin: any) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: prof } = await admin.from('profiles')
    .select('role, admin_role, admin_permissions, admin_status, first_name, last_name')
    .eq('id', user.id).single()
  if (!prof || prof.role !== 'admin') return { error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) }
  if (prof.admin_status === 'suspended') return { error: NextResponse.json({ error: 'Account suspended' }, { status: 403 }) }
  const isSuper = prof.admin_role !== 'sub'
  const perms: string[] = Array.isArray(prof.admin_permissions) ? prof.admin_permissions : []
  return {
    user, isSuper, perms,
    can: (p: string) => isSuper || perms.includes(p),
    actorName: `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || 'Admin',
  }
}

// ── GET: list withdrawals for the finance queue ───────────────────────────────
export async function GET(request: NextRequest) {
  const admin = svc()
  const c = await caller(request, admin)
  if ('error' in c) return c.error
  if (!c.can('finance.review') && !c.can('finance.process')) {
    return NextResponse.json({ error: 'Finance permission required.' }, { status: 403 })
  }
  const { data: rows } = await admin.from('wallet_withdrawals')
    .select('id, user_id, amount_usd, status, method, account_name, account_number, account_extra, reject_reason, requested_at, processed_at, created_at')
    .order('created_at', { ascending: false }).limit(500)
  const ids = Array.from(new Set((rows || []).map((r: any) => r.user_id)))
  const nameMap: Record<string, any> = {}
  if (ids.length) {
    const { data: profs } = await admin.from('profiles').select('id, first_name, last_name, email').in('id', ids)
    ;(profs || []).forEach((p: any) => { nameMap[p.id] = p })
  }
  const out = (rows || []).map((r: any) => ({
    ...r,
    user_name: `${nameMap[r.user_id]?.first_name || ''} ${nameMap[r.user_id]?.last_name || ''}`.trim() || 'User',
    user_email: nameMap[r.user_id]?.email || null,
  }))
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } })
}

// ── POST: lifecycle actions ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const admin = svc()
  const c = await caller(request, admin)
  if ('error' in c) return c.error
  const { user, can, actorName } = c

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Bad body' }, { status: 400 }) }
  const { action, withdrawalId } = body
  if (!withdrawalId || !action) return NextResponse.json({ error: 'withdrawalId and action required' }, { status: 400 })

  if (REVIEW_ACTIONS.includes(action) && !can('finance.review')) {
    return NextResponse.json({ error: 'You need the Reviewer (finance.review) permission.' }, { status: 403 })
  }
  if (PROCESS_ACTIONS.includes(action) && !can('finance.process')) {
    return NextResponse.json({ error: 'You need the Processor (finance.process) permission.' }, { status: 403 })
  }
  if (!REVIEW_ACTIONS.includes(action) && !PROCESS_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const { data: w } = await admin.from('wallet_withdrawals')
    .select('id, user_id, amount_usd, status, ledger_tx_id').eq('id', withdrawalId).single()
  if (!w) return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
  const from = String(w.status)
  if (!(ALLOWED_FROM[action] || []).includes(from)) {
    return NextResponse.json({ error: `Cannot ${action} a withdrawal that is '${from}'.` }, { status: 409 })
  }
  const now = new Date().toISOString()
  const amt = Number(w.amount_usd) || 0
  const userId = w.user_id
  const href = '/platform/student/billing?tab=wallet'

  if (action === 'under_review') {
    await admin.from('wallet_withdrawals').update({ status: 'under_review', updated_at: now }).eq('id', w.id)
    await logEvent(admin, w.id, user.id, 'under_review', from, 'under_review')
    await logAudit(admin, user.id, actorName, 'withdrawal.under_review', w.id, { amount: amt })
    return NextResponse.json({ success: true, status: 'under_review' })
  }

  if (action === 'request_info') {
    const note = body.note || body.reason || null
    await admin.from('wallet_withdrawals').update({ status: 'under_review', updated_at: now }).eq('id', w.id)
    await logEvent(admin, w.id, user.id, 'info_requested', from, 'under_review', note)
    await logAudit(admin, user.id, actorName, 'withdrawal.request_info', w.id, { note })
    await notifyUser(admin, userId, { title: 'Withdrawal — Information Requested', body: `Finance needs more details on your $${amt.toFixed(2)} withdrawal.${note ? ' ' + note : ''}`, href })
    return NextResponse.json({ success: true, status: 'under_review' })
  }

  if (action === 'approve') {
    await admin.from('wallet_withdrawals').update({ status: 'approved', updated_at: now }).eq('id', w.id)
    await logEvent(admin, w.id, user.id, 'approved', from, 'approved')
    await logAudit(admin, user.id, actorName, 'withdrawal.approve', w.id, { amount: amt })
    await notifyUser(admin, userId, { type: 'wallet_withdrawal_approved', title: 'Withdrawal Approved', body: `Your $${amt.toFixed(2)} withdrawal was approved and is queued for payment.`, href })
    await notifyByPerm(admin, 'finance.process', { title: 'Withdrawal Ready to Process', body: `An approved $${amt.toFixed(2)} withdrawal is awaiting payment.`, href: '/withdrawals' })
    return NextResponse.json({ success: true, status: 'approved' })
  }

  if (action === 'reject') {
    await moveReservation(admin, w, 'failed')   // funds restored to withdrawable
    await admin.from('wallet_withdrawals').update({ status: 'rejected', reject_reason: body.reason || 'Not specified', processed_by: user.id, processed_at: now, updated_at: now }).eq('id', w.id)
    await logEvent(admin, w.id, user.id, 'rejected', from, 'rejected', body.reason || null)
    await logEvent(admin, w.id, user.id, 'funds_restored', 'rejected', 'rejected', 'Reserved funds returned to withdrawable')
    await logAudit(admin, user.id, actorName, 'withdrawal.reject', w.id, { amount: amt, reason: body.reason || null })
    await notifyUser(admin, userId, { title: 'Withdrawal Rejected', body: `Your $${amt.toFixed(2)} withdrawal was rejected and the funds returned to your wallet.${body.reason ? ' Reason: ' + body.reason : ''}`, href })
    return NextResponse.json({ success: true, status: 'rejected' })
  }

  if (action === 'processing') {
    await admin.from('wallet_withdrawals').update({ status: 'processing', processed_by: user.id, updated_at: now }).eq('id', w.id)
    await logEvent(admin, w.id, user.id, 'processing', from, 'processing', body.payment_method_used || null)
    await logAudit(admin, user.id, actorName, 'withdrawal.processing', w.id, { method: body.payment_method_used || null })
    return NextResponse.json({ success: true, status: 'processing' })
  }

  if (action === 'complete') {
    await moveReservation(admin, w, 'completed') // spendable balance drops
    await admin.from('wallet_withdrawals').update({ status: 'completed', processed_by: user.id, processed_at: now, updated_at: now }).eq('id', w.id)
    await logEvent(admin, w.id, user.id, 'completed', from, 'completed', body.reference || body.reference_number || null)
    await logAudit(admin, user.id, actorName, 'withdrawal.complete', w.id, { amount: amt, reference: body.reference || body.reference_number || null })
    await notifyUser(admin, userId, { type: 'wallet_withdrawal_completed', title: 'Withdrawal Paid 🎉', body: `Your $${amt.toFixed(2)} withdrawal has been sent${body.reference || body.reference_number ? ' (ref ' + (body.reference || body.reference_number) + ')' : ''}.`, href })
    await notifyByPerm(admin, 'finance.review', { title: 'Withdrawal Completed', body: `A $${amt.toFixed(2)} withdrawal was marked paid.`, href: '/withdrawals' })
    return NextResponse.json({ success: true, status: 'completed' })
  }

  if (action === 'fail') {
    await moveReservation(admin, w, 'failed')   // funds restored to withdrawable
    await admin.from('wallet_withdrawals').update({ status: 'failed', reject_reason: body.reason || body.failure_reason || 'Payment failed', processed_by: user.id, processed_at: now, updated_at: now }).eq('id', w.id)
    await logEvent(admin, w.id, user.id, 'failed', from, 'failed', body.reason || body.failure_reason || null)
    await logEvent(admin, w.id, user.id, 'funds_restored', 'failed', 'failed', 'Reserved funds returned to withdrawable')
    await logAudit(admin, user.id, actorName, 'withdrawal.fail', w.id, { amount: amt, reason: body.reason || body.failure_reason || null })
    await notifyUser(admin, userId, { title: 'Withdrawal Failed', body: `Your $${amt.toFixed(2)} withdrawal could not be completed and the funds were returned to your wallet. Please re-check your account details.`, href })
    await notifyByPerm(admin, 'finance.review', { title: 'Withdrawal Failed', body: `A $${amt.toFixed(2)} withdrawal failed and the funds were restored.`, href: '/withdrawals' })
    return NextResponse.json({ success: true, status: 'failed' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
