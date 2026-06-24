import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

// Admin bookings list — SERVICE ROLE (bypasses RLS). Middleware already
// guarantees only an authenticated admin reaches /api/*. Relations are stitched
// in JS so the result never depends on FK-embed availability.
function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
}

export async function GET() {
  const s = svc()
  const { data, error } = await s.from('bookings').select('*').order('created_at', { ascending: false }).limit(100000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows: any[] = data || []
  const courseIds = Array.from(new Set(rows.map(b => b.course_id).filter(Boolean)))
  const userIds = Array.from(new Set(rows.flatMap(b => [b.student_id, b.teacher_id]).filter(Boolean)))
  const [coursesRes, profsRes] = await Promise.all([
    courseIds.length ? s.from('courses').select('id, title').in('id', courseIds) : Promise.resolve({ data: [] } as any),
    userIds.length ? s.from('profiles').select('id, first_name, last_name, email').in('id', userIds) : Promise.resolve({ data: [] } as any),
  ])
  const cMap: Record<string, any> = {}; ((coursesRes.data as any[]) || []).forEach(c => { cMap[c.id] = c })
  const pMap: Record<string, any> = {}; ((profsRes.data as any[]) || []).forEach(p => { pMap[p.id] = p })
  const out = rows.map(b => ({
    ...b,
    courses: b.course_id && cMap[b.course_id] ? { title: cMap[b.course_id].title } : null,
    student: b.student_id ? (pMap[b.student_id] || null) : null,
    teacher: b.teacher_id ? (pMap[b.teacher_id] || null) : null,
  }))
  return NextResponse.json(out)
}
