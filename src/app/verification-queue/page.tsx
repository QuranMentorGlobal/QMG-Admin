// PASTE THIS WHOLE FILE INTO:  src/app/verification-queue/page.tsx
// ════════════════════════════════════════════════════════════════════════════
// UNIFIED VERIFICATION QUEUE (Phases 7–8)
// One place for new applications AND profile re-verifications. Five clean
// statuses, an 8-point application review, a Current-vs-Submitted diff for
// changes, and three actions: Approve · Reject · Request Changes.
// Approving fires the badge engine automatically (server-side), so trust badges
// update everywhere with no manual refresh.
// ════════════════════════════════════════════════════════════════════════════
'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import RangeTabs, { withinRange } from '@/components/RangeTabs'
import {
  ShieldCheck, CheckCircle, XCircle, ChevronDown, ChevronUp, FileText, Play,
  Clock, GitCompareArrows, AlertTriangle, BadgeCheck, RefreshCw,
} from 'lucide-react'

const GOLD = '#C9A227', INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A'
const CREAM = '#F8F5EE', GREEN = '#16A34A', RED = '#DC2626', BLUE = '#1E40AF', AMBER = '#B45309'

type Teacher = {
  id: string; user_id: string; status: string
  email_verified: boolean; phone_verified: boolean; identity_verified: boolean
  identity_document_url: string | null; quran_mentor_verified: boolean
  ijazah_verified: boolean; ijazah_document_url: string | null
  verification_notes: string | null; years_experience: number
  specializations: string[]; teaching_languages: string[]
  intro_video_url: string | null; rejection_reason: string | null
  profiles: { first_name: string; last_name: string; email: string; country: string; phone: string; bio: string }
}
type ChangeReq = {
  id: string; teacher_user_id: string; teacher_profile_id: string
  status: string; change_type: string; created_at: string
  changes: Record<string, { from: any; to: any }>
  teacher_name?: string; teacher_email?: string; current_status?: string
}

// ── The five clean statuses ───────────────────────────────────────────────────
const STATUSES = [
  { key: 'pending_review',     label: 'Pending Review',          color: GOLD,  icon: Clock },
  { key: 'pending_reverify',   label: 'Pending Re-Verification', color: BLUE,  icon: GitCompareArrows },
  { key: 'action_required',    label: 'Action Required',         color: AMBER, icon: AlertTriangle },
  { key: 'verified',           label: 'Verified',                color: GREEN, icon: BadgeCheck },
  { key: 'rejected',           label: 'Rejected',                color: RED,   icon: XCircle },
] as const
type StatusKey = typeof STATUSES[number]['key']

// The credential items an admin verifies on an application.
const REVIEW_TIERS = [
  { key: 'identity', label: 'Identity', flag: 'identity_verified', doc: 'identity_document_url' },
  { key: 'phone', label: 'Phone', flag: 'phone_verified', doc: null },
  { key: 'quran_mentor', label: 'Qualifications', flag: 'quran_mentor_verified', doc: null },
  { key: 'ijazah', label: 'Certifications / Ijazah', flag: 'ijazah_verified', doc: 'ijazah_document_url' },
] as const

const FIELD_LABELS: Record<string, string> = {
  bio: 'Bio', country: 'Country', teaching_languages: 'Languages', specializations: 'Specializations',
  intro_video_url: 'Intro Video', years_experience: 'Experience', hourly_rate_usd: 'Hourly Rate',
  trial_rate_usd: 'Trial Rate', phone: 'Phone', first_name: 'First Name', last_name: 'Last Name',
}
const fmtVal = (v: any) => v == null || v === '' ? '—' : Array.isArray(v) ? (v.length ? v.join(', ') : '—') : String(v)
const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return s } }

