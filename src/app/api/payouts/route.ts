import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
}

// Admin payout-requests list — SERVICE ROLE. Teacher names stitched in JS.
export async function GET() {
  const s = svc()
  const { data, error } = await s.from('teacher_payouts')
    .select('*').order('requested_at', { ascending: false, nullsFirst: false }).limit(100000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows: any[] = data || []
  const ids = Array.from(new Set(rows.map(r => r.teacher_id).filter(Boolean)))
  const { data: profs } = ids.length
    ? await s.from('profiles').select('id, first_name, last_name').in('id', ids)
    : { data: [] } as any
  const pMap: Record<string, any> = {}; ((profs as any[]) || []).forEach(p => { pMap[p.id] = p })
  return NextResponse.json(
    rows.map(r => ({ ...r, profiles: r.teacher_id ? (pMap[r.teacher_id] || null) : null })),
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
  )
}
