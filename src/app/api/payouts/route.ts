import { NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'

// Admin payout-requests list — SERVICE ROLE (bypasses RLS on teacher_payouts).
export async function GET() {
  const g = await guard(['payments.view']); if ('error' in g) return g.error
  const svc = service()
  const { data, error } = await svc.from('teacher_payouts')
    .select('*, profiles!teacher_payouts_teacher_id_fkey(first_name, last_name)')
    .order('requested_at', { ascending: false, nullsFirst: false })
    .limit(100000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
