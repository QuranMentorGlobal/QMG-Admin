// qmg-admin: src/app/api/badges/route.ts
// ════════════════════════════════════════════════════════════════════════════
// Admin Badge Management. Service-role, permission-guarded.
//
//  GET  ?userId=…        → that user's active badges + audit history
//  GET  ?config=1        → all threshold overrides (badge_config)
//  POST { action:'assign',  userId, badgeKey, reason }     (manual award)
//  POST { action:'remove',  userId, badgeKey, reason }     (revoke)
//  POST { action:'config',  badgeKey, overrides }          (set thresholds)
//  POST { action:'recompute', userId }                     (re-evaluate one user)
//  POST { action:'backfill', audience? }                   (re-evaluate everyone)
// ════════════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { guard, service, logAudit } from '@/lib/admin-auth'
import { BADGE_BY_KEY } from '@/lib/badges'

export const dynamic = 'force-dynamic'

const FRONTEND = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.quranmentorglobal.com'

export async function GET(req: NextRequest) {
  const g = await guard(['badges.view', 'badges.manage']); if ('error' in g) return g.error
  const svc = service()
  const url = new URL(req.url)

  if (url.searchParams.get('config')) {
    const { data } = await svc.from('badge_config').select('*')
    return NextResponse.json({ config: data || [] })
  }

  const search = url.searchParams.get('search')
  if (search) {
    const term = `%${search}%`
    const { data } = await svc.from('profiles')
      .select('id, first_name, last_name, email, role')
      .or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`)
      .in('role', ['teacher', 'student'])
      .limit(15)
    return NextResponse.json({ users: data || [] })
  }

  const userId = url.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const [{ data: badges }, { data: history }] = await Promise.all([
    svc.from('user_badges').select('*').eq('user_id', userId).eq('revoked', false).order('created_at', { ascending: false }),
    svc.from('badge_audit_log').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
  ])
  return NextResponse.json({ badges: badges || [], history: history || [] })
}

export async function POST(req: NextRequest) {
  const g = await guard(['badges.manage']); if ('error' in g) return g.error
  const svc = service()
  const body = await req.json().catch(() => ({}))
  const action = body.action

  try {
    if (action === 'assign') {
      const { userId, badgeKey, reason } = body
      const def = BADGE_BY_KEY[badgeKey]
      if (!userId || !def) return NextResponse.json({ error: 'Invalid userId or badgeKey' }, { status: 400 })
      await svc.from('user_badges').upsert({
        user_id: userId, badge_key: badgeKey, audience: def.audience, source: 'manual',
        awarded_by: g.caller.userId, reason: reason || 'Manually assigned by admin',
        revoked: false, revoked_at: null, revoked_by: null, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,badge_key' })
      await svc.from('badge_audit_log').insert({
        user_id: userId, badge_key: badgeKey, action: 'awarded', source: 'manual',
        actor_id: g.caller.userId, actor_name: g.caller.name, reason: reason || 'Manually assigned',
      })
      try {
        await svc.from('notifications').insert({
          user_id: userId, type: 'badge_earned', title: 'New Badge Awarded 🏅',
          body: `You've been awarded the "${def.name}" badge.`,
          href: def.audience === 'teacher' ? '/platform/teacher/profile' : '/platform/student/profile',
        })
      } catch {}
      await logAudit(g.caller, 'badge.assign', 'user', userId, { badgeKey, reason: reason || null })
      return NextResponse.json({ ok: true })
    }

    if (action === 'remove') {
      const { userId, badgeKey, reason } = body
      if (!userId || !badgeKey) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      await svc.from('user_badges').update({
        revoked: true, revoked_by: g.caller.userId, revoked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('user_id', userId).eq('badge_key', badgeKey)
      await svc.from('badge_audit_log').insert({
        user_id: userId, badge_key: badgeKey, action: 'revoked', source: 'manual',
        actor_id: g.caller.userId, actor_name: g.caller.name, reason: reason || 'Removed by admin',
      })
      await logAudit(g.caller, 'badge.remove', 'user', userId, { badgeKey, reason: reason || null })
      return NextResponse.json({ ok: true })
    }

    if (action === 'config') {
      const { badgeKey, overrides } = body
      if (!badgeKey || typeof overrides !== 'object') return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      await svc.from('badge_config').upsert({
        badge_key: badgeKey, overrides, updated_by: g.caller.userId, updated_at: new Date().toISOString(),
      }, { onConflict: 'badge_key' })
      await logAudit(g.caller, 'badge.config', 'badge', badgeKey, { overrides })
      return NextResponse.json({ ok: true })
    }

    // recompute one / backfill all → delegate to the frontend badge engine
    if (action === 'recompute' || action === 'backfill') {
      const payload = action === 'recompute' ? { userId: body.userId } : { all: true, audience: body.audience }
      const r = await fetch(`${FRONTEND}/api/badges/recompute`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const text = await r.text()
      const json = text ? JSON.parse(text) : {}
      if (!r.ok) return NextResponse.json({ error: json.error || 'Engine error' }, { status: 500 })
      await logAudit(g.caller, `badge.${action}`, 'system', body.userId || 'all', json)
      return NextResponse.json({ ok: true, ...json })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Badge action failed' }, { status: 500 })
  }
}
