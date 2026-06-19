import { NextResponse } from 'next/server'
import { guard, service, logAudit } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'
export async function POST(req: Request) {
  const g = await guard(['students.toggle']); if ('error' in g) return g.error
  const { userId, isActive } = await req.json().catch(() => ({}))
  if (!userId || typeof isActive !== 'boolean') return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  const { error } = await service().from('profiles').update({ is_active: isActive }).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit(g.caller, isActive ? 'student.activate' : 'student.deactivate', 'student', userId, { isActive })
  return NextResponse.json({ ok: true })
}
