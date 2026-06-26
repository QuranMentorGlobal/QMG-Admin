// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/api/parents/route.ts
// Parents — every parent account with their linked children, pending link
// requests, and how many lessons their children have booked. Reads the real
// parent_children + parent_child_link_requests tables (same Supabase project as
// the platform). Read-only, fail-soft. Guarded by students.view.
// ============================================================
import { NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guard(['students.view'])
  if ('error' in g) return g.error
  const svc = service()

  const safe = async <T,>(b: () => any, fallback: T): Promise<T> => {
    try { const { data, error } = await b(); return error ? fallback : (data as T) } catch { return fallback }
  }

  // Parent accounts
  const parents = await safe<any[]>(
    () => svc.from('profiles').select('id, first_name, last_name, email, country, created_at, avatar_url').eq('role', 'parent').order('created_at', { ascending: false }).limit(5000),
    [],
  )

  // Established links + pending requests
  const links = await safe<any[]>(() => svc.from('parent_children').select('parent_id, child_id').limit(50000), [])
  const pending = await safe<any[]>(() => svc.from('parent_child_link_requests').select('parent_id, child_id, status').eq('status', 'pending').limit(50000), [])

  // Resolve child profiles
  const childIds = Array.from(new Set(links.map(l => l.child_id).filter(Boolean)))
  const childMap: Record<string, any> = {}
  if (childIds.length) {
    const kids = await safe<any[]>(() => svc.from('profiles').select('id, first_name, last_name, email').in('id', childIds).limit(50000), [])
    for (const k of kids) childMap[k.id] = k
  }

  // Lessons booked by each child (one query, tallied)
  const lessonsByChild: Record<string, number> = {}
  if (childIds.length) {
    const bk = await safe<any[]>(() => svc.from('bookings').select('student_id').in('student_id', childIds).limit(100000), [])
    for (const b of bk) { if (b.student_id) lessonsByChild[b.student_id] = (lessonsByChild[b.student_id] || 0) + 1 }
  }

  const pendingByParent: Record<string, number> = {}
  for (const p of pending) pendingByParent[p.parent_id] = (pendingByParent[p.parent_id] || 0) + 1

  const childrenByParent: Record<string, any[]> = {}
  for (const l of links) {
    if (!l.parent_id) continue
    const c = childMap[l.child_id]
    ;(childrenByParent[l.parent_id] ||= []).push({
      id: l.child_id,
      name: c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Student' : 'Student',
      email: c?.email || '',
      lessons: lessonsByChild[l.child_id] || 0,
    })
  }

  const rows = parents.map(p => {
    const children = childrenByParent[p.id] || []
    return {
      id: p.id,
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Parent',
      email: p.email || '',
      country: p.country || '',
      avatar_url: p.avatar_url || null,
      created_at: p.created_at,
      childCount: children.length,
      pendingRequests: pendingByParent[p.id] || 0,
      lessons: children.reduce((s, c) => s + (c.lessons || 0), 0),
      children,
    }
  })

  const totals = {
    parents: rows.length,
    linkedChildren: childIds.length,
    pendingRequests: pending.length,
  }

  return NextResponse.json({ parents: rows, totals })
}
