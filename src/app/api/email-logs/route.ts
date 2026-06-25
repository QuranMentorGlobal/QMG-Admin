// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/api/email-logs/route.ts
// Email delivery log — reads the service-role-locked email_logs table.
//   GET  → recent logs + status breakdown (guarded: analytics.deep)
//   POST { action:'retry' } → triggers the frontend retry cron for failed mail
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { guard, service, logAudit } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guard(['analytics.deep'])
  if ('error' in g) return g.error
  const svc = service()

  // High explicit limit (Supabase silently caps at 1000 otherwise).
  const { data, error } = await svc
    .from('email_logs')
    .select('id, created_at, email_type, recipient, subject, status, provider, provider_message_id, error, attempts, last_attempt_at, related_type, related_id')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) {
    // Table missing or unreadable — fail soft so the page renders an empty state.
    return NextResponse.json({ logs: [], stats: emptyStats(), available: false })
  }

  const logs = (data as any[]) || []
  const stats = { ...emptyStats(), total: logs.length }
  for (const l of logs) {
    const s = String(l.status || 'pending')
    stats[s] = (stats[s] || 0) + 1
  }
  return NextResponse.json({ logs, stats, available: true })
}

export async function POST(request: NextRequest) {
  const g = await guard(['analytics.deep'])
  if ('error' in g) return g.error

  let body: any = {}
  try { body = await request.json() } catch {}
  if (body.action !== 'retry') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.muddarris.com'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  // Frontend retry is open until CRON_SECRET is configured; forward it when present.
  if (process.env.CRON_SECRET) headers.Authorization = `Bearer ${process.env.CRON_SECRET}`

  try {
    const res = await fetch(`${frontendUrl}/api/email/retry`, { method: 'POST', headers })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ error: json?.error || `Retry failed (${res.status})` }, { status: 502 })
    }
    await logAudit(g.caller, 'email.retry', 'email_logs', undefined, json)
    return NextResponse.json({ success: true, ...json })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not reach the email service.' }, { status: 502 })
  }
}

function emptyStats(): Record<string, number> {
  return { total: 0, pending: 0, sent: 0, delivered: 0, opened: 0, failed: 0, bounced: 0, complained: 0, delayed: 0 }
}
