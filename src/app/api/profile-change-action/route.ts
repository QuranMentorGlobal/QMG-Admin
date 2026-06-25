// qmg-admin: src/app/api/profile-change-action/route.ts
// ────────────────────────────────────────────────────────────────────────────
// Resolve a teacher profile_change_request (re-verification).
//   approve         → request 'approved', teacher_profiles.status back to 'approved' (re-listed)
//   request_changes → request 'changes_requested', teacher stays unlisted, notified to fix
//   reject          → request 'rejected', teacher stays unlisted, notified
// Notifies the teacher in-app + by email (best-effort). Service-role writes.
// ────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { guard, service, logAudit } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

type Body = {
  requestId: string
  teacherUserId: string
  teacherProfileId: string
  action: 'approve' | 'reject' | 'request_changes'
  notes?: string
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(['verification.approve', 'verification.reject', 'teachers.approve', 'teachers.reject'])
    if ('error' in g) return g.error

    const { requestId, teacherUserId, teacherProfileId, action, notes }: Body = await req.json()
    if (!requestId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const svc = service()
    const newReqStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'changes_requested'

    // 1) Update the change request status (critical — must succeed)
    const { error: rErr } = await svc.from('profile_change_requests')
      .update({ status: newReqStatus })
      .eq('id', requestId)
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })

    // 1b) Best-effort: record admin notes + review timestamp.
    // Skips silently if those columns don't exist yet (run the migration to enable).
    const { error: noteErr } = await svc.from('profile_change_requests')
      .update({ admin_notes: notes || null, reviewed_at: new Date().toISOString() })
      .eq('id', requestId)
    if (noteErr) console.warn('[reverification] notes/reviewed_at not saved:', noteErr.message)

    // 2) On approve, re-list the teacher (status back to approved)
    if (action === 'approve' && teacherProfileId) {
      await svc.from('teacher_profiles').update({ status: 'approved' }).eq('id', teacherProfileId)
    }

    // 3) In-app notification (reuse proven notification types from the schema)
    const title = action === 'approve'
      ? 'Profile Re-Verified ✅'
      : action === 'request_changes'
        ? 'Changes Requested on Your Profile'
        : 'Profile Update Not Approved'
    const body = action === 'approve'
      ? 'Your profile changes were approved and your profile is live to students again.'
      : action === 'request_changes'
        ? `Please review and update your profile. ${notes || 'Some details need adjusting before it can go live.'}`
        : `Your recent profile changes were not approved. ${notes || 'Please revert or correct them.'}`

    if (teacherUserId) {
      try {
        await svc.from('notifications').insert({
          user_id: teacherUserId,
          type: action === 'approve' ? 'booking_confirmed' : 'booking_cancelled',
          title, body,
          href: '/platform/teacher/profile',
        })
      } catch {}
    }

    // 4) Email (best-effort, via the frontend email route)
    try {
      const { data: authUser } = await svc.auth.admin.getUserById(teacherUserId)
      const email = authUser?.user?.email
      const { data: prof } = await svc.from('profiles').select('first_name, last_name').eq('id', teacherUserId).single()
      const name = prof ? `${(prof as any).first_name || ''} ${(prof as any).last_name || ''}`.trim() : 'Teacher'
      if (email) {
        const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.muddarris.com'
        await fetch(`${frontendUrl}/api/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: action === 'approve' ? 'reverification_approved' : 'reverification_changes',
            data: { teacherName: name, teacherEmail: email, action, feedback: notes || null },
          }),
        })
      }
    } catch {}

    await logAudit(g.caller, `reverification.${action}`, 'teacher', teacherProfileId || requestId, { requestId, teacherUserId, notes: notes || null })

    // Auto-update badges (Phase 9): recompute this teacher's badges immediately.
    try {
      const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.muddarris.com'
      await fetch(`${frontendUrl}/api/badges/recompute`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_API_SECRET || '' },
        body: JSON.stringify({ userId: teacherUserId, audience: 'teacher' }),
      })
    } catch (e) { console.error('[badges] recompute trigger failed (non-fatal)', e) }


    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
