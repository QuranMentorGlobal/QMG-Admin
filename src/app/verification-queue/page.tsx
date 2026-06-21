// qmg-admin: src/app/verification-queue/page.tsx
'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { ShieldCheck, Eye, CheckCircle, XCircle, ChevronDown, ChevronUp, FileText, Play, Clock } from 'lucide-react'

type Teacher = {
  id: string
  user_id: string
  status: string
  email_verified: boolean
  phone_verified: boolean
  identity_verified: boolean
  identity_document_url: string | null
  quran_mentor_verified: boolean
  ijazah_verified: boolean
  ijazah_document_url: string | null
  verification_notes: string | null
  years_experience: number
  specializations: string[]
  teaching_languages: string[]
  hourly_rate_usd: number
  trial_rate_usd: number
  available_days: string[]
  profile_photo_url: string | null
  intro_video_url: string | null
  submitted_at: string | null
  rejection_reason: string | null
  profiles: {
    first_name: string
    last_name: string
    email: string
    country: string
    phone: string
    bio: string
  }
}

type TierKey = 'identity' | 'quran_mentor' | 'ijazah' | 'phone'

const TIER_CONFIG: { key: TierKey; label: string; color: string }[] = [
  { key: 'phone',        label: 'Phone Verified',        color: '#6B7280' },
  { key: 'identity',     label: 'Identity Verified',     color: '#1E40AF' },
  { key: 'quran_mentor', label: 'Quran Mentor Verified', color: '#B8952A' },
  { key: 'ijazah',       label: 'Ijazah Verified',       color: '#92710A' },
]

