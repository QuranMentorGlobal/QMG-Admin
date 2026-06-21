// qmg-admin: src/app/re-verification/page.tsx
// ────────────────────────────────────────────────────────────────────────────
// Re-Verification review. When an approved teacher edits trust-sensitive info,
// they're unlisted (status = pending_review) and a profile_change_request is
// logged with a field-level diff. Admin reviews the diff (previously approved →
// newly submitted) and Approves (re-lists), Requests Changes, or Rejects.
// Self-contained — does not touch the new-application Verification Queue.
// ────────────────────────────────────────────────────────────────────────────
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { GitCompareArrows, CheckCircle, XCircle, MessageSquareWarning, ArrowRight, Clock, ShieldAlert } from 'lucide-react'

const GOLD = '#B8952A', INK = '#1A1A1A', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F7F1E2'

type ChangeReq = {
  id: string
  teacher_user_id: string
  teacher_profile_id: string
  change_type: string
  status: string
  changes: Record<string, { from: any; to: any }>
  admin_notes: string | null
  created_at: string
  teacher_name: string
  teacher_email: string
  current_status: string | null
  previous_status?: string | null
  history?: { id: string; status: string; change_type: string; created_at: string; reviewed_at: string | null; admin_notes: string | null }[]
}

const fmt = (v: any) => Array.isArray(v) ? (v.length ? v.join(', ') : '—') : (v === null || v === undefined || v === '' ? '—' : String(v))
const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return s } }

