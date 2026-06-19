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
  await logAudit(g.caller, status === 'suspended' ? 'teacher.suspend' : 'teacher.reinstate', 'teacher', teacherProfileId, { userId, status })
  return NextResponse.json({ ok: true })
}