function TierIcon({ k, color, size = 18 }: { k: string; color: string; size?: number }) {
  const c = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (k === 'phone')        return (<svg {...c}><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>)
  if (k === 'identity')     return (<svg {...c}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>)
  if (k === 'quran_mentor') return (<svg {...c}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>)
  if (k === 'ijazah')       return (<svg {...c}><circle cx="12" cy="8" r="6"/><path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12"/></svg>)
  return null
}

export default function VerificationQueuePage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ m: string; k: 'success' | 'error' } | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [docUrls, setDocUrls] = useState<Record<string, string>>({})
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'identity' | 'quran_mentor' | 'ijazah'>('all')

  useEffect(() => { fetchQueue() }, [])

  async function fetchQueue() {
    setLoading(true)
    try {
      const res = await fetch('/api/verification-queue')
      const data = await res.json()
      if (Array.isArray(data)) {
        setTeachers(data)
      } else {
        setTeachers([])
        showToastErr('Queue error: ' + (data?.error || 'unexpected response'))
      }
    } catch {
      showToastErr('Failed to load verification queue')
    }
    setLoading(false)
  }

  function showToast(msg: string, kind: 'success' | 'error' = 'success') {
    setToast({ m: msg, k: kind })
    setTimeout(() => setToast(null), 4000)
  }
  const showToastErr = (m: string) => showToast(m, 'error')

  async function loadSignedUrl(docUrl: string) {
    if (!docUrl) return
    let path = docUrl
    if (docUrl.includes('verification-documents/')) {
      path = docUrl.split('verification-documents/').pop() || docUrl
    }
    try {
      const res = await fetch(`/api/signed-url?bucket=verification-documents&path=${encodeURIComponent(path)}`)
      const data = await res.json()
      if (data.signedUrl) {
        setDocUrls(prev => ({ ...prev, [docUrl]: data.signedUrl }))
        window.open(data.signedUrl, '_blank')
      } else {
        showToastErr('Failed to load document')
      }
    } catch {
      showToastErr('Failed to load document')
    }
  }

  // ── Initial application approve/reject ──
  async function handleApplicationAction(teacher: Teacher, action: 'approved' | 'rejected') {
    if (action === 'rejected' && !notes[`${teacher.id}-app`]?.trim()) {
      showToastErr('Please provide a rejection reason')
      return
    }
    setActionLoading(`${teacher.id}-app-${action}`)
    try {
      const res = await fetch('/api/review-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: teacher.id,
          userId: teacher.user_id,
          action,
          reason: notes[`${teacher.id}-app`] || '',
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      showToast(action === 'approved' ? 'Teacher approved and now live!' : 'Application rejected')
      fetchQueue()
    } catch (err: any) {
      showToastErr(`Error: ${err.message}`)
    }
    setActionLoading(null)
  }

  // ── Per-tier approve/reject ──
  async function handleTierAction(teacher: Teacher, tier: TierKey, action: 'approve' | 'reject') {
    const loadingKey = `${teacher.id}-${tier}-${action}`
    setActionLoading(loadingKey)
    try {
      const res = await fetch('/api/verification-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherProfileId: teacher.id,
          userId: teacher.user_id,
          tier,
          action,
          notes: notes[`${teacher.id}-${tier}`] || '',
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      showToast(`${tier.replace('_', ' ')} ${action}d successfully`)
      fetchQueue()
    } catch (err: any) {
      showToastErr(`Error: ${err.message}`)
    }
    setActionLoading(null)
  }

  function getName(t: Teacher) {
    const p = t.profiles
    return p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'Unknown'
  }

  function getVerifiedCount(t: Teacher): number {
    let count = 0
    if (t.email_verified && t.phone_verified) count++
    if (t.identity_verified) count++
    if (t.quran_mentor_verified) count++
    if (t.ijazah_verified) count++
    return count
  }

  const filtered = teachers.filter(t => {
    if (filter === 'all') return true
    if (filter === 'pending') return t.status === 'pending'
    if (filter === 'identity') return t.identity_document_url && !t.identity_verified
    if (filter === 'quran_mentor') return !t.quran_mentor_verified && t.status === 'approved'
    if (filter === 'ijazah') return t.ijazah_document_url && !t.ijazah_verified
    return true
  })

  const pendingCount = teachers.filter(t => t.status === 'pending').length

  return (
    <AdminLayout>
     <div>
      {toast && (
          <div style={{
            position: 'fixed', top: 24, right: 24, zIndex: 200,
            background: toast.k === 'error' ? '#DC2626' : '#B8952A',
            color: '#fff', padding: '12px 18px', borderRadius: 12,
            fontSize: 14, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              {toast.k === 'error' ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <polyline points="20 6 9 17 4 12"/>}
            </svg>
            {toast.m}
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>
              Verification Queue
            </h1>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>
              Approve new teachers and manage verification tiers
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {([
              { key: 'all', label: 'All' },
              { key: 'pending', label: `New Applications${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
              { key: 'identity', label: 'ID Pending' },
              { key: 'quran_mentor', label: 'QM Pending' },
              { key: 'ijazah', label: 'Ijazah Pending' },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setFilter(f.key as any)}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  border: '1.5px solid', cursor: 'pointer', transition: 'all 0.2s',
                  borderColor: filter === f.key ? '#B8952A' : '#E5E7EB',
                  background: filter === f.key ? '#B8952A' : '#fff',
                  color: filter === f.key ? '#fff' : '#6B7280',
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading / Empty */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#B8952A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg></div>
            Loading verification queue…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 16, border: '1px dashed #E5E7EB' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="16 9 11 14 8 11"/></svg></div>
            <p style={{ fontWeight: 700, color: '#1A1A1A', fontSize: 16 }}>Queue is clear!</p>
            <p style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4 }}>No pending items in this category.</p>
          </div>
        ) : (

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(teacher => {
              const isExpanded = expanded === teacher.id
              const isPending = teacher.status === 'pending'
              const name = getName(teacher)
              const verifiedCount = getVerifiedCount(teacher)

              return (
                <div key={teacher.id} className="adminx-row" style={{
                  background: '#fff', borderRadius: 16, overflow: 'hidden', transition: 'all 0.2s',
                  border: `1.5px solid ${isPending ? '#FDE68A' : '#E5E7EB'}`,
                }}>
                  {/* Collapsed header */}
                  <button onClick={() => setExpanded(isExpanded ? null : teacher.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 20px', cursor: 'pointer', border: 'none', background: 'transparent',
                      textAlign: 'left', gap: 12,
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                        background: teacher.profile_photo_url ? undefined : 'linear-gradient(135deg, #B8952A, #1A1A1A)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: 16,
                      }}>
                        {teacher.profile_photo_url
                          ? <img src={teacher.profile_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : (teacher.profiles?.first_name?.[0] || '?').toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: '#1A1A1A' }}>{name}</span>
                          {isPending && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#FEF3C7', color: '#D97706' }}>
                              NEW APPLICATION
                            </span>
                          )}
                          {!isPending && (
                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{verifiedCount}/4 tiers</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                          {teacher.profiles?.email} · {teacher.profiles?.country || 'N/A'}
                          {teacher.submitted_at && ` · ${new Date(teacher.submitted_at).toLocaleDateString()}`}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                      {!isPending && (
                        <>
                          <span title="Basic" style={{ width: 10, height: 10, borderRadius: '50%', background: (teacher.email_verified && teacher.phone_verified) ? '#22C55E' : '#E5E7EB' }} />
                          <span title="Identity" style={{ width: 10, height: 10, borderRadius: '50%', background: teacher.identity_verified ? '#3B82F6' : teacher.identity_document_url ? '#FCD34D' : '#E5E7EB' }} />
                          <span title="QM" style={{ width: 10, height: 10, borderRadius: '50%', background: teacher.quran_mentor_verified ? '#B8952A' : '#E5E7EB' }} />
                          <span title="Ijazah" style={{ width: 10, height: 10, borderRadius: '50%', background: teacher.ijazah_verified ? '#B8952A' : teacher.ijazah_document_url ? '#FCD34D' : '#E5E7EB' }} />
                        </>
                      )}
                      {isPending && <Clock size={16} color="#D97706" />}
                      {isExpanded ? <ChevronUp size={16} color="#9CA3AF" /> : <ChevronDown size={16} color="#9CA3AF" />}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ padding: '0 20px 20px', borderTop: '1px solid #F3F4F6' }}>

                      {/* Teacher info grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, padding: '16px 0' }}>
                        {[
                          { label: 'Experience', value: `${teacher.years_experience} years` },
                          { label: 'Phone', value: teacher.profiles?.phone || 'N/A' },
                          { label: 'Hourly Rate', value: `$${teacher.hourly_rate_usd}` },
                          { label: 'Trial Rate', value: teacher.trial_rate_usd ? `$${teacher.trial_rate_usd}` : 'Free' },
                          { label: 'Specializations', value: (teacher.specializations || []).join(', ') || 'N/A' },
                          { label: 'Languages', value: (teacher.teaching_languages || []).join(', ') || 'N/A' },
                          { label: 'Available Days', value: (teacher.available_days || []).map((d: string) => d.slice(0, 3)).join(', ') || 'N/A' },
                        ].map(item => (
                          <div key={item.label} style={{ padding: '8px 12px', borderRadius: 10, background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{item.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{item.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Bio */}
                      {teacher.profiles?.bio && (
                        <div style={{ padding: '12px 14px', borderRadius: 10, background: '#F9FAFB', border: '1px solid #F3F4F6', marginBottom: 16 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Bio</div>
                          <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6 }}>{teacher.profiles.bio}</div>
                        </div>
                      )}

                      {/* Intro video */}
                      {teacher.intro_video_url && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Intro Video</div>
                          {playingVideo === teacher.id ? (
                            <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', position: 'relative' }}>
                              <video controls autoPlay style={{ width: '100%', maxHeight: 300, display: 'block' }}>
                                <source src={teacher.intro_video_url} />
                              </video>
                              <button onClick={() => setPlayingVideo(null)}
                                style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6, color: '#fff', padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                                Close
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setPlayingVideo(teacher.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10,
                                border: '1.5px solid #B8952A', background: '#F7F1E2', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#B8952A',
                              }}>
                              <Play size={16} /> Watch Introduction Video
                            </button>
                          )}
                        </div>
                      )}

                      {/* Admin notes history */}
                      {teacher.verification_notes && (
                        <div style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 16, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Admin Notes History</div>
                          <pre style={{ fontSize: 12, color: '#92400E', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{teacher.verification_notes}</pre>
                        </div>
                      )}

                      {/* ════ PENDING: Application Approve/Reject ════ */}
                      {isPending && (
                        <div style={{ padding: 16, borderRadius: 12, border: '2px solid #FDE68A', background: '#FFFBEB', marginBottom: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <Clock size={18} color="#D97706" />
                            <span style={{ fontWeight: 700, fontSize: 14, color: '#92400E' }}>Application Decision</span>
                          </div>
                          <p style={{ fontSize: 12, color: '#92400E', marginBottom: 12, lineHeight: 1.5 }}>
                            This teacher is applying to join the platform. Approving makes their profile live and visible to students.
                          </p>
                          <input type="text" placeholder="Notes / rejection reason (required for rejection)..."
                            value={notes[`${teacher.id}-app`] || ''}
                            onChange={e => setNotes(prev => ({ ...prev, [`${teacher.id}-app`]: e.target.value }))}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 12 }}
                            onFocus={e => { e.currentTarget.style.borderColor = '#B8952A' }}
                            onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                          />
                          <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => handleApplicationAction(teacher, 'approved')}
                              disabled={actionLoading !== null}
                              style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                                border: 'none', color: '#fff', background: '#B8952A', cursor: 'pointer',
                                opacity: actionLoading ? 0.6 : 1,
                              }}>
                              <CheckCircle size={16} />
                              {actionLoading === `${teacher.id}-app-approved` ? 'Approving…' : 'Approve Teacher'}
                            </button>
                            <button onClick={() => handleApplicationAction(teacher, 'rejected')}
                              disabled={actionLoading !== null}
                              style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                                border: '1.5px solid #FECACA', color: '#DC2626', background: '#FEF2F2', cursor: 'pointer',
                                opacity: actionLoading ? 0.6 : 1,
                              }}>
                              <XCircle size={16} />
                              {actionLoading === `${teacher.id}-app-rejected` ? 'Rejecting…' : 'Reject'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ════ APPROVED: Per-tier verification ════ */}
                      {!isPending && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                            Verification Tiers
                          </div>
                          {TIER_CONFIG.map(tierCfg => {
                            const isVerified = teacher[`${tierCfg.key}_verified` as keyof Teacher] as boolean
                            const docUrl = tierCfg.key === 'identity' ? teacher.identity_document_url
                              : tierCfg.key === 'ijazah' ? teacher.ijazah_document_url : null
                            const hasDoc = !!docUrl
                            const needsReview = tierCfg.key === 'identity' ? (hasDoc && !isVerified)
                              : tierCfg.key === 'ijazah' ? (hasDoc && !isVerified)
                              : tierCfg.key === 'quran_mentor' ? (!isVerified)
                              : !isVerified
                            const notesKey = `${teacher.id}-${tierCfg.key}`

                            return (
                              <div key={tierCfg.key} style={{
                                padding: '14px 16px', borderRadius: 12,
                                border: `1.5px solid ${isVerified ? '#D1FAE5' : needsReview ? '#FDE68A' : '#F3F4F6'}`,
                                background: isVerified ? '#F0FDF4' : '#fff',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <TierIcon k={tierCfg.key} color={tierCfg.color} size={18} />
                                    <div>
                                      <span style={{ fontWeight: 700, fontSize: 13, color: '#1A1A1A' }}>{tierCfg.label}</span>
                                      {isVerified && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#16A34A', display: 'inline-flex', alignItems: 'center', gap: 4 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Verified</span>}
                                      {!isVerified && needsReview && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#D97706', display: 'inline-flex', alignItems: 'center', gap: 4 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>Needs review</span>}
                                      {!isVerified && !needsReview && <span style={{ marginLeft: 8, fontSize: 11, color: '#9CA3AF' }}>Not submitted</span>}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                    {hasDoc && (
                                      <button onClick={() => loadSignedUrl(docUrl!)}
                                        style={{
                                          display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8,
                                          fontSize: 12, fontWeight: 600, border: '1.5px solid #3B82F6', color: '#3B82F6', background: '#EFF6FF', cursor: 'pointer',
                                        }}>
                                        <Eye size={14} /> View Doc
                                      </button>
                                    )}
                                    {!isVerified && needsReview && (
                                      <>
                                        <button onClick={() => handleTierAction(teacher, tierCfg.key, 'approve')}
                                          disabled={actionLoading !== null}
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8,
                                            fontSize: 12, fontWeight: 600, border: 'none', color: '#fff', background: '#B8952A', cursor: 'pointer',
                                            opacity: actionLoading ? 0.6 : 1,
                                          }}>
                                          <CheckCircle size={14} />
                                          {actionLoading === `${teacher.id}-${tierCfg.key}-approve` ? '...' : 'Approve'}
                                        </button>
                                        <button onClick={() => handleTierAction(teacher, tierCfg.key, 'reject')}
                                          disabled={actionLoading !== null}
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8,
                                            fontSize: 12, fontWeight: 600, border: '1.5px solid #FECACA', color: '#DC2626', background: '#FEF2F2', cursor: 'pointer',
                                            opacity: actionLoading ? 0.6 : 1,
                                          }}>
                                          <XCircle size={14} />
                                          {actionLoading === `${teacher.id}-${tierCfg.key}-reject` ? '...' : 'Reject'}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                                {!isVerified && needsReview && (
                                  <div style={{ marginTop: 10 }}>
                                    <input type="text" placeholder={`Notes for ${tierCfg.label} decision…`}
                                      value={notes[notesKey] || ''}
                                      onChange={e => setNotes(prev => ({ ...prev, [notesKey]: e.target.value }))}
                                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
                                      onFocus={e => { e.currentTarget.style.borderColor = '#B8952A' }}
                                      onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
