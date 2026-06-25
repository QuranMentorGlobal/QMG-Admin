import { NextResponse } from 'next/server'
import { guard, service, logAudit } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'
export async function POST(req: Request) {
  const g = await guard(['teachers.suspend']); if ('error' in g) return g.error
  const { teacherProfileId, userId, status } = await req.json().catch(() => ({}))
  if (!teacherProfileId || !userId || !['approved', 'suspended'].includes(status))
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  const svc = service(), isActive = status === 'approved'
  const { error } = await svc.from('teacher_profiles').update({ status }).eq('id', teacherProfileId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await svc.from('profiles').update({ is_active: isActive }).eq('id', userId)

    // Auto-update badges (Phase 9): recompute this teacher's badges immediately.
    try {
      const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.muddarris.com'
      await fetch(`${frontendUrl}/api/badges/recompute`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_API_SECRET || '' },
        body: JSON.stringify({ userId: userId, audience: 'teacher' }),
      })
    } catch (e) { console.error('[badges] recompute trigger failed (non-fatal)', e) }
  await logAudit(g.caller, status === 'suspended' ? 'teacher.suspend' : 'teacher.reinstate', 'teacher', teacherProfileId, { userId, status })
  return NextResponse.json({ ok: true })
}
