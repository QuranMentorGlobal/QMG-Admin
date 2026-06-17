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

    // Fetch all teachers that need admin attention:
    // - status = pending (new applications awaiting initial approval)
    // - status = approved but have unverified tiers or pending documents
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
        hourly_rate_usd, trial_rate_usd, available_days,
        profile_photo_url, intro_video_url,
        submitted_at, rejection_reason, created_at,
        profiles(first_name, last_name, email, country, phone, bio)
      `)
      .in('status', ['pending', 'approved'])
      .order('submitted_at', { ascending: false, nullsFirst: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
