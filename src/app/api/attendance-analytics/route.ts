// qmg-admin: src/app/api/attendance-analytics/route.ts
// ────────────────────────────────────────────────────────────────────────────
// Platform-wide attendance analytics (Phase 5). Service-role read over the
// unified lesson_attendance table, enriched with teacher/student names and
// course titles. Returns overall rate, by-teacher, by-course, monthly trend,
// most-absent and most-reliable students. Resilient: empty payload if the table
// isn't there yet. (v1 reads recent rows with a cap; can move to a DB rollup
// later for very large datasets.)
// ────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const MAX_ROWS = 100000
const rate = (p: number, l: number, a: number) => { const d = p + l + a; return d > 0 ? Math.round(((p + l) / d) * 100) : 0 }
type Bucket = { present: number; late: number; absent: number; excused: number }
const newBucket = (): Bucket => ({ present: 0, late: 0, absent: 0, excused: 0 })
const add = (b: Bucket, s: string) => { if (s === 'present') b.present++; else if (s === 'late') b.late++; else if (s === 'absent') b.absent++; else if (s === 'excused') b.excused++ }

const EMPTY = { overall: { ...newBucket(), rate: 0, total: 0 }, byTeacher: [], byCourse: [], monthly: [], mostAbsent: [], mostReliable: [] }

export async function GET(req: Request) {
  try {
    const admin = getAdmin()
    const range = new URL(req.url).searchParams.get('range') || 'all'
    const days = range === 'all' ? null : (Number(range) || null)
    const cutoffISO = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : null

    let query = admin
      .from('lesson_attendance')
      .select('booking_id, student_id, teacher_id, status, marked_at')
      .order('marked_at', { ascending: false })
      .limit(MAX_ROWS)
    if (cutoffISO) query = query.gte('marked_at', cutoffISO)
    const { data: rows, error } = await query
    if (error) return NextResponse.json(EMPTY)
    const att = ((rows as any[]) || []).filter(r => ['present', 'late', 'absent', 'excused'].includes(r.status))
    if (att.length === 0) return NextResponse.json(EMPTY)

    // Enrich: bookings → course_id + date; courses → title; profiles → names.
    const bookingIds = Array.from(new Set(att.map(r => r.booking_id).filter(Boolean)))
    const bMap: Record<string, any> = {}
    try {
      const { data: bks } = await admin.from('bookings').select('id, course_id, start_date').in('id', bookingIds)
      ;(bks || []).forEach((b: any) => { bMap[b.id] = b })
    } catch {}

    const courseIds = Array.from(new Set(Object.values(bMap).map((b: any) => b.course_id).filter(Boolean)))
    const cMap: Record<string, string> = {}
    try {
      const { data: cs } = await admin.from('courses').select('id, title').in('id', courseIds.length ? courseIds : ['x'])
      ;(cs || []).forEach((c: any) => { cMap[c.id] = c.title })
    } catch {}

    const userIds = Array.from(new Set([...att.map(r => r.teacher_id), ...att.map(r => r.student_id)].filter(Boolean)))
    const nMap: Record<string, string> = {}
    try {
      const { data: ps } = await admin.from('profiles').select('id, first_name, last_name').in('id', userIds)
      ;(ps || []).forEach((p: any) => { nMap[p.id] = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'User' })
    } catch {}

    const overall = newBucket()
    const teacherB: Record<string, Bucket> = {}
    const courseB: Record<string, Bucket> = {}
    const monthB: Record<string, Bucket> = {}
    const studentB: Record<string, Bucket> = {}

    for (const r of att) {
      add(overall, r.status)
      if (r.teacher_id) add((teacherB[r.teacher_id] = teacherB[r.teacher_id] || newBucket()), r.status)
      if (r.student_id) add((studentB[r.student_id] = studentB[r.student_id] || newBucket()), r.status)
      const b = bMap[r.booking_id] || {}
      const courseTitle = (b.course_id && cMap[b.course_id]) || 'Other'
      add((courseB[courseTitle] = courseB[courseTitle] || newBucket()), r.status)
      const monthKey = (b.start_date || r.marked_at || '').slice(0, 7)
      if (monthKey) add((monthB[monthKey] = monthB[monthKey] || newBucket()), r.status)
    }

    const byTeacher = Object.entries(teacherB).map(([id, b]) => ({
      id, name: nMap[id] || 'Teacher', ...b, total: b.present + b.late + b.absent + b.excused, rate: rate(b.present, b.late, b.absent),
    })).sort((a, b) => b.total - a.total).slice(0, 15)

    const byCourse = Object.entries(courseB).map(([title, b]) => ({
      title, ...b, total: b.present + b.late + b.absent + b.excused, rate: rate(b.present, b.late, b.absent),
    })).sort((a, b) => b.total - a.total).slice(0, 12)

    const monthly = Object.keys(monthB).sort().slice(-12).map(k => {
      const b = monthB[k]; const [y, m] = k.split('-')
      const label = `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m) - 1]} ${String(y).slice(2)}`
      return { month: label, rate: rate(b.present, b.late, b.absent), present: b.present, late: b.late, absent: b.absent }
    })

    const students = Object.entries(studentB).map(([id, b]) => ({
      id, name: nMap[id] || 'Student', ...b, total: b.present + b.late + b.absent + b.excused, rate: rate(b.present, b.late, b.absent),
    }))
    const mostAbsent = students.filter(s => s.absent > 0).sort((a, b) => b.absent - a.absent).slice(0, 8)
    const mostReliable = students.filter(s => (s.present + s.late + s.absent) >= 3).sort((a, b) => b.rate - a.rate || b.present - a.present).slice(0, 8)

    return NextResponse.json({
      overall: { ...overall, total: overall.present + overall.late + overall.absent + overall.excused, rate: rate(overall.present, overall.late, overall.absent) },
      byTeacher, byCourse, monthly, mostAbsent, mostReliable,
    })
  } catch {
    return NextResponse.json(EMPTY)
  }
}
