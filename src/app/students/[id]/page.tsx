// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/students/[id]/page.tsx
// Student detail — learning activity, spend, course enrollment + booking
// history, retention & engagement. Reads /api/student-detail/[id].
// ============================================================
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import {
  ArrowLeft, Wallet, BookOpen, GraduationCap, CheckCircle2, Activity,
  Repeat, MapPin, Calendar, Phone, TrendingUp, Clock,
} from 'lucide-react'

const GOLD = '#C9A227', INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F8F5EE', GREEN = '#16A34A', RED = '#DC2626'

function money(n: number) { if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(1) + 'k'; return '$' + Math.round(n).toLocaleString() }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—' }

const ENGAGE: Record<string, { c: string; bg: string }> = {
  'Active': { c: GREEN, bg: 'rgba(22,163,74,0.1)' },
  'Cooling off': { c: GOLD, bg: CREAM },
  'At risk': { c: RED, bg: '#FEE2E2' },
  'No activity': { c: MUTED, bg: '#FAFAF7' },
}

function Stat({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="adminx-stat" style={{ background: '#fff', borderRadius: 16, padding: '16px 18px', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} style={{ color: GOLD }} /></div>
        <p style={{ fontSize: 11.5, color: MUTED, margin: 0, fontWeight: 600 }}>{label}</p>
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color: accent ? GOLD : INK, margin: 0, lineHeight: 1, fontFamily: "'Fraunces',serif" }}>{value}</p>
      {sub && <p style={{ fontSize: 10.5, color: MUTED, margin: '5px 0 0' }}>{sub}</p>}
    </div>
  )
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [adminName, setAdminName] = useState('Admin')
  const [d, setD] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const sb = createClient(); const { data: { user } } = await sb.auth.getUser()
        if (user) { const { data: p } = await sb.from('profiles').select('first_name').eq('id', user.id).single(); setAdminName((p as any)?.first_name || 'Admin') }
      } catch {}
    })()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/student-detail/${id}`)
      if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error || 'Could not load student'); setLoading(false); return }
      setD(await res.json())
    } catch { setErr('Could not load student') }
    setLoading(false)
  }
  useEffect(() => { if (id) load() }, [id])

  async function toggleActive() {
    if (!d) return
    setBusy(true)
    await fetch('/api/student-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: d.profile.id, isActive: !d.profile.isActive }) })
    await load(); setBusy(false)
  }

  const p = d?.profile, m = d?.metrics
  const eng = m ? (ENGAGE[m.engagement] || ENGAGE['No activity']) : ENGAGE['No activity']

  return (
    <AdminLayout adminName={adminName}>
      <button onClick={() => router.push('/students')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Back to Students
      </button>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="qmg-skel" style={{ height: 120 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>{[...Array(6)].map((_, i) => <div key={i} className="qmg-skel" style={{ height: 92 }} />)}</div>
        </div>
      ) : err ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: 0 }}>{err}</p>
        </div>
      ) : p && (
        <>
          {/* Header */}
          <div className="adminx-rise" style={{ background: '#fff', borderRadius: 18, padding: '22px 24px', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 26, fontWeight: 800, flexShrink: 0, fontFamily: "'Fraunces',serif", background: p.isActive ? 'linear-gradient(135deg,#166534,#C9A227)' : '#9CA3AF' }}>
              {(p.firstName || 'S')[0]}
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 23, fontWeight: 800, color: INK, margin: 0 }}>{p.firstName} {p.lastName}</h1>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 11px', borderRadius: 999, background: p.isActive ? 'rgba(22,163,74,0.1)' : '#F1F1ED', color: p.isActive ? GREEN : MUTED }}>{p.isActive ? 'Active' : 'Inactive'}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 11px', borderRadius: 999, background: eng.bg, color: eng.c }}>{m.engagement}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8, fontSize: 12.5, color: MUTED }}>
                <span>{p.email}</span>
                {p.country && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={13} /> {p.country}</span>}
                {p.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={13} /> {p.phone}</span>}
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Calendar size={13} /> Joined {fmtDate(p.createdAt)}</span>
              </div>
            </div>
            <button onClick={toggleActive} disabled={busy} style={{ padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, flexShrink: 0, background: p.isActive ? '#FEE2E2' : 'linear-gradient(135deg,#166534,#C9A227)', color: p.isActive ? RED : '#111111', opacity: busy ? 0.6 : 1 }}>
              {busy ? '…' : p.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>

          {/* Learning + spend KPIs */}
          <div className="qmg-grid3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
            <Stat icon={Wallet} label="Total Spent" value={money(m.totalSpent)} accent sub={`${m.paidCount} payments`} />
            <Stat icon={CheckCircle2} label="Lessons Completed" value={String(m.completed)} sub={`${m.cancelled} cancelled`} />
            <Stat icon={GraduationCap} label="Courses Enrolled" value={String(m.enrollments)} sub="Distinct courses" />
            <Stat icon={BookOpen} label="Total Bookings" value={String(m.total)} sub={`${m.upcoming} upcoming`} />
            <Stat icon={TrendingUp} label="Trial → Paid" value={`${m.trialToPaid}%`} sub={`${m.trial} trial · ${m.paid} paid`} />
            <Stat icon={Clock} label="Last Active" value={m.daysSince === null ? 'Never' : m.daysSince === 0 ? 'Today' : `${m.daysSince}d ago`} sub={fmtDate(m.lastActivity)} />
          </div>

          {/* Retention / engagement */}
          <div className="qmg-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
            <div className="adminx-rise" style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: `1px solid ${BORDER}` }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: INK, margin: '0 0 14px', fontFamily: "'Fraunces',serif" }}><Activity size={16} style={{ color: GOLD }} /> Engagement & Retention</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                <Indicator icon={Repeat} ok={m.isRepeatBuyer} okText="Repeat purchaser" noText="Single purchase only" />
                <Indicator icon={CheckCircle2} ok={m.completed > 0} okText={`${m.completed} lessons completed`} noText="No completed lessons yet" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11, background: eng.bg, border: `1px solid ${BORDER}` }}>
                  <Activity size={16} style={{ color: eng.c }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>Status: <strong style={{ color: eng.c }}>{m.engagement}</strong>{m.daysSince !== null ? ` · last seen ${m.daysSince}d ago` : ''}</span>
                </div>
              </div>
            </div>
            <div className="adminx-rise" style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: `1px solid ${BORDER}` }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: INK, margin: '0 0 14px', fontFamily: "'Fraunces',serif" }}>Activity Summary</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                <Row label="Trial lessons" value={String(m.trial)} />
                <Row label="Paid lessons" value={String(m.paid)} />
                <Row label="Completed" value={String(m.completed)} />
                <Row label="Cancelled" value={String(m.cancelled)} />
                <Row label="Lifetime value" value={money(m.totalSpent)} />
              </div>
            </div>
          </div>

          {/* Booking history */}
          <div className="adminx-rise" style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: `1px solid ${BORDER}` }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: INK, margin: '0 0 14px', fontFamily: "'Fraunces',serif" }}>Booking History</h2>
            {(!d.recent || d.recent.length === 0) ? <p style={{ fontSize: 12.5, color: MUTED, margin: 0 }}>No bookings yet.</p>
              : <div style={{ display: 'flex', flexDirection: 'column' }}>
                {d.recent.map((b: any, i: number) => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < d.recent.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: INK, margin: 0 }}>{b.course}{b.isTrial ? ' · Trial' : ''}</p>
                      <p style={{ fontSize: 11, color: MUTED, margin: '2px 0 0' }}>{fmtDate(b.date)}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8, textTransform: 'capitalize', background: b.status === 'completed' ? 'rgba(22,163,74,0.1)' : b.status === 'cancelled' ? '#FEE2E2' : CREAM, color: b.status === 'completed' ? GREEN : b.status === 'cancelled' ? RED : GOLD }}>{b.status}</span>
                  </div>
                ))}
              </div>}
          </div>

          <style>{`
            .qmg-skel{background:linear-gradient(90deg,#F1ECE2 25%,#E8E2D6 50%,#F1ECE2 75%);background-size:200% 100%;animation:qmgsh 1.4s infinite;border-radius:14px}
            @keyframes qmgsh{0%{background-position:200% 0}100%{background-position:-200% 0}}
            @media(max-width:900px){ .qmg-grid3{grid-template-columns:repeat(2,1fr)!important} .qmg-two{grid-template-columns:1fr!important} }
            @media(max-width:520px){ .qmg-grid3{grid-template-columns:1fr!important} }
          `}</style>
        </>
      )}
    </AdminLayout>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ color: INK, fontWeight: 700 }}>{value}</span>
    </div>
  )
}
function Indicator({ icon: Icon, ok, okText, noText }: { icon: any; ok: boolean; okText: string; noText: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11, background: ok ? 'rgba(22,163,74,0.07)' : '#FAFAF7', border: `1px solid ${ok ? 'rgba(22,163,74,0.25)' : BORDER}` }}>
      <Icon size={16} style={{ color: ok ? GREEN : MUTED }} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: ok ? INK : MUTED }}>{ok ? okText : noText}</span>
    </div>
  )
}
