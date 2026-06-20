// ============================================================
// FOR qmg-admin REPO → src/app/api/admin-payouts/route.ts
// Admin payout actions — service role, verifies admin identity
// ============================================================
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const { createClient } = require('@supabase/supabase-js')
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify admin
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (prof?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Bad body' }, { status: 400 }) }
  const { action, payoutId } = body
  if (!payoutId) return NextResponse.json({ error: 'payoutId required' }, { status: 400 })

  if (action === 'approve') {
    await admin.from('teacher_payouts').update({
      status: 'approved', approved_by: user.id, approved_at: new Date().toISOString(),
    }).eq('id', payoutId)
    return NextResponse.json({ success: true })
  }
  if (action === 'reject') {
    await admin.from('teacher_payouts').update({
      status: 'rejected', rejected_by: user.id, rejected_at: new Date().toISOString(),
      rejection_reason: body.reason || 'Not specified',
    }).eq('id', payoutId)
    return NextResponse.json({ success: true })
  }
  if (action === 'complete') {
    await admin.from('teacher_payouts').update({
      status: 'completed', completed_at: new Date().toISOString(), reference: body.reference || null,
    }).eq('id', payoutId)
    return NextResponse.json({ success: true })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