export default function ReVerificationPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [reqs, setReqs] = useState<ChangeReq[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [toast, setToast] = useState('')

  useEffect(() => {
    (async () => { try { const sb = createClient(); const { data: { user } } = await sb.auth.getUser(); if (user) { const { data: p } = await sb.from('profiles').select('first_name').eq('id', user.id).single(); setAdminName((p as any)?.first_name || 'Admin') } } catch {} })()
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/profile-change-requests')
      const data = await res.json()
      setReqs(Array.isArray(data) ? data : [])
    } catch { showToast('❌ Failed to load re-verification queue') }
    setLoading(false)
  }

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 3500) }

  async function act(r: ChangeReq, action: 'approve' | 'reject' | 'request_changes') {
    if ((action === 'reject' || action === 'request_changes') && !(notes[r.id] || '').trim()) {
      showToast('Please add a note explaining what the teacher should do.'); return
    }
    setBusy(r.id + action)
    try {
      const res = await fetch('/api/profile-change-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: r.id, teacherUserId: r.teacher_user_id, teacherProfileId: r.teacher_profile_id, action, notes: notes[r.id] || '' }),
      })
      const j = await res.json()
      if (!res.ok || j.error) throw new Error(j.error || 'Action failed')
      showToast(action === 'approve' ? '✅ Approved — teacher re-listed' : action === 'reject' ? 'Request rejected' : 'Changes requested')
      setReqs(prev => prev.filter(x => x.id !== r.id))
    } catch (e: any) { showToast('❌ ' + (e.message || 'Action failed')) }
    setBusy(null)
  }

  return (
    <AdminLayout adminName={adminName}>
      {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 90, padding: '12px 18px', borderRadius: 12, background: toast.startsWith('✅') ? GOLD : toast.startsWith('❌') ? '#DC2626' : INK, color: toast.startsWith('✅') ? '#1A1400' : '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>{toast}</div>}

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 800, color: INK, margin: 0 }}>
          <GitCompareArrows size={22} style={{ color: GOLD }} /> Re-Verification
        </h1>
        <p style={{ fontSize: 13, color: '#6B6B6B', margin: '5px 0 0' }}>Approved teachers who changed trust-sensitive information. They stay hidden from students until you approve.</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1, 2].map(i => <div key={i} className="qmg-skel" style={{ height: 160 }} />)}</div>
      ) : reqs.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 48, textAlign: 'center' }}>
          <ShieldAlert size={34} style={{ color: MUTED, margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15, fontWeight: 800, color: INK, margin: 0 }}>No re-verification requests</p>
          <p style={{ fontSize: 13, color: MUTED, margin: '5px 0 0' }}>When a live teacher edits sensitive details, the request appears here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reqs.map(r => {
            const entries = Object.entries(r.changes || {})
            return (
              <div key={r.id} className="adminx-rise" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: '20px 22px' }}>
                {/* Header */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ fontSize: 15.5, fontWeight: 800, color: INK }}>{r.teacher_name}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: '#B91C1C', background: '#FEE2E2', borderRadius: 99, padding: '2px 8px' }}>{r.change_type === 'sensitive' ? 'Re-verify' : 'Update'}</span>
                      {r.status === 'changes_requested' && <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: '#B45309', background: '#FEF3C7', borderRadius: 99, padding: '2px 8px' }}>Changes requested</span>}
                    </div>
                    <p style={{ fontSize: 12.5, color: MUTED, margin: '3px 0 0' }}>{r.teacher_email} · submitted {fmtDate(r.created_at)} · previously <b style={{ color: '#16A34A' }}>{r.previous_status || 'approved'}</b> · currently <b style={{ color: r.current_status === 'approved' ? '#16A34A' : '#B45309' }}>{r.current_status || 'unknown'}</b></p>
                    {r.history && r.history.length > 0 && (
                      <details style={{ marginTop: 6 }}>
                        <summary style={{ fontSize: 11.5, fontWeight: 700, color: GOLD, cursor: 'pointer' }}>Verification history ({r.history.length})</summary>
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {r.history.map(h => (
                            <div key={h.id} style={{ fontSize: 11.5, color: MUTED, display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ fontWeight: 800, color: h.status === 'approved' ? '#16A34A' : '#B91C1C', textTransform: 'capitalize' }}>{h.status}</span>
                              <span>{fmtDate(h.reviewed_at || h.created_at)}</span>
                              {h.admin_notes && <span style={{ fontStyle: 'italic' }}>· {h.admin_notes}</span>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#B45309', background: '#FEF3C7', borderRadius: 99, padding: '4px 11px' }}><Clock size={13} /> Hidden from students</span>
                </div>

                {/* Diff */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {entries.length === 0 ? (
                    <p style={{ fontSize: 13, color: MUTED }}>No field-level detail recorded.</p>
                  ) : entries.map(([label, val]) => (
                    <div key={label} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12, alignItems: 'center', background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px' }} className="qmg-diffrow">
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: INK }}>{label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
                        <span style={{ color: '#9A9A8A', textDecoration: 'line-through' }}>{fmt(val?.from)}</span>
                        <ArrowRight size={14} style={{ color: GOLD, flexShrink: 0 }} />
                        <span style={{ fontWeight: 800, color: '#15803D', background: '#DCFCE7', borderRadius: 7, padding: '2px 9px' }}>{fmt(val?.to)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notes + actions */}
                <textarea
                  value={notes[r.id] || ''}
                  onChange={e => setNotes(p => ({ ...p, [r.id]: e.target.value }))}
                  rows={2}
                  placeholder="Optional note for approve · required for reject / request changes"
                  style={{ width: '100%', padding: '10px 13px', borderRadius: 11, border: `1.5px solid ${BORDER}`, fontSize: 13, outline: 'none', fontFamily: "'Inter',sans-serif", color: INK, background: '#fff', boxSizing: 'border-box', resize: 'vertical', marginBottom: 12 }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <button onClick={() => act(r, 'approve')} disabled={!!busy} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: 'none', cursor: 'pointer', background: '#16A34A', color: '#fff', fontSize: 13, fontWeight: 800, opacity: busy ? 0.6 : 1 }}><CheckCircle size={15} /> {busy === r.id + 'approve' ? 'Approving…' : 'Approve & Re-list'}</button>
                  <button onClick={() => act(r, 'request_changes')} disabled={!!busy} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: `1.5px solid ${GOLD}`, cursor: 'pointer', background: '#fff', color: '#8A6D1E', fontSize: 13, fontWeight: 800, opacity: busy ? 0.6 : 1 }}><MessageSquareWarning size={15} /> Request Changes</button>
                  <button onClick={() => act(r, 'reject')} disabled={!!busy} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: '1.5px solid #FCA5A5', cursor: 'pointer', background: '#fff', color: '#DC2626', fontSize: 13, fontWeight: 800, opacity: busy ? 0.6 : 1 }}><XCircle size={15} /> Reject</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        .adminx-rise{animation:qmgrise .4s ease both}@keyframes qmgrise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .qmg-skel{background:linear-gradient(90deg,#F1ECE2 25%,#E8E2D6 50%,#F1ECE2 75%);background-size:200% 100%;animation:qmgsh 1.4s infinite;border-radius:14px}@keyframes qmgsh{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @media(max-width:560px){ .qmg-diffrow{grid-template-columns:1fr!important} }
      `}</style>
    </AdminLayout>
  )
}
