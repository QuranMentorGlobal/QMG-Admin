import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { id, userId, action, reason } = await req.json()

    if (!id || !userId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = getAdmin()

    // Update teacher_profiles status
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

    // Update profiles.is_active
    await supabase
      .from('profiles')
      .update({ is_active: action === 'approved' })
      .eq('id', userId)

    // Insert notification for the teacher
    const notifTitle = action === 'approved'
      ? 'Application Approved! 🎉'
      : 'Application Update'
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

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
