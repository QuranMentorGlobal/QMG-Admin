import { NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'

// Admin student list — SERVICE ROLE (bypasses RLS on profiles).
export async function GET() {
  const g = await guard(['students.view']); if ('error' in g) return g.error
  const svc = service()
  const { data, error } = await svc.from('profiles')
    .select('*').eq('role', 'student')
    .order('created_at', { ascending: false })
    .limit(100000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
