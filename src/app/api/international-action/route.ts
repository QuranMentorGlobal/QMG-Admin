// qmg-admin: src/app/api/international-action/route.ts
// ────────────────────────────────────────────────────────────────────────────
// Approve or reject a Pakistani teacher's INTERNATIONAL capability (USD rate to
// students outside Pakistan). This is separate from teacher verification — it
// gates only international visibility; the teacher stays live to Pakistani
// students at their PKR rate regardless.
// ────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guard, logAudit } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

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

    const { id, userId, action } = await req.json()
    if (!id || !action) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    if (!['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    const supabase = getAdmin()
    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    const { error } = await supabase
      .from('teacher_profiles')
      .update({ international_status: newStatus })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit(
      g.caller,
      action === 'approve' ? 'international.approve' : 'international.reject',
      'teacher', id, { userId: userId || null }
    )

    // Best-effort in-app notification to the teacher.
    if (userId) {
      try {
        await supabase.from('notifications').insert({
          user_id: userId,
          type: action === 'approve' ? 'international_approved' : 'international_rejected',
          title: action === 'approve' ? 'International teaching approved' : 'International teaching not approved',
          body: action === 'approve'
            ? 'Your USD rate is now live to students outside Pakistan.'
            : 'Your request to teach students outside Pakistan was not approved. You can contact support to appeal.',
          href: '/platform/teacher/profile',
        })
      } catch { /* notification is best-effort */ }
    }

    return NextResponse.json({ ok: true, status: newStatus }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