export default function VerificationQueuePage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [reqs, setReqs] = useState<ChangeReq[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<StatusKey>('pending_review')
  const [range, setRange] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<{ m: string; k: 'success' | 'error' } | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [tRes, rRes] = await Promise.all([
        fetch('/api/verification-queue').then(r => r.json()).catch(() => []),
        fetch('/api/profile-change-requests').then(r => r.json()).catch(() => []),
      ])
      setTeachers(Array.isArray(tRes) ? tRes : [])
      setReqs(Array.isArray(rRes) ? rRes : [])
    } catch { showErr('Failed to load the verification queue') }
    setLoading(false)
  }

  function show(m: string, k: 'success' | 'error' = 'success') { setToast({ m, k }); setTimeout(() => setToast(null), 3800) }
  const showErr = (m: string) => show(m, 'error')

  async function openDoc(docUrl: string) {
    if (!docUrl) return
    let path = docUrl
    if (docUrl.includes('verification-documents/')) path = docUrl.split('verification-documents/').pop() || docUrl
    try {
      const r = await fetch(`/api/signed-url?bucket=verification-documents&path=${encodeURIComponent(path)}`)
      const d = await r.json()
      if (d.signedUrl) window.open(d.signedUrl, '_blank'); else showErr('Could not open document')
    } catch { showErr('Could not open document') }
  }

  async function decideApplication(t: Teacher, action: 'approved' | 'rejected' | 'changes_requested') {
    const reason = notes[`app-${t.id}`] || ''
    if ((action === 'rejected' || action === 'changes_requested') && !reason.trim()) { showErr('Add a note explaining what is needed'); return }
    setBusy(`app-${t.id}-${action}`)
    try {
      const r = await fetch('/api/review-teacher', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, userId: t.user_id, action, reason }),
      })
      const text = await r.text(); const d = text ? JSON.parse(text) : {}
      if (!r.ok || d.error) throw new Error(d.error || 'Action failed')
      show(action === 'approved' ? 'Approved — teacher is live and badges updated' : action === 'rejected' ? 'Application rejected' : 'Changes requested')
      load()
    } catch (e: any) { showErr(e.message) }
    setBusy(null)
  }

  async function tierAction(t: Teacher, tier: string, action: 'approve' | 'reject') {
    setBusy(`tier-${t.id}-${tier}-${action}`)
    try {
      const r = await fetch('/api/verification-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherProfileId: t.id, userId: t.user_id, tier, action, notes: notes[`tier-${t.id}-${tier}`] || '' }),
      })
      const text = await r.text(); const d = text ? JSON.parse(text) : {}
      if (!r.ok || d.error) throw new Error(d.error || 'Action failed')
      show(`${tier.replace('_', ' ')} ${action}d`)
      load()
    } catch (e: any) { showErr(e.message) }
    setBusy(null)
  }

  async function decideChange(r: ChangeReq, action: 'approve' | 'reject' | 'request_changes') {
    const note = notes[`req-${r.id}`] || ''
    if ((action === 'reject' || action === 'request_changes') && !note.trim()) { showErr('Add a note explaining what is needed'); return }
    setBusy(`req-${r.id}-${action}`)
    try {
      const res = await fetch('/api/profile-change-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: r.id, teacherUserId: r.teacher_user_id, teacherProfileId: r.teacher_profile_id, action, notes: note }),
      })
      const text = await res.text(); const d = text ? JSON.parse(text) : {}
      if (!res.ok || d.error) throw new Error(d.error || 'Action failed')
      show(action === 'approve' ? 'Changes approved — profile re-listed and badges updated' : action === 'reject' ? 'Changes rejected' : 'Changes requested from teacher')
      load()
    } catch (e: any) { showErr(e.message) }
    setBusy(null)
  }

  const name = (t: Teacher) => t.profiles ? `${t.profiles.first_name || ''} ${t.profiles.last_name || ''}`.trim() || 'Unknown' : 'Unknown'

  const rangedTeachers = withinRange(teachers, range, (t: any) => t.created_at)
  const rangedReqs = withinRange(reqs, range, (r: any) => r.created_at)
  const apps = {
    pending_review: rangedTeachers.filter(t => t.status === 'pending'),
    action_required: rangedTeachers.filter(t => t.status === 'changes_requested'),
    verified: rangedTeachers.filter(t => t.status === 'approved'),
    rejected: rangedTeachers.filter(t => t.status === 'rejected'),
  }
  const changes = {
    pending_reverify: rangedReqs.filter(r => r.status === 'pending'),
    action_required: rangedReqs.filter(r => r.status === 'changes_requested'),
  }
  const count: Record<StatusKey, number> = {
    pending_review: apps.pending_review.length,
    pending_reverify: changes.pending_reverify.length,
    action_required: apps.action_required.length + changes.action_required.length,
    verified: apps.verified.length,
    rejected: apps.rejected.length,
  }

  return (
    <AdminLayout>
      <div style={{ maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <ShieldCheck size={22} style={{ color: GOLD }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: INK, margin: 0, fontFamily: "'Fraunces',serif" }}>Verification Queue</h1>
          <button onClick={load} title="Refresh" style={{ marginLeft: 'auto', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: 8, cursor: 'pointer' }}><RefreshCw size={15} style={{ color: MUTED }} /></button>
        </div>
        <p style={{ color: MUTED, fontSize: 13, margin: '0 0 18px' }}>Review new applications and profile changes in one place. Approving updates the teacher, the public profile, and trust badges automatically.</p>

        <div style={{ marginBottom: 16 }}><RangeTabs value={range} onChange={setRange} /></div>

        <div className="vq-tabs" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {STATUSES.map(s => {
            const Ic = s.icon; const active = tab === s.key
            return (
              <button key={s.key} onClick={() => { setTab(s.key); setExpanded(null) }}
                className="vq-tab"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '8px 14px', borderRadius: 11, cursor: 'pointer',
                  border: `1.5px solid ${active ? s.color : BORDER}`, background: active ? s.color : '#fff', color: active ? '#fff' : INK, fontWeight: 600, fontSize: 13 }}>
                <Ic size={15} /> {s.label}
                <span style={{ background: active ? 'rgba(255,255,255,0.25)' : CREAM, color: active ? '#fff' : s.color, borderRadius: 20, padding: '1px 8px', fontSize: 12, fontWeight: 800 }}>{count[s.key]}</span>
              </button>
            )
          })}
        </div>
        <style>{`
          @media (max-width: 640px) {
            .vq-tabs { display: grid !important; grid-template-columns: 1fr 1fr; gap: 8px; }
            .vq-tab { width: 100%; }
            .vq-tab:nth-child(5) { grid-column: 1 / -1; }
          }
          @media (max-width: 380px) {
            .vq-tabs { grid-template-columns: 1fr; }
            .vq-tab:nth-child(5) { grid-column: auto; }
          }
        `}</style>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1, 2, 3].map(i => <div key={i} style={{ height: 90, borderRadius: 16, background: '#EFEADD' }} className="animate-pulse" />)}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(tab === 'pending_review' || tab === 'verified' || tab === 'rejected' || tab === 'action_required') &&
              (apps as any)[tab]?.map((t: Teacher) => (
                <ApplicationCard key={t.id} t={t} name={name(t)} expanded={expanded === t.id}
                  onToggle={() => setExpanded(expanded === t.id ? null : t.id)}
                  notes={notes} setNotes={setNotes} busy={busy} openDoc={openDoc}
                  decideApplication={decideApplication} tierAction={tierAction} showVerified={tab === 'verified'} />
              ))}

            {(tab === 'pending_reverify' || tab === 'action_required') &&
              (tab === 'pending_reverify' ? changes.pending_reverify : changes.action_required).map(r => (
                <ChangeCard key={r.id} r={r} expanded={expanded === r.id}
                  onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                  notes={notes} setNotes={setNotes} busy={busy} decideChange={decideChange} />
              ))}

            {count[tab] === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: MUTED, background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}` }}>
                Nothing in “{STATUSES.find(s => s.key === tab)?.label}”.
              </div>
            )}
          </div>
        )}

        {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, background: toast.k === 'error' ? RED : INK, color: '#fff', padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 100, maxWidth: 360 }}>{toast.m}</div>}
      </div>
    </AdminLayout>
  )
}

function ApplicationCard({ t, name, expanded, onToggle, notes, setNotes, busy, openDoc, decideApplication, tierAction, showVerified }: any) {
  const reviewables: { label: string; value: string }[] = [
    { label: 'Country', value: fmtVal(t.profiles?.country) },
    { label: 'Languages', value: fmtVal(t.teaching_languages) },
    { label: 'Specializations', value: fmtVal(t.specializations) },
    { label: 'Experience', value: `${t.years_experience || 0} yrs` },
  ]
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }} onClick={onToggle}>
        <div>
          <p style={{ fontWeight: 800, color: INK, margin: 0, fontSize: 15 }}>{name}</p>
          <p style={{ color: MUTED, fontSize: 12, margin: '2px 0 0' }}>{t.profiles?.email} · {t.profiles?.country || '—'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {showVerified && <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, background: 'rgba(22,163,74,0.1)', borderRadius: 20, padding: '3px 10px' }}>Live</span>}
          {expanded ? <ChevronUp size={18} style={{ color: MUTED }} /> : <ChevronDown size={18} style={{ color: MUTED }} />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${BORDER}` }}>
          {t.profiles?.bio && <p style={{ fontSize: 13, color: '#444', margin: '14px 0', lineHeight: 1.5 }}>{t.profiles.bio}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10, marginBottom: 16 }}>
            {reviewables.map(rv => (
              <div key={rv.label} style={{ background: CREAM, borderRadius: 10, padding: '8px 12px' }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: MUTED, margin: 0 }}>{rv.label}</p>
                <p style={{ fontSize: 13, color: INK, margin: '2px 0 0', fontWeight: 600 }}>{rv.value}</p>
              </div>
            ))}
            {t.intro_video_url && (
              <a href={t.intro_video_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, background: CREAM, borderRadius: 10, padding: '8px 12px', color: GOLD, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                <Play size={14} /> Watch intro video
              </a>
            )}
          </div>

          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: MUTED, margin: '0 0 8px' }}>Verify credentials</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {REVIEW_TIERS.map(tier => {
              const verified = !!t[tier.flag]
              const docUrl = tier.doc ? t[tier.doc] : null
              return (
                <div key={tier.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {verified ? <CheckCircle size={16} style={{ color: GREEN }} /> : <Clock size={16} style={{ color: MUTED }} />}
                    <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{tier.label}</span>
                    {docUrl && <button onClick={() => openDoc(docUrl)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: GOLD, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><FileText size={13} /> View document</button>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!verified
                      ? <button disabled={!!busy} onClick={() => tierAction(t, tier.key, 'approve')} style={btn(GREEN)}>Verify</button>
                      : <button disabled={!!busy} onClick={() => tierAction(t, tier.key, 'reject')} style={btnOutline(RED)}>Unverify</button>}
                  </div>
                </div>
              )
            })}
          </div>

          {(t.status === 'pending' || t.status === 'changes_requested') && (
            <>
              <textarea value={notes[`app-${t.id}`] || ''} onChange={e => setNotes((p: any) => ({ ...p, [`app-${t.id}`]: e.target.value }))}
                placeholder="Note to the teacher (required for Reject or Request Changes)…"
                style={{ width: '100%', minHeight: 60, padding: 10, borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 13, marginBottom: 10, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button disabled={!!busy} onClick={() => decideApplication(t, 'approved')} style={btn(GREEN)}><CheckCircle size={14} /> Approve</button>
                <button disabled={!!busy} onClick={() => decideApplication(t, 'changes_requested')} style={btn(AMBER)}><AlertTriangle size={14} /> Request Changes</button>
                <button disabled={!!busy} onClick={() => decideApplication(t, 'rejected')} style={btnOutline(RED)}><XCircle size={14} /> Reject</button>
              </div>
            </>
          )}
          {t.status === 'rejected' && t.rejection_reason && <p style={{ fontSize: 12, color: RED, marginTop: 8 }}>Rejected: {t.rejection_reason}</p>}
        </div>
      )}
    </div>
  )
}

