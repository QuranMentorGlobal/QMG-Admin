// qmg-admin: src/app/api/verification-action/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guard, logAudit } from '@/lib/admin-auth'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type TierAction = {
  teacherProfileId: string
  userId: string
  tier: 'identity' | 'quran_mentor' | 'ijazah' | 'phone'
  action: 'approve' | 'reject'
  notes?: string
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(['verification.approve', 'verification.reject'])
    if ('error' in g) return g.error
    const body: TierAction = await req.json()
    const { teacherProfileId, userId, tier, action, notes } = body

    if (!teacherProfileId || !userId || !tier || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = getAdmin()

    // Build the update object based on tier
    const update: Record<string, any> = {}

    if (notes !== undefined) {
      // Append to existing notes
      const { data: existing } = await supabase
        .from('teacher_profiles')
        .select('verification_notes')
        .eq('id', teacherProfileId)
        .single()

      const timestamp = new Date().toISOString().split('T')[0]
      const newNote = `[${timestamp}] ${tier.toUpperCase()} ${action}: ${notes || 'No notes'}`
      const existingNotes = (existing as any)?.verification_notes || ''
      update.verification_notes = existingNotes
        ? `${existingNotes}\n${newNote}`
        : newNote
    }

    switch (tier) {
      case 'identity':
        update.identity_verified = action === 'approve'
        if (action === 'reject') update.identity_document_url = null
        break
      case 'quran_mentor':
        update.quran_mentor_verified = action === 'approve'
        break
      case 'ijazah':
        update.ijazah_verified = action === 'approve'
        if (action === 'reject') update.ijazah_document_url = null
        break
      case 'phone':
        update.phone_verified = action === 'approve'
        break
      default:
        return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    const { error } = await supabase
      .from('teacher_profiles')
      .update(update)
      .eq('id', teacherProfileId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })


    // Auto-update badges (Phase 9): recompute this teacher's badges immediately.
    try {
      const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.muddarris.com'
      await fetch(`${frontendUrl}/api/badges/recompute`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_API_SECRET || '' },
        body: JSON.stringify({ userId: userId, audience: 'teacher' }),
      })
    } catch (e) { console.error('[badges] recompute trigger failed (non-fatal)', e) }
    await logAudit(g.caller, `verification.${tier}.${action}`, 'teacher', teacherProfileId, { userId, tier, action, notes: notes || null })

    // Send notification to teacher
    const tierLabels: Record<string, string> = {
      identity: 'Identity Verification',
      quran_mentor: 'Quran Mentor Verification',
      ijazah: 'Ijazah Verification',
      phone: 'Phone Verification',
    }

    const notifTitle = action === 'approve'
      ? `${tierLabels[tier]} Approved! 🎉`
      : `${tierLabels[tier]} Update`
    const notifBody = action === 'approve'
      ? `Your ${tierLabels[tier]} has been verified. Your profile now shows this badge.`
      : `Your ${tierLabels[tier]} was not approved. ${notes || 'Please resubmit your documents.'}`

    await supabase.from('notifications').insert({
      user_id: userId,
      type: action === 'approve' ? 'booking_confirmed' : 'booking_cancelled',
      title: notifTitle,
      body: notifBody,
      href: '/platform/teacher/verification',
    })

    // Send email via frontend
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', userId)
      .single()

    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const teacherEmail = authUser?.user?.email
    const teacherName = profile
      ? `${(profile as any).first_name || ''} ${(profile as any).last_name || ''}`.trim()
      : 'Teacher'

    if (teacherEmail) {
      try {
        const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.muddarris.com'
        await fetch(`${frontendUrl}/api/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_API_SECRET || '' },
          body: JSON.stringify({
            type: action === 'approve' ? 'application_approved' : 'application_rejected',
            data: { teacherName, teacherEmail, feedback: notes || null },
          }),
        })
      } catch {}
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
