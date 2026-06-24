import { NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'

// Admin approved-teacher list — SERVICE ROLE (bypasses RLS).
export async function GET() {
  const g = await guard(['teachers.view']); if ('error' in g) return g.error
  const svc = service()
  const { data, error } = await svc.from('teacher_profiles')
    .select('*, profiles(first_name, last_name, email, country, is_active)')
    .eq('status', 'approved')
    .order('id', { ascending: false })
    .limit(100000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