function ChangeCard({ r, expanded, onToggle, notes, setNotes, busy, decideChange }: any) {
  const entries = Object.entries(r.changes || {}) as [string, { from: any; to: any }][]
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }} onClick={onToggle}>
        <div>
          <p style={{ fontWeight: 800, color: INK, margin: 0, fontSize: 15 }}>{r.teacher_name || 'Teacher'}</p>
          <p style={{ color: MUTED, fontSize: 12, margin: '2px 0 0' }}>{r.teacher_email} · {entries.length} change{entries.length !== 1 ? 's' : ''} submitted {fmtDate(r.created_at)}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {r.status === 'changes_requested' && <span style={{ fontSize: 11, fontWeight: 700, color: AMBER, background: '#FEF3C7', borderRadius: 20, padding: '3px 10px' }}>Changes requested</span>}
          {expanded ? <ChevronUp size={18} style={{ color: MUTED }} /> : <ChevronDown size={18} style={{ color: MUTED }} />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ margin: '14px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0,1fr) minmax(0,1fr)', gap: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: MUTED, padding: '0 0 6px' }}>
              <span>Field</span><span>Current (Approved)</span><span style={{ color: GOLD }}>Submitted</span>
            </div>
            {entries.map(([field, v]) => (
              <div key={field} style={{ display: 'grid', gridTemplateColumns: '160px minmax(0,1fr) minmax(0,1fr)', gap: 0, alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{FIELD_LABELS[field] || field}</span>
                <span style={{ fontSize: 13, color: MUTED, textDecoration: 'line-through', paddingRight: 10 }}>{fmtVal(v.from)}</span>
                <span style={{ fontSize: 13, color: INK, fontWeight: 600, background: 'rgba(201,162,39,0.1)', borderRadius: 6, padding: '3px 8px' }}>{fmtVal(v.to)}</span>
              </div>
            ))}
          </div>

          <textarea value={notes[`req-${r.id}`] || ''} onChange={e => setNotes((p: any) => ({ ...p, [`req-${r.id}`]: e.target.value }))}
            placeholder="Note to the teacher (required for Reject or Request Changes)…"
            style={{ width: '100%', minHeight: 60, padding: 10, borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 13, marginBottom: 10, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button disabled={!!busy} onClick={() => decideChange(r, 'approve')} style={btn(GREEN)}><CheckCircle size={14} /> Approve</button>
            <button disabled={!!busy} onClick={() => decideChange(r, 'request_changes')} style={btn(AMBER)}><AlertTriangle size={14} /> Request Changes</button>
            <button disabled={!!busy} onClick={() => decideChange(r, 'reject')} style={btnOutline(RED)}><XCircle size={14} /> Reject</button>
          </div>
        </div>
      )}
    </div>
  )
}

function btn(bg: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: bg, color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
}
function btnOutline(c: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: '#fff', color: c, border: `1.5px solid ${c}55`, fontWeight: 700, fontSize: 13, cursor: 'pointer' }
}
