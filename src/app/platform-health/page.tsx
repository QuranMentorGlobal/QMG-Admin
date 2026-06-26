// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/platform-health/page.tsx
// Platform Health — the operational command center.
// 10 sections: System, User Activity, Bookings, Verification, Support, Email,
// Notifications, Error Tracking, Platform Alerts, Quick Actions.
// All numbers come from /api/platform-health (real, fail-soft). Tiles with no
// data source yet show an honest "Connect" state. Mobile view centers content.
// ============================================================
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import Link from 'next/link'
import {
  Activity, Database, Server, Zap, HardDrive, Clock4, Mail, Cpu,
  Users, UserPlus, Wifi, BookOpen, CalendarCheck, CalendarX, CalendarClock,
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, MessageSquare, Bell,
  Send, XCircle, CheckCircle2, RotateCcw, Wallet, CreditCard, Star, Gauge,
  TrendingUp, RefreshCw, Plug,
} from 'lucide-react'

const GOLD = '#C9A227', INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F8F5EE'
const GREEN = '#166534', RED = '#DC2626', AMBER = '#C2410C'

function fmtNum(n: number | null | undefined) {
  if (n == null) return '—'
  return n >= 1000 ? n.toLocaleString() : String(n)
}
function typeLabel(t: string) {
  return (t || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── small building blocks ───────────────────────────────────
function Section({ title, icon: Icon, children, sub }: { title: string; icon: any; children: React.ReactNode; sub?: string }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div className="ph-section-head" style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
        <Icon size={17} color={GOLD} />
        <h2 style={{ fontSize: 15, fontWeight: 800, color: INK, fontFamily: 'var(--ff)', margin: 0 }}>{title}</h2>
        {sub && <span style={{ fontSize: 12, color: MUTED }}>· {sub}</span>}
      </div>
      <div className="ph-grid">{children}</div>
    </section>
  )
}

function StatCard({ label, value, icon: Icon, tone = INK, note, connect }: { label: string; value: React.ReactNode; icon: any; tone?: string; note?: string; connect?: boolean }) {
  return (
    <div className="ph-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px', minHeight: 86 }}>
      <div className="ph-card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: MUTED, fontSize: 12, fontWeight: 600 }}>
        <Icon size={14} color={tone} /> {label}
      </div>
      {connect ? (
        <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: GOLD }}>
          <Plug size={13} /> Connect to enable
        </div>
      ) : (
        <div style={{ fontSize: 25, fontWeight: 800, color: INK, marginTop: 4, fontFamily: 'var(--ff)' }}>{value}</div>
      )}
      {note && !connect && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{note}</div>}
    </div>
  )
}

const STATUS_TONE: Record<string, { dot: string; label: string }> = {
  up:          { dot: GREEN, label: 'Operational' },
  operational: { dot: GREEN, label: 'Operational' },
  degraded:    { dot: AMBER, label: 'Degraded' },
  idle:        { dot: MUTED, label: 'Idle' },
  down:        { dot: RED,   label: 'Down' },
}
function StatusCard({ label, icon: Icon, state }: { label: string; icon: any; state: string | null }) {
  const meta = state ? (STATUS_TONE[state] || { dot: MUTED, label: typeLabel(state) }) : null
  return (
    <div className="ph-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px', minHeight: 86 }}>
      <div className="ph-card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: MUTED, fontSize: 12, fontWeight: 600 }}>
        <Icon size={14} color={INK} /> {label}
      </div>
      {meta ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 9 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: meta.dot, boxShadow: `0 0 0 3px ${meta.dot}22` }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: INK }}>{meta.label}</span>
        </div>
      ) : (
        <div style={{ marginTop: 9, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: MUTED }}>
          <Plug size={13} /> Not monitored
        </div>
      )}
    </div>
  )
}

const SEV: Record<string, { bg: string; fg: string; label: string }> = {
  critical: { bg: 'rgba(220,38,38,0.10)', fg: RED,   label: 'Critical' },
  warning:  { bg: 'rgba(201,162,39,0.14)', fg: '#8A6A16', label: 'Warning' },
  info:     { bg: 'rgba(22,101,52,0.12)', fg: GREEN, label: 'Info' },
}

