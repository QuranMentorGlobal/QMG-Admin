// qmg-admin: src/app/api/verification-queue/route.ts
// ────────────────────────────────────────────────────────────────────────────
// Resilient verification queue fetch.
// Uses select('*') instead of an explicit column list so the query can NEVER
// fail because a tier-verification column (email_verified, phone_verified,
// identity_verified, quran_mentor_verified, verification_notes, etc.) is missing
// from the table. A single missing column in an explicit select makes PostgREST
// reject the WHOLE request, which previously returned an empty queue even when
// pending applications existed.
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

    // Teachers needing admin attention: new applications (pending) + already-
    // approved teachers (so tier upgrades / new documents remain reviewable).
    // We fetch teacher_profiles WITHOUT a join embed — an embed can silently
    // drop a row if the relationship resolves oddly, which would hide a pending
    // application. Profiles are fetched separately and merged back in.
    const res: any = await supabase
      .from('teacher_profiles')
      .select('*')
      .in('status', ['pending', 'approved', 'rejected', 'changes_requested', 'pending_review'])
      .order('created_at', { ascending: false })

    if (res.error) {
      return NextResponse.json({ error: res.error.message }, { status: 500 })
    }

    const rows: any[] = res.data ?? []

    // Attach the public-ish profile fields the queue UI shows (best effort).
    try {
      const ids = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)))
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, country, phone, bio')
          .in('id', ids)
        const byId = new Map((profs ?? []).map((p: any) => [p.id, p]))
        for (const r of rows) r.profiles = byId.get(r.user_id) || null
      }
    } catch { /* names are optional — never let this hide a row */ }

    return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
