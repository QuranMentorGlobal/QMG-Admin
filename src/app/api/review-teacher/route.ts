import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guard, logAudit } from '@/lib/admin-auth'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(['teachers.approve', 'teachers.reject', 'verification.approve', 'verification.reject'])
    if ('error' in g) return g.error
    const { id, userId, action, reason } = await req.json()

    if (!id || !userId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = getAdmin()

    // 1. Update teacher_profiles status
    const { error: tpError } = await supabase
      .from('teacher_profiles')
      .update({
        status: action,
        rejection_reason: reason || null,
      })
      .eq('id', id)

    if (tpError) {
      return NextResponse.json({ error: tpError.message }, { status: 500 })
    }

    // 2. Update profiles.is_active
    await supabase
      .from('profiles')
      .update({ is_active: action === 'approved' })
      .eq('id', userId)

    // 3. Get teacher name + email for notification
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const teacherEmail = authUser?.user?.email

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', userId)
      .single()

    const teacherName = profile
      ? `${(profile as any).first_name || ''} ${(profile as any).last_name || ''}`.trim()
      : 'Teacher'

    // 4. In-platform notification
    const notifTitle = action === 'approved' ? 'Application Approved! 🎉' : 'Application Update'
    const notifBody = action === 'approved'
      ? 'Congratulations! Your teacher application has been approved. You can now receive bookings.'
      : `Your application was not approved. Reason: ${reason || 'Please contact support for details.'}`

    await supabase.from('notifications').insert({
      user_id: userId,
      type: action === 'approved' ? 'booking_confirmed' : 'booking_cancelled',
      title: notifTitle,
      body: notifBody,
      href: '/platform/teacher/verification',
    })

    // 5. Send email via frontend email API
    if (teacherEmail) {
      try {
        const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.quranmentorglobal.com'
        await fetch(`${frontendUrl}/api/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: action === 'approved' ? 'application_approved' : 'application_rejected',
            data: {
              teacherName,
              teacherEmail,
              feedback: reason || null,
            },
          }),
        })
      } catch (emailErr) {
        // Non-fatal — status already updated
        console.error('[review-teacher] Email send failed (non-fatal):', emailErr)
      }
    }

    await logAudit(g.caller, action === 'approved' ? 'teacher.approve' : 'teacher.reject', 'teacher', id, { userId, reason: reason || null })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