export default function PlatformHealthPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [h, setH] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const sb = createClient(); const { data: { user } } = await sb.auth.getUser()
        if (user) { const { data: p } = await sb.from('profiles').select('first_name').eq('id', user.id).single(); setAdminName((p as any)?.first_name || 'Admin') }
      } catch {}
    })()
    load()
  }, [])

  async function load() {
    setLoading(true)
    try { const res = await fetch('/api/platform-health'); const d = await res.json(); if (res.ok) setH(d) } catch {}
    setLoading(false)
  }

  const sys = h?.system || {}, usr = h?.users || {}, bk = h?.bookings || {}, vf = h?.verification || {}
  const sup = h?.support || {}, em = h?.email || {}, nt = h?.notifications || {}, er = h?.errors || {}
  const alerts: any[] = h?.alerts || []

  const QUICK = [
    { label: 'Review Verifications', href: '/verification-queue', icon: ShieldCheck },
    { label: 'Review Payouts', href: '/payouts', icon: Wallet },
    { label: 'Review Failed Emails', href: '/email-logs', icon: Mail },
    { label: 'Review Failed Payments', href: '/payments', icon: CreditCard },
    { label: 'Review Support Tickets', href: '/support', icon: MessageSquare },
    { label: 'Review Refunds', href: '/refunds', icon: RotateCcw },
  ]

  return (
    <AdminLayout adminName={adminName}>
      <style>{`
        .ph-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
        @media(max-width:640px){ .ph-head{flex-direction:column;align-items:center;text-align:center} }
        @media(max-width:768px){ .ph-grid{grid-template-columns:repeat(2,minmax(0,1fr))} }
        @media(max-width:480px){
          .ph-grid{grid-template-columns:1fr}
          .ph-section-head{justify-content:center;text-align:center}
        }
      `}</style>

      {/* Header */}
      <div className="ph-head" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: INK, fontFamily: 'var(--ff)', margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
            <Activity size={20} color={GOLD} /> Platform Health
          </h1>
          <p style={{ fontSize: 13, color: MUTED, margin: '3px 0 0' }}>Operational command center · live system, activity & alert monitoring.</p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 11, border: `1px solid ${BORDER}`, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: INK, background: '#fff', opacity: loading ? 0.6 : 1 }}>
          <RefreshCw size={15} /> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {loading && !h ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: MUTED, fontSize: 14 }}>Loading platform health…</div>
      ) : (
        <>
          {/* 1 — SYSTEM HEALTH */}
          <Section title="System Health" icon={Server}>
            <StatusCard label="Database" icon={Database} state={sys.database} />
            <StatusCard label="API Health" icon={Server} state={sys.api} />
            <StatusCard label="Supabase" icon={Database} state={sys.supabase} />
            <StatusCard label="Email Service" icon={Mail} state={sys.emailService === 'unknown' ? null : sys.emailService} />
            <StatusCard label="Realtime" icon={Zap} state={sys.realtime} />
            <StatusCard label="Storage Usage" icon={HardDrive} state={sys.storage} />
            <StatusCard label="Cron Jobs" icon={Clock4} state={sys.cron} />
            <StatusCard label="Background Jobs" icon={Cpu} state={sys.backgroundJobs} />
          </Section>

          {/* 2 — USER ACTIVITY */}
          <Section title="User Activity" icon={Users}>
            <StatCard label="Active Users Today" value={fmtNum(usr.activeToday)} icon={Users} tone={GREEN} connect={usr.activeToday == null} />
            <StatCard label="Currently Online" value={fmtNum(usr.online)} icon={Wifi} tone={GREEN} connect={usr.online == null} />
            <StatCard label="New Signups Today" value={fmtNum(usr.signupsToday)} icon={UserPlus} tone={GOLD} />
            <StatCard label="New Signups (7d)" value={fmtNum(usr.signupsWeek)} icon={UserPlus} tone={GOLD} />
            <StatCard label="New Signups (30d)" value={fmtNum(usr.signupsMonth)} icon={UserPlus} tone={GOLD} />
          </Section>

          {/* 3 — BOOKING HEALTH */}
          <Section title="Booking Health" icon={BookOpen}>
            <StatCard label="Pending Bookings" value={fmtNum(bk.pending)} icon={CalendarClock} tone={GOLD} />
            <StatCard label="Confirmed Today" value={fmtNum(bk.confirmedToday)} icon={CalendarCheck} tone={GREEN} />
            <StatCard label="Cancelled Today" value={fmtNum(bk.cancelledToday)} icon={CalendarX} tone={RED} />
            <StatCard label="Upcoming Lessons" value={fmtNum(bk.upcoming)} icon={CalendarClock} tone={INK} />
            <StatCard label="Lessons This Week" value={fmtNum(bk.thisWeek)} icon={CalendarCheck} tone={INK} />
          </Section>

          {/* 4 — VERIFICATION HEALTH */}
          <Section title="Verification Health" icon={ShieldCheck}>
            <StatCard label="Pending Verifications" value={fmtNum(vf.pending)} icon={ShieldCheck} tone={GOLD} />
            <StatCard label="Rejected Verifications" value={fmtNum(vf.rejected)} icon={ShieldX} tone={RED} />
            <StatCard label="Reverification Requests" value={fmtNum(vf.reverification)} icon={ShieldAlert} tone={AMBER} />
            <StatCard label="Profiles Needing Attention" value={fmtNum(vf.attention)} icon={AlertTriangle} tone={GOLD} />
          </Section>

          {/* 5 — SUPPORT HEALTH */}
          <Section title="Support Health" icon={MessageSquare}>
            <StatCard label="Open Tickets" value={fmtNum(sup.open)} icon={MessageSquare} tone={GOLD} />
            <StatCard label="Pending Tickets" value={fmtNum(sup.pending)} icon={Clock4} tone={AMBER} />
            <StatCard label="Unread Messages" value={fmtNum(sup.unreadMessages)} icon={Bell} tone={INK} />
            <StatCard label="Avg Resolution" value={sup.avgResolutionHours ? `${sup.avgResolutionHours}h` : '—'} icon={Gauge} tone={GREEN} />
          </Section>

          {/* 6 — EMAIL HEALTH */}
          <Section title="Email Health" icon={Mail} sub={em.available === false ? 'email_logs unavailable' : undefined}>
            <StatCard label="Emails Sent Today" value={fmtNum(em.sentToday)} icon={Send} tone={GREEN} />
            <StatCard label="Failed Emails" value={fmtNum(em.failed)} icon={XCircle} tone={RED} />
            <StatCard label="Pending / In-flight" value={fmtNum(em.pending)} icon={Clock4} tone={GOLD} />
            <StatCard label="Delivery Rate" value={`${em.deliveryRate ?? 0}%`} icon={CheckCircle2} tone={GREEN} />
            <StatCard label="Failure Rate" value={`${em.failureRate ?? 0}%`} icon={TrendingUp} tone={RED} />
          </Section>

          {/* 7 — NOTIFICATION HEALTH */}
          <Section title="Notification Health" icon={Bell}>
            <StatCard label="Sent Today" value={fmtNum(nt.sentToday)} icon={Send} tone={GREEN} />
            <StatCard label="Unread" value={fmtNum(nt.unread)} icon={Bell} tone={GOLD} />
            <StatCard label="Failed" value={fmtNum(nt.failed)} icon={XCircle} tone={RED} connect={nt.failed == null} />
            <div className="ph-card" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px', gridColumn: 'span 2', minWidth: 0 }}>
              <div className="ph-card-head" style={{ display: 'flex', alignItems: 'center', gap: 7, color: MUTED, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                <Activity size={14} color={GOLD} /> Most Triggered (30d)
              </div>
              {(nt.topTypes || []).length === 0 ? (
                <div style={{ fontSize: 12.5, color: MUTED }}>No notifications yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {nt.topTypes.map((t: any) => (
                    <div key={t.type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: INK }}>{typeLabel(t.type)}</span>
                      <span style={{ color: MUTED, fontWeight: 700 }}>{t.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* 8 — ERROR TRACKING */}
          <Section title="Error Tracking" icon={AlertTriangle} sub="Sentry · PostHog · Google Analytics">
            <StatCard label="Errors Today" value={fmtNum(er.today)} icon={AlertTriangle} tone={RED} connect={er.today == null} />
            <StatCard label="Critical Errors" value={fmtNum(er.critical)} icon={ShieldAlert} tone={RED} connect={er.critical == null} />
            <StatCard label="API Errors" value={fmtNum(er.api)} icon={Server} tone={AMBER} connect={er.api == null} />
            <StatCard label="Failed Jobs" value={fmtNum(er.failedJobs)} icon={XCircle} tone={RED} note="Mail past max retries" />
          </Section>

          {/* 9 — PLATFORM ALERTS */}
          <section style={{ marginBottom: 22 }}>
            <div className="ph-section-head" style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
              <AlertTriangle size={17} color={GOLD} />
              <h2 style={{ fontSize: 15, fontWeight: 800, color: INK, fontFamily: 'var(--ff)', margin: 0 }}>Platform Alerts</h2>
              <span style={{ fontSize: 12, color: MUTED }}>· {alerts.length} active</span>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
              {alerts.length === 0 ? (
                <div style={{ padding: '34px 0', textAlign: 'center', color: GREEN, fontSize: 13.5, fontWeight: 600 }}>
                  <CheckCircle2 size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} /> All clear — no active alerts.
                </div>
              ) : alerts.map((a, i) => {
                const s = SEV[a.severity] || SEV.info
                return (
                  <Link key={i} href={a.href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 16px', borderTop: i ? `1px solid ${BORDER}` : 'none', textDecoration: 'none' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={{ padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 800, background: s.bg, color: s.fg, flexShrink: 0 }}>{s.label}</span>
                      <span style={{ fontSize: 13.5, color: INK, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}</span>
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: s.fg, flexShrink: 0 }}>{a.count}</span>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* 10 — QUICK ACTIONS */}
          <section style={{ marginBottom: 10 }}>
            <div className="ph-section-head" style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
              <Zap size={17} color={GOLD} />
              <h2 style={{ fontSize: 15, fontWeight: 800, color: INK, fontFamily: 'var(--ff)', margin: 0 }}>Quick Actions</h2>
            </div>
            <div className="ph-grid">
              {QUICK.map(q => {
                const IC = q.icon
                return (
                  <Link key={q.href} href={q.href} className="ph-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px', textDecoration: 'none', color: INK, fontWeight: 700, fontSize: 13 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(201,162,39,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <IC size={17} color={GOLD} />
                    </span>
                    {q.label}
                  </Link>
                )
              })}
            </div>
          </section>

          <p style={{ fontSize: 11.5, color: MUTED, marginTop: 14, textAlign: 'center' }}>
            Live data · generated {h?.generatedAt ? new Date(h.generatedAt).toLocaleTimeString() : '—'}. Tiles marked “Connect” activate once Google Analytics / Sentry are wired.
          </p>
        </>
      )}
    </AdminLayout>
  )
}
