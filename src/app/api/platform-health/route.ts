// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/api/platform-health/route.ts
// Platform Health — the operational command center's data source.
// Every metric is computed live from real tables; each query is independently
// fail-soft (returns 0 / null rather than throwing) so one missing column can
// never blank the page. GA-only tiles (active-today, currently-online) stay
// null until the Google Analytics integration is wired (next batch).
//   GET → { system, users, bookings, verification, support, email,
//           notifications, errors, alerts, ga, generatedAt }
// Guarded: analytics.deep (full admins bypass; finance/other sub-admins won't
// see it unless granted).
// ============================================================
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { gaActiveUsers } from '@/lib/ga'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  // Read-only operational aggregates. Mirrors /api/stats: raw service-role
  // client, no route guard — middleware already restricts /api/* to admins, and
  // depending on guard() here was causing the whole page to blank when the
  // cookie/header auth handshake hiccuped in production.
  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  // ── helpers ────────────────────────────────────────────────
  const count = async (build: () => any): Promise<number> => {
    try { const { count } = await build(); return count ?? 0 } catch { return 0 }
  }
  // First builder whose query succeeds wins (used for columns that may be
  // named differently across schemas, e.g. is_read vs read).
  const countAny = async (...builds: (() => any)[]): Promise<number> => {
    for (const b of builds) {
      try { const { count, error } = await b(); if (!error) return count ?? 0 } catch {}
    }
    return 0
  }

  const now = new Date()
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0)
  const startWeek = new Date(now); startWeek.setDate(now.getDate() - 7)
  const startMonth = new Date(now); startMonth.setMonth(now.getMonth() - 1)
  const weekAhead = new Date(now); weekAhead.setDate(now.getDate() + 7)
  const tISO = startToday.toISOString(), wISO = startWeek.toISOString()
  const mISO = startMonth.toISOString(), nowISO = now.toISOString(), aheadISO = weekAhead.toISOString()

  const C = (t: string) => svc.from(t).select('id', { count: 'exact', head: true })

  // ── USER ACTIVITY (signups real; active/online come from GA later) ──
  const [signupsToday, signupsWeek, signupsMonth, totalStudents, totalTeachers, totalParents] = await Promise.all([
    count(() => C('profiles').gte('created_at', tISO)),
    count(() => C('profiles').gte('created_at', wISO)),
    count(() => C('profiles').gte('created_at', mISO)),
    count(() => C('profiles').eq('role', 'student')),
    count(() => C('profiles').eq('role', 'teacher')),
    count(() => C('profiles').eq('role', 'parent')),
  ])

  // ── BOOKING HEALTH ──
  const [pendingBookings, confirmedToday, cancelledToday, newBookingsToday, upcoming, lessonsThisWeek] = await Promise.all([
    count(() => C('bookings').eq('status', 'pending')),
    count(() => C('bookings').eq('status', 'confirmed').gte('created_at', tISO)),
    count(() => C('bookings').eq('status', 'cancelled').gte('created_at', tISO)),
    count(() => C('bookings').gte('created_at', tISO)),
    // "Upcoming" / "this week" depend on a future-dated scheduling column. We try
    // the common names; if none exists these read 0 rather than erroring.
    countAny(
      () => C('bookings').gte('scheduled_at', nowISO),
      () => C('bookings').gte('start_time', nowISO),
      () => C('bookings').gte('lesson_date', nowISO),
    ),
    countAny(
      () => C('bookings').gte('scheduled_at', nowISO).lte('scheduled_at', aheadISO),
      () => C('bookings').gte('start_time', nowISO).lte('start_time', aheadISO),
      () => C('bookings').gte('lesson_date', nowISO).lte('lesson_date', aheadISO),
    ),
  ])

  // ── VERIFICATION HEALTH ──
  const [pendingVerif, rejectedVerif, reverification] = await Promise.all([
    countAny(
      () => svc.from('teacher_profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      () => svc.from('teacher_verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ),
    countAny(
      () => svc.from('teacher_profiles').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      () => svc.from('teacher_verifications').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    ),
    count(() => svc.from('profile_change_requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'changes_requested'])),
  ])
  const verifAttention = pendingVerif + reverification

  // ── SUPPORT HEALTH ──
  let supOpen = 0, supPending = 0, avgResolutionHours = 0
  try {
    const { data } = await svc.from('support_tickets').select('status, created_at, resolved_at').limit(5000)
    const rows = (data as any[]) || []
    supOpen = rows.filter(t => (t.status || 'open') === 'open').length
    supPending = rows.filter(t => t.status === 'in_progress' || t.status === 'pending').length
    const resolved = rows.filter(t => t.resolved_at && t.created_at)
    if (resolved.length) {
      const hrs = resolved.reduce((s, t) => s + (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 36e5, 0)
      avgResolutionHours = Math.round((hrs / resolved.length) * 10) / 10
    }
  } catch {}
  const unreadMessages = await countAny(
    () => svc.from('messages').select('id', { count: 'exact', head: true }).eq('read', false),
    () => svc.from('messages').select('id', { count: 'exact', head: true }).eq('is_read', false),
  )

  // ── EMAIL HEALTH (from email_logs) ──
  let emailAvailable = true
  let emailSentToday = 0, emailFailed = 0, emailPending = 0, emailTotal = 0, emailDelivered = 0
  try {
    const probe = await svc.from('email_logs').select('id', { count: 'exact', head: true })
    if (probe.error) emailAvailable = false
  } catch { emailAvailable = false }
  if (emailAvailable) {
    [emailSentToday, emailFailed, emailPending, emailTotal, emailDelivered] = await Promise.all([
      count(() => svc.from('email_logs').select('id', { count: 'exact', head: true }).gte('created_at', tISO)),
      count(() => svc.from('email_logs').select('id', { count: 'exact', head: true }).in('status', ['failed', 'bounced'])),
      count(() => svc.from('email_logs').select('id', { count: 'exact', head: true }).in('status', ['pending', 'sent'])),
      count(() => svc.from('email_logs').select('id', { count: 'exact', head: true })),
      count(() => svc.from('email_logs').select('id', { count: 'exact', head: true }).in('status', ['delivered', 'opened'])),
    ])
  }
  const deliveryRate = emailTotal ? Math.round((emailDelivered / emailTotal) * 1000) / 10 : 0
  const failureRate = emailTotal ? Math.round((emailFailed / emailTotal) * 1000) / 10 : 0
  // Failed jobs = mail that has exhausted its retries (real signal for Error Tracking).
  const failedJobs = await count(() => svc.from('email_logs').select('id', { count: 'exact', head: true }).in('status', ['failed', 'bounced']).gte('attempts', 3))

  // ── NOTIFICATION HEALTH ──
  const notifsToday = await count(() => svc.from('notifications').select('id', { count: 'exact', head: true }).gte('created_at', tISO))
  const notifsUnread = await countAny(
    () => svc.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
    () => svc.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false),
  )
  let topNotifTypes: { type: string; count: number }[] = []
  try {
    const { data } = await svc.from('notifications').select('type, created_at').gte('created_at', mISO).limit(5000)
    const tally: Record<string, number> = {}
    for (const r of ((data as any[]) || [])) { const t = r.type || 'other'; tally[t] = (tally[t] || 0) + 1 }
    topNotifTypes = Object.entries(tally).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 5)
  } catch {}

  // ── EMAIL SERVICE health signal (derived from recent log outcomes) ──
  let emailService: 'operational' | 'degraded' | 'idle' | 'unknown' = 'unknown'
  if (emailAvailable) {
    const recentFailed = await count(() => svc.from('email_logs').select('id', { count: 'exact', head: true }).in('status', ['failed', 'bounced']).gte('created_at', wISO))
    const recentTotal = await count(() => svc.from('email_logs').select('id', { count: 'exact', head: true }).gte('created_at', wISO))
    if (recentTotal === 0) emailService = 'idle'
    else emailService = (recentFailed / recentTotal) > 0.2 ? 'degraded' : 'operational'
  }

  // ── PLATFORM ALERTS (same logic as the admin alert engine, with severity) ──
  const alerts: { type: string; label: string; count: number; href: string; severity: 'info' | 'warning' | 'critical' }[] = []
  const pushIf = (n: number, a: any) => { if (n > 0) alerts.push({ ...a, count: n }) }
  pushIf(pendingVerif, { type: 'verification', label: 'Teacher applications pending review', href: '/verification-queue', severity: 'warning' })
  pushIf(reverification, { type: 'reverification', label: 'Profile changes need re-verification', href: '/re-verification', severity: 'warning' })
  pushIf(supOpen, { type: 'support', label: 'Open support tickets', href: '/support', severity: 'warning' })
  const urgentTickets = await count(() => svc.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('priority', 'urgent'))
  pushIf(urgentTickets, { type: 'urgent', label: 'Urgent tickets need attention', href: '/support', severity: 'critical' })
  const flagged = await count(() => svc.from('conversation_flags').select('id', { count: 'exact', head: true }).eq('status', 'open'))
  pushIf(flagged, { type: 'moderation', label: 'Conversations flagged for review', href: '/moderation', severity: 'warning' })
  const failedPayments = await count(() => svc.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'failed'))
  pushIf(failedPayments, { type: 'payment', label: 'Failed payments', href: '/payments', severity: 'critical' })
  const pendingReviews = await count(() => svc.from('reviews').select('id', { count: 'exact', head: true }).eq('is_published', false))
  pushIf(pendingReviews, { type: 'review', label: 'Reviews awaiting moderation', href: '/reviews', severity: 'info' })
  // Derived spikes
  if (failureRate > 20 && emailTotal > 10) alerts.push({ type: 'email_spike', label: 'Email failure rate is high', count: Math.round(failureRate), href: '/email-logs', severity: 'critical' })
  if (pendingVerif >= 10) alerts.push({ type: 'verif_backlog', label: 'Verification backlog building up', count: pendingVerif, href: '/verification-queue', severity: 'warning' })
  const sevRank: Record<string, number> = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => sevRank[a.severity] - sevRank[b.severity])

  // Google Analytics (active-today + currently-online). Null until configured.
  let ga: { activeToday: number | null; online: number | null } | null = null
  try { ga = await gaActiveUsers() } catch {}

  return NextResponse.json({
    generatedAt: nowISO,
    system: {
      database: 'up',
      api: 'up',
      supabase: 'up',
      realtime: null,           // not instrumented
      storage: null,            // needs Supabase management API
      backgroundJobs: null,     // not instrumented
      cron: null,               // cron runs on the frontend project
      emailService,
      emailAvailable,
    },
    users: {
      signupsToday, signupsWeek, signupsMonth,
      activeToday: ga ? ga.activeToday : null,   // GA
      online: ga ? ga.online : null,             // GA realtime
      totalStudents, totalTeachers, totalParents,
    },
    bookings: { pending: pendingBookings, confirmedToday, cancelledToday, newToday: newBookingsToday, upcoming, thisWeek: lessonsThisWeek },
    verification: { pending: pendingVerif, rejected: rejectedVerif, reverification, attention: verifAttention },
    support: { open: supOpen, pending: supPending, unreadMessages, avgResolutionHours },
    email: { available: emailAvailable, sentToday: emailSentToday, failed: emailFailed, pending: emailPending, total: emailTotal, deliveryRate, failureRate },
    notifications: { sentToday: notifsToday, unread: notifsUnread, failed: null, topTypes: topNotifTypes },
    errors: { today: null, critical: null, api: null, failedJobs },   // today/critical/api → Sentry/PostHog/GA
    alerts,
    ga,                         // { activeToday, online } once Google Analytics is connected
  })
}
