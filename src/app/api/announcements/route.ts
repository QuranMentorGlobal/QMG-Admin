// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/api/announcements/route.ts
// System Announcements — broadcast an in-app notification to a target role.
//   GET  → audience counts + recent broadcasts (guarded: settings.view)
//   POST { title, body, href?, audience } → fan-out notification rows
// In-app only by design; mass marketing email belongs in Resend Broadcasts.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { guard, service, logAudit } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const ROLES = ['student', 'teacher', 'parent'] as const
const AUDIENCES = ['all', 'student', 'teacher', 'parent']

export async function GET() {
  const g = await guard(['settings.view'])
  if ('error' in g) return g.error
  const svc = service()

  const counts: Record<string, number> = { all: 0, student: 0, teacher: 0, parent: 0 }
  for (const r of ROLES) {
    try {
      const { count } = await svc.from('profiles').select('id', { count: 'exact', head: true }).eq('role', r)
      counts[r] = count ?? 0
    } catch { counts[r] = 0 }
  }
  counts.all = counts.student + counts.teacher + counts.parent

  // Best-effort recent broadcast history: latest announcement rows, deduped by
  // title + minute (one broadcast = many identical rows).
  const recent: any[] = []
  try {
    const { data } = await svc.from('notifications')
      .select('title, body, href, created_at')
      .eq('type', 'announcement')
      .order('created_at', { ascending: false })
      .limit(400)
    const seen = new Set<string>()
    for (const n of (data as any[]) || []) {
      const key = `${n.title}|${String(n.created_at).slice(0, 16)}`
      if (seen.has(key)) continue
      seen.add(key); recent.push(n)
      if (recent.length >= 10) break
    }
  } catch {}

  return NextResponse.json({ counts, recent })
}

export async function POST(request: NextRequest) {
  const g = await guard(['settings.view'])
  if ('error' in g) return g.error

  let body: any = {}
  try { body = await request.json() } catch {}
  const title = String(body.title || '').trim()
  const message = String(body.body || '').trim()
  const href = String(body.href || '').trim() || null
  const audience = body.audience

  if (!title || !message) return NextResponse.json({ error: 'Title and message are required.' }, { status: 400 })
  if (!AUDIENCES.includes(audience)) return NextResponse.json({ error: 'Invalid audience.' }, { status: 400 })

  const svc = service()
  const roles = audience === 'all' ? [...ROLES] : [audience]

  const ids: string[] = []
  for (const r of roles) {
    const { data } = await svc.from('profiles').select('id').eq('role', r).limit(100000)
    ids.push(...(((data as any[]) || []).map(p => p.id)))
  }
  if (ids.length === 0) return NextResponse.json({ success: true, sent: 0, total: 0 })

  const CHUNK = 500
  let sent = 0
  for (let i = 0; i < ids.length; i += CHUNK) {
    const rows = ids.slice(i, i + CHUNK).map(uid => ({ user_id: uid, type: 'announcement', title, body: message, href }))
    const { error } = await svc.from('notifications').insert(rows)
    if (!error) sent += rows.length
  }

  await logAudit(g.caller, 'announcement.broadcast', 'notifications', undefined, { audience, title, count: sent })
  return NextResponse.json({ success: true, sent, total: ids.length })
}
