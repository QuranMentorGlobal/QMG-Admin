// ============================================================
// src/app/api/courses-hub/route.ts
// Comprehensive Courses Hub feed for admin oversight.
// Returns every course (all teachers) joined to the teacher name, grouped by
// product_type (trial / recorded / live / program=Long) with a separate
// COMPLETED bucket (courses the teacher has closed: status='completed').
// Also returns per-type totals (for the dashboard cards) and per-teacher
// completion counts. Service-role read; guarded by teachers.view.
// ============================================================
import { NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// product_type → hub tab key. 'program' is shown as "Long".
function tabOf(productType: string | null | undefined): 'trial' | 'recorded' | 'live' | 'long' {
  if (productType === 'trial')    return 'trial'
  if (productType === 'live')     return 'live'
  if (productType === 'program')  return 'long'
  return 'recorded' // recorded + unknown → recorded
}

export async function GET(req: Request) {
  const g = await guard(['courses.view', 'teachers.view', 'analytics.dashboard'])
  if ('error' in g) return g.error

  const countsOnly = new URL(req.url).searchParams.get('counts') === '1'
  const svc = service()

  // ── Courses (resilient: drop status/closed_at if the migration hasn't run) ──
  let cres: any = await svc.from('courses')
    .select('id, title, product_type, status, is_active, price_usd, trial_price_usd, monthly_price_usd, upfront_price_usd, level, category, course_type, teacher_id, created_at, closed_at')
    .limit(100000)
  if (cres.error) {
    cres = await svc.from('courses')
      .select('id, title, product_type, is_active, price_usd, level, category, course_type, teacher_id, created_at')
      .limit(100000)
  }
  const rawCourses: any[] = cres.data || []

  // ── Counts-only fast path (dashboard cards) ─────────────────────────────────
  if (countsOnly) {
    const c = { trial: 0, recorded: 0, live: 0, long: 0, completed: 0, total: rawCourses.length }
    for (const r of rawCourses) {
      if (r.status === 'completed') c.completed++
      else c[tabOf(r.product_type)]++
    }
    return NextResponse.json({ counts: c })
  }

  // ── Teacher names ───────────────────────────────────────────────────────────
  const teacherIds = Array.from(new Set(rawCourses.map(c => c.teacher_id).filter(Boolean)))
  const nameMap: Record<string, string> = {}
  if (teacherIds.length) {
    const { data: profs } = await svc.from('profiles')
      .select('id, first_name, last_name').in('id', teacherIds)
    ;((profs as any[]) || []).forEach(p => {
      nameMap[p.id] = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Teacher'
    })
  }

  // ── Enrollment counts per course (light) ────────────────────────────────────
  const enrollCount: Record<string, number> = {}
  try {
    let eres: any = await svc.from('enrollments').select('course_id').limit(100000)
    ;((eres.data as any[]) || []).forEach(e => {
      if (e.course_id) enrollCount[e.course_id] = (enrollCount[e.course_id] || 0) + 1
    })
  } catch { /* enrollments optional */ }

  // ── Shape + bucket ──────────────────────────────────────────────────────────
  const counts = { trial: 0, recorded: 0, live: 0, long: 0, completed: 0, total: rawCourses.length }
  const byTeacherCompleted: Record<string, { teacherId: string; teacherName: string; completed: number }> = {}

  const courses = rawCourses.map(c => {
    const closed = c.status === 'completed'
    const tab = tabOf(c.product_type)
    if (closed) {
      counts.completed++
      const t = (byTeacherCompleted[c.teacher_id] ||= { teacherId: c.teacher_id, teacherName: nameMap[c.teacher_id] || 'Teacher', completed: 0 })
      t.completed++
    } else {
      counts[tab]++
    }
    const price =
      c.product_type === 'trial'   ? (Number(c.trial_price_usd) || Number(c.price_usd) || 0) :
      c.product_type === 'program' ? (Number(c.monthly_price_usd) || Number(c.upfront_price_usd) || Number(c.price_usd) || 0) :
      (Number(c.price_usd) || 0)
    return {
      id: c.id,
      title: c.title || 'Untitled course',
      tab,                                  // trial | recorded | live | long
      productType: c.product_type || 'recorded',
      closed,                               // true → Completed bucket
      status: c.status || (c.is_active ? 'active' : 'inactive'),
      isActive: !!c.is_active,
      teacherId: c.teacher_id,
      teacherName: nameMap[c.teacher_id] || 'Teacher',
      level: c.level || null,
      category: c.category || c.course_type || null,
      price,
      enrollments: enrollCount[c.id] || 0,
      createdAt: c.created_at || null,
      closedAt: c.closed_at || null,
    }
  })

  const teacherCompletions = Object.values(byTeacherCompleted).sort((a, b) => b.completed - a.completed)

  return NextResponse.json({ courses, counts, teacherCompletions })
}
