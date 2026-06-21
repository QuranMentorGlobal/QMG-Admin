// qmg-admin: src/app/api/moderation/route.ts
// ────────────────────────────────────────────────────────────────────────────
// Trust & Safety review queue. Returns conversation_flags the AI scanner raised
// (medium/high risk), enriched with the two participants' names/roles and the
// recent message transcript so an admin can judge in context.
//
// Service-role read — bypasses RLS. Resilient: if the table doesn't exist yet
// (migration not run) or a join fails, returns an empty list instead of 500-ing.
// ────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const RISK_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export async function GET(req: Request) {
  try {
    const supabase = getAdmin()
    const url = new URL(req.url)
    const status = url.searchParams.get('status') || 'open'

    const q = supabase.from('conversation_flags').select('*').order('updated_at', { ascending: false })
    const { data: flags, error } = status === 'all' ? await q : await q.eq('status', status)
    if (error) return NextResponse.json([])
    const rows = (flags as any[]) ?? []
    if (rows.length === 0) return NextResponse.json([])

    // sort high → medium → low, then most recent
    rows.sort((a, b) => (RISK_ORDER[a.risk] ?? 9) - (RISK_ORDER[b.risk] ?? 9) || (b.updated_at || '').localeCompare(a.updated_at || ''))

    const convoIds = Array.from(new Set(rows.map(r => r.conversation_id).filter(Boolean)))

    // conversations → participants
    const convoMap: Record<string, any> = {}
    try {
      const { data: convos } = await supabase
        .from('conversations')
        .select('id, participant_1, participant_2, child_id')
        .in('id', convoIds.length ? convoIds : ['00000000-0000-0000-0000-000000000000'])
      ;(convos ?? []).forEach((c: any) => { convoMap[c.id] = c })
    } catch {}

    // participant profiles
    const userIds = new Set<string>()
    Object.values(convoMap).forEach((c: any) => { if (c.participant_1) userIds.add(c.participant_1); if (c.participant_2) userIds.add(c.participant_2) })
    const profMap: Record<string, any> = {}
    try {
      const ids = Array.from(userIds)
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, email')
        .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
      ;(profs ?? []).forEach((p: any) => { profMap[p.id] = p })
    } catch {}

    const nameOf = (id: string) => {
      const p = profMap[id]
      if (!p) return { name: 'User', role: 'user', email: '' }
      return { name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'User', role: p.role || 'user', email: p.email || '' }
    }

    // recent transcript per conversation (last 12)
    const msgMap: Record<string, any[]> = {}
    await Promise.all(convoIds.map(async (cid) => {
      try {
        const { data: ms } = await supabase
          .from('messages')
          .select('sender_id, body, created_at')
          .eq('conversation_id', cid)
          .order('created_at', { ascending: false })
          .limit(12)
        msgMap[cid] = ((ms as any[]) || []).reverse()
      } catch { msgMap[cid] = [] }
    }))

    const enriched = rows.map((r: any) => {
      const c = convoMap[r.conversation_id] || {}
      const p1 = c.participant_1 ? nameOf(c.participant_1) : { name: 'User', role: 'user', email: '' }
      const p2 = c.participant_2 ? nameOf(c.participant_2) : { name: 'User', role: 'user', email: '' }
      const messages = (msgMap[r.conversation_id] || []).map((m: any) => ({
        body: m.body, created_at: m.created_at,
        sender: m.sender_id === c.participant_1 ? p1.name : m.sender_id === c.participant_2 ? p2.name : 'User',
        senderRole: m.sender_id === c.participant_1 ? p1.role : m.sender_id === c.participant_2 ? p2.role : 'user',
      }))
      return {
        id: r.id,
        conversation_id: r.conversation_id,
        risk: r.risk || 'low',
        signals: r.signals || [],
        reasons: r.reasons || [],
        evidence: Array.isArray(r.evidence) ? r.evidence : [],
        status: r.status || 'open',
        admin_notes: r.admin_notes || null,
        message_count: r.message_count || messages.length,
        last_message_at: r.last_message_at || null,
        last_scanned_at: r.last_scanned_at || null,
        created_at: r.created_at,
        participant_1: p1,
        participant_2: p2,
        messages,
      }
    })

    return NextResponse.json(enriched)
  } catch {
    return NextResponse.json([])
  }
}
