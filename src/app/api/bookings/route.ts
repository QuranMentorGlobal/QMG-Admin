import { NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'

// Admin bookings list — SERVICE ROLE (bypasses RLS). The browser client would
// only see bookings where the admin is the student/teacher (i.e. none).
export async function GET() {
  const g = await guard(['bookings.view']); if ('error' in g) return g.error
  const svc = service()
  const { data, error } = await svc.from('bookings')
    .select(`*, courses(title),
      student:profiles!bookings_student_id_fkey(first_name, last_name, email),
      teacher:profiles!bookings_teacher_id_fkey(first_name, last_name)`)
    .order('created_at', { ascending: false })
    .limit(100000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
