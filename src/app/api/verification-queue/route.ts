// qmg-admin: src/app/api/verification-queue/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  try {
    const supabase = getAdmin()

    // Fetch all approved teachers (for tier-level verification)
    // plus all pending teachers (for initial approval)
    const { data, error } = await supabase
      .from('teacher_profiles')
      .select(`
        id, user_id, status,
        email_verified, phone_verified,
        identity_verified, identity_document_url,
        quran_mentor_verified,
        ijazah_verified, ijazah_document_url,
        verification_notes,
        years_experience, specializations, teaching_languages,
        profile_photo_url, intro_video_url,
        submitted_at, created_at,
        profiles(first_name, last_name, email, country, phone, bio)
      `)
      .in('status', ['pending', 'approved'])
      .order('submitted_at', { ascending: false, nullsFirst: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Filter to only those with something to review:
    // - status = pending (initial approval)
    // - has identity_document_url but not identity_verified
    // - has ijazah_document_url but not ijazah_verified
    // - is approved but not quran_mentor_verified (manual review)
    const queue = (data ?? []).filter((t: any) => {
      if (t.status === 'pending') return true
      if (t.identity_document_url && !t.identity_verified) return true
      if (t.ijazah_document_url && !t.ijazah_verified) return true
      // Show approved teachers who aren't fully verified yet (for admin to review QM tier)
      if (t.status === 'approved' && !t.quran_mentor_verified) return true
      return false
    })

    return NextResponse.json(queue)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
