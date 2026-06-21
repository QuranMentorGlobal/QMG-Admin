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
    // select('*') is intentional — see header note.
    let res: any = await supabase
      .from('teacher_profiles')
      .select('*, profiles(first_name, last_name, email, country, phone, bio)')
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })

    // Fallback: if the profiles embed isn't available in this schema, retry plain.
    if (res.error) {
      res = await supabase
        .from('teacher_profiles')
        .select('*')
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false })
    }

    if (res.error) {
      return NextResponse.json({ error: res.error.message }, { status: 500 })
    }

    return NextResponse.json(res.data ?? [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
