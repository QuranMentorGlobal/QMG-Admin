import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
}

// Admin approved-teacher list — SERVICE ROLE. Profiles stitched in JS.
export async function GET() {
  const s = svc()
  const { data, error } = await s.from('teacher_profiles')
    .select('*').eq('status', 'approved').order('id', { ascending: false }).limit(100000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows: any[] = data || []
  const userIds = Array.from(new Set(rows.map(t => t.user_id).filter(Boolean)))
  const { data: profs } = userIds.length
    ? await s.from('profiles').select('id, first_name, last_name, email, country, is_active').in('id', userIds)
    : { data: [] } as any
  const pMap: Record<string, any> = {}; ((profs as any[]) || []).forEach(p => { pMap[p.id] = p })
  return NextResponse.json(rows.map(t => ({ ...t, profiles: t.user_id ? (pMap[t.user_id] || null) : null })))
}
