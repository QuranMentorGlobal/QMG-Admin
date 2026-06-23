// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/teachers/[id]/page.tsx
// Teacher detail — performance, revenue, satisfaction, completion rate,
// profile completeness, verification status. Reads /api/teacher-detail/[id].
// ============================================================
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import {
  ArrowLeft, Star, DollarSign, BookOpen, CheckCircle2, XCircle, TrendingUp,
  Wallet, Percent, BadgeCheck, MapPin, Calendar, Globe, Sparkles,
} from 'lucide-react'

const GOLD = '#C9A227', INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F8F5EE', GREEN = '#16A34A', RED = '#DC2626'

function money(n: number) { return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—' }

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

function VBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 11, background: ok ? 'rgba(22,163,74,0.07)' : '#FAFAF7', border: `1px solid ${ok ? 'rgba(22,163,74,0.25)' : BORDER}` }}>
      {ok ? <CheckCircle2 size={16} style={{ color: GREEN }} /> : <XCircle size={16} style={{ color: MUTED }} />}
      <span style={{ fontSize: 12.5, fontWeight: 600, color: ok ? INK : MUTED }}>{label}</span>
    </div>
  )
}

export default function TeacherDetailPage() {
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
      const res = await fetch(`/api/teacher-detail/${id}`)
      if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error || 'Could not load teacher'); setLoading(false); return }
      setD(await res.json())
    } catch { setErr('Could not load teacher') }
    setLoading(false)
  }
  useEffect(() => { if (id) load() }, [id])

  async function toggleSuspend() {
    if (!d) return
    setBusy(true)
    const newStatus = d.profile.status === 'suspended' ? 'approved' : 'suspended'
    await fetch('/api/teacher-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherProfileId: d.profile.id, userId: d.profile.userId, status: newStatus }) })
    await load(); setBusy(false)
  }

  const p = d?.profile, m = d?.metrics, v = d?.verification
  const suspended = p?.status === 'suspended'

  return (
    <AdminLayout adminName={adminName}>
      <button onClick={() => router.push('/teachers')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Back to Teachers
      </button>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="qmg-skel" style={{ height: 120 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>{[...Array(6)].map((_, i) => <div key={i} className="qmg-skel" style={{ height: 92 }} />)}</div>
        </div>
      ) : err ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: 0 }}>{err}</p>
        </div>
      ) : p && (
        <>
          {/* Header card */}
          <div className="adminx-rise" style={{ background: '#fff', borderRadius: 18, padding: '22px 24px', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 26, fontWeight: 800, flexShrink: 0, fontFamily: "'Fraunces',serif", background: suspended ? '#9CA3AF' : 'linear-gradient(135deg,#166534,#111111)' }}>
              {(p.firstName || 'T')[0]}
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 23, fontWeight: 800, color: INK, margin: 0 }}>{p.firstName} {p.lastName}</h1>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 11px', borderRadius: 999, background: suspended ? '#FEE2E2' : 'rgba(22,163,74,0.1)', color: suspended ? RED : GREEN }}>{suspended ? 'Suspended' : 'Active'}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8, fontSize: 12.5, color: MUTED }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{p.email}</span>
                {p.country && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={13} /> {p.country}</span>}
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Calendar size={13} /> Joined {fmtDate(p.createdAt)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Star size={13} /> {m.avgRating || 'N/A'} {m.reviewCount ? `(${m.reviewCount})` : ''}</span>
              </div>
            </div>
            <button onClick={toggleSuspend} disabled={busy} style={{ padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, flexShrink: 0, background: suspended ? 'linear-gradient(135deg,#166534,#C9A227)' : '#FEE2E2', color: suspended ? '#111111' : RED, opacity: busy ? 0.6 : 1 }}>
              {busy ? '…' : suspended ? 'Reinstate' : 'Suspend'}
            </button>
          </div>

          {/* Performance KPIs */}
          <div className="qmg-grid3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
            <Stat icon={TrendingUp} label="Revenue Generated" value={money(m.revenue)} accent sub={`${m.paidLessons} paid lessons`} />
            <Stat icon={Wallet} label="Teacher Payout" value={money(m.payout)} sub="Total earned" />
            <Stat icon={Percent} label="Lesson Completion" value={`${m.completionRate}%`} sub={`${m.completed} done · ${m.cancelled} cancelled`} />
            <Stat icon={Star} label="Satisfaction" value={m.avgRating ? `${m.avgRating}/5` : 'N/A'} sub={`${m.reviewCount} reviews`} />
            <Stat icon={BookOpen} label="Total Bookings" value={String(m.totalBookings)} sub={`${m.upcoming} upcoming`} />
            <Stat icon={BadgeCheck} label="Profile Completeness" value={`${m.completeness}%`} accent sub={m.completeness >= 80 ? 'Excellent' : m.completeness >= 50 ? 'Good' : 'Needs work'} />
          </div>

          {/* Completeness bar */}
          <div className="adminx-rise" style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', border: `1px solid ${BORDER}`, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: INK }}><Sparkles size={15} style={{ color: GOLD }} /> Profile completeness</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: GOLD }}>{m.completeness}%</span>
            </div>
            <div style={{ height: 9, borderRadius: 99, background: CREAM, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${m.completeness}%`, borderRadius: 99, background: 'linear-gradient(90deg,#166534,#C9A227)', transition: 'width .8s cubic-bezier(.4,0,.2,1)' }} />
            </div>
          </div>

          {/* Verification + Profile */}
          <div className="qmg-two" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 18, marginBottom: 18 }}>
            <div className="adminx-rise" style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: `1px solid ${BORDER}` }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: INK, margin: '0 0 14px', fontFamily: "'Fraunces',serif" }}><BadgeCheck size={16} style={{ color: GOLD }} /> Verification Status</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <VBadge ok={v.identity} label="Identity Verified" />
                <VBadge ok={v.quran_mentor} label="Quran Mentor Verified" />
                <VBadge ok={v.ijazah} label="Ijazah Verified" />
                <VBadge ok={v.phone} label="Phone Verified" />
              </div>
            </div>
            <div className="adminx-rise" style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: `1px solid ${BORDER}` }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: INK, margin: '0 0 14px', fontFamily: "'Fraunces',serif" }}>Profile</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                <Row icon={DollarSign} label="Hourly Rate" value={`$${p.hourlyRate}/hr`} />
                <Row icon={Globe} label="Languages" value={(p.languages || []).join(', ') || '—'} />
                <Row icon={BookOpen} label="Specializations" value={(p.specializations || []).join(', ') || '—'} />
                <Row icon={Calendar} label="Experience" value={p.yearsExperience ? `${p.yearsExperience} years` : '—'} />
              </div>
              {p.bio && <p style={{ fontSize: 12.5, color: '#555', lineHeight: 1.55, margin: '14px 0 0', paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>{p.bio}</p>}
            </div>
          </div>

          {/* Recent bookings */}
          <div className="adminx-rise" style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: `1px solid ${BORDER}` }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: INK, margin: '0 0 14px', fontFamily: "'Fraunces',serif" }}>Recent Bookings</h2>
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
            @media(max-width:900px){ .qmg-grid3{grid-template-columns:repeat(2, minmax(0, 1fr))!important} .qmg-two{grid-template-columns:minmax(0,1fr)!important} }
            @media(max-width:520px){ .qmg-grid3{grid-template-columns:minmax(0,1fr)!important} }
          `}</style>
        </>
      )}
    </AdminLayout>
  )
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Icon size={15} style={{ color: MUTED, flexShrink: 0 }} />
      <span style={{ color: MUTED, minWidth: 110 }}>{label}</span>
      <span style={{ color: INK, fontWeight: 600, textAlign: 'right', flex: 1 }}>{value}</span>
    </div>
  )
}
