// qmg-admin: src/app/api/moderation-action/route.ts
// ────────────────────────────────────────────────────────────────────────────
// Resolve a Trust & Safety flag.
//   review   → status 'reviewed'   (admin looked, acted/decided elsewhere)
//   dismiss  → status 'dismissed'  (false positive / benign)
//   reopen   → status 'open'
// Records who/when + optional admin_notes. Service-role write. No auto-ban —
// any account action stays a separate, deliberate admin step.
// ────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { guard, service, logAudit } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

type Body = {
  id: string
  action: 'review' | 'dismiss' | 'reopen'
  notes?: string
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(['moderation.action', 'support.manage', 'support.view'])
    if ('error' in g) return g.error

    const { id, action, notes }: Body = await req.json()
    if (!id || !action) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const status = action === 'dismiss' ? 'dismissed' : action === 'reopen' ? 'open' : 'reviewed'
    const svc = service()

    // Critical: status update.
    const { error } = await svc.from('conversation_flags')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Best-effort: reviewer + notes (skips if columns missing).
    const { error: noteErr } = await svc.from('conversation_flags')
      .update({ admin_notes: notes ?? null, reviewed_by: g.caller.userId, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    if (noteErr) console.warn('[moderation] notes/reviewer not saved:', noteErr.message)

    try { await logAudit(g.caller, `moderation.${action}`, 'conversation_flag', id, { notes: notes || null }) } catch {}

    return NextResponse.json({ ok: true, status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
