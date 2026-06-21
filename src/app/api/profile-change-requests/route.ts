// qmg-admin: src/app/api/profile-change-requests/route.ts
// ────────────────────────────────────────────────────────────────────────────
// Re-verification queue feed. Returns teacher profile_change_requests that still
// need admin attention (pending / changes_requested), enriched with the teacher's
// name + email and their CURRENT teacher_profiles.status (so the UI can show who
// is currently unlisted awaiting re-approval).
//
// Service-role read — bypasses RLS. Resilient: if the table doesn't exist yet or
// a join fails, returns an empty list instead of 500-ing the page.
// ────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  try {
    const supabase = getAdmin()

    const { data: reqs, error } = await supabase
      .from('profile_change_requests')
      .select('*')
      .in('status', ['pending', 'changes_requested'])
      .order('created_at', { ascending: false })

    // Table missing or other error → empty queue, never crash the page.
    if (error) return NextResponse.json([])
    const rows = reqs ?? []
    if (rows.length === 0) return NextResponse.json([])

    // Enrich with teacher name/email + current status (best-effort).
    const userIds = Array.from(new Set(rows.map((r: any) => r.teacher_user_id).filter(Boolean)))
    const profileIds = Array.from(new Set(rows.map((r: any) => r.teacher_profile_id).filter(Boolean)))

    const profMap: Record<string, any> = {}
    try {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])
      ;(profs ?? []).forEach((p: any) => { profMap[p.id] = p })
    } catch {}

    const statusMap: Record<string, string> = {}
    try {
      const { data: tps } = await supabase
        .from('teacher_profiles')
        .select('id, status')
        .in('id', profileIds.length ? profileIds : ['00000000-0000-0000-0000-000000000000'])
      ;(tps ?? []).forEach((t: any) => { statusMap[t.id] = t.status })
    } catch {}

    const enriched = rows.map((r: any) => {
      const p = profMap[r.teacher_user_id] || {}
      return {
        id: r.id,
        teacher_user_id: r.teacher_user_id,
        teacher_profile_id: r.teacher_profile_id,
        change_type: r.change_type || 'minor',
        status: r.status || 'pending',
        changes: r.changes || {},
        admin_notes: r.admin_notes || null,
        created_at: r.created_at,
        teacher_name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Teacher',
        teacher_email: p.email || '',
        current_status: statusMap[r.teacher_profile_id] || null,
      }
    })

    return NextResponse.json(enriched)
  } catch (err: any) {
    return NextResponse.json([])
  }
}
