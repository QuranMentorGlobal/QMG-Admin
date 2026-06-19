import { NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'
const r1 = (n: number) => Math.round(n * 10) / 10
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export async function GET() {
  const g = await guard(['reviews.view']); if ('error' in g) return g.error
  const svc = service()

  let rres: any = await svc.from('reviews').select('id, rating, is_published, created_at, teacher_id')
  if (rres.error) rres = await svc.from('reviews').select('id, rating, is_published, created_at')
  if (rres.error) return NextResponse.json({ totals: { total: 0, publishedCount: 0, pendingCount: 0, avgRating: 0 }, dist: [1,2,3,4,5].map(star => ({ star, count: 0 })), trend: [], topRated: [], lowRated: [], pending: [] })
  const all: any[] = rres.data || []
  const pub = all.filter(r => r.is_published)

  const total = all.length, publishedCount = pub.length, pendingCount = total - publishedCount
  const avgRating = pub.length ? r1(pub.reduce((s, r) => s + (Number(r.rating) || 0), 0) / pub.length) : 0

  // Distribution 1..5 (published)
  const dist = [1, 2, 3, 4, 5].map(star => ({ star, count: pub.filter(r => Math.round(Number(r.rating)) === star).length }))

  // 12-month trend (avg + count over published)
  const now = new Date(); const keys: string[] = []
  for (let i = 11; i >= 0; i--) keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  const mMap: Record<string, { sum: number; count: number }> = {}
  keys.forEach(k => mMap[k] = { sum: 0, count: 0 })
  pub.forEach(r => { const k = monthKey(new Date(r.created_at)); if (mMap[k]) { mMap[k].sum += Number(r.rating) || 0; mMap[k].count++ } })
  const trend = keys.map(k => ({ m: k, avg: mMap[k].count ? r1(mMap[k].sum / mMap[k].count) : 0, count: mMap[k].count }))

  // Teacher reputation (published)
  const tAgg: Record<string, { sum: number; count: number }> = {}
  pub.forEach(r => { const id = r.teacher_id; if (!id) return; (tAgg[id] = tAgg[id] || { sum: 0, count: 0 }); tAgg[id].sum += Number(r.rating) || 0; tAgg[id].count++ })
  const ids = Object.keys(tAgg)
  const nameMap: Record<string, string> = {}
  if (ids.length) {
    const { data: profs } = await svc.from('profiles').select('id, first_name, last_name').in('id', ids)
    ;(profs || []).forEach((p: any) => nameMap[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Teacher')
  }
  const repList = ids.map(id => ({ id, name: nameMap[id] || 'Teacher', avg: r1(tAgg[id].sum / tAgg[id].count), count: tAgg[id].count }))
  const topRated = [...repList].sort((a, b) => b.avg - a.avg || b.count - a.count).slice(0, 6)
  const lowRated = [...repList].filter(t => t.avg < 4).sort((a, b) => a.avg - b.avg).slice(0, 5)

  // Pending moderation queue (with names)
  let pendRes: any = await svc.from('reviews')
    .select(`id, rating, title, body, created_at,
      student:profiles!reviews_student_id_fkey(first_name, last_name),
      teacher:profiles!reviews_teacher_id_fkey(first_name, last_name)`)
    .eq('is_published', false).order('created_at', { ascending: false }).limit(100)
  if (pendRes.error) pendRes = await svc.from('reviews')
    .select('id, rating, title, body, created_at')
    .eq('is_published', false).order('created_at', { ascending: false }).limit(100)
  const pendRaw = pendRes.data || []
  const pending = (pendRaw || []).map((r: any) => ({
    id: r.id, rating: r.rating, title: r.title || '', body: r.body || '', createdAt: r.created_at,
    student: r.student ? `${r.student.first_name || ''} ${r.student.last_name || ''}`.trim() : 'Unknown',
    teacher: r.teacher ? `${r.teacher.first_name || ''} ${r.teacher.last_name || ''}`.trim() : 'Unknown',
  }))

  return NextResponse.json({
    totals: { total, publishedCount, pendingCount, avgRating },
    dist, trend, topRated, lowRated, pending,
  })
}
