// qmg-admin: src/app/verification-queue/page.tsx
'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { ShieldCheck, Eye, CheckCircle, XCircle, ChevronDown, ChevronUp, FileText } from 'lucide-react'

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
  profile_photo_url: string | null
  intro_video_url: string | null
  submitted_at: string | null
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

const TIER_CONFIG: { key: TierKey; label: string; icon: string; color: string; bgColor: string }[] = [
  { key: 'phone',        label: 'Phone Verified',        icon: '📱', color: '#6B7280', bgColor: '#F3F4F6' },
  { key: 'identity',     label: 'Identity Verified',     icon: '🛡️', color: '#1E40AF', bgColor: '#EFF6FF' },
  { key: 'quran_mentor', label: 'Quran Mentor Verified', icon: '📖', color: '#1B5E37', bgColor: '#E8F5EE' },
  { key: 'ijazah',       label: 'Ijazah Verified',       icon: '🏅', color: '#92710A', bgColor: '#FDF8E8' },
]

export default function VerificationQueuePage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [docUrls, setDocUrls] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<'all' | 'pending' | 'identity' | 'quran_mentor' | 'ijazah'>('all')

  useEffect(() => { fetchQueue() }, [])

  async function fetchQueue() {
    setLoading(true)
    try {
      const res = await fetch('/api/verification-queue')
      const data = await res.json()
      setTeachers(Array.isArray(data) ? data : [])
    } catch {
      showToast('❌ Failed to load verification queue')
    }
    setLoading(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  async function loadSignedUrl(docUrl: string) {
    if (!docUrl) return
    // Extract path from URL — the URL might be a full Supabase storage URL
    // or just a path. We need the path relative to the bucket.
    let path = docUrl
    if (docUrl.includes('verification-documents/')) {
      path = docUrl.split('verification-documents/').pop() || docUrl
    }
    try {
      const res = await fetch(`/api/signed-url?bucket=verification-documents&path=${encodeURIComponent(path)}`)
      const data = await res.json()
      if (data.signedUrl) {
        setDocUrls(prev => ({ ...prev, [docUrl]: data.signedUrl }))
      }
    } catch {
      showToast('❌ Failed to load document')
    }
  }

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

      showToast(`✅ ${tier.replace('_', ' ')} ${action}d successfully`)
      fetchQueue() // Refresh the list
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`)
    }
    setActionLoading(null)
  }

  function getName(t: Teacher) {
    const p = t.profiles
    return p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'Unknown'
  }

  function getPendingTiers(t: Teacher): TierKey[] {
    const tiers: TierKey[] = []
    if (!t.phone_verified) tiers.push('phone')
    if (t.identity_document_url && !t.identity_verified) tiers.push('identity')
    if (!t.quran_mentor_verified && t.status === 'approved') tiers.push('quran_mentor')
    if (t.ijazah_document_url && !t.ijazah_verified) tiers.push('ijazah')
    return tiers
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

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: 24, right: 24, zIndex: 200,
            background: toast.startsWith('✅') ? '#1B5E37' : '#DC2626',
            color: '#fff', padding: '12px 20px', borderRadius: 12,
            fontSize: 14, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          }}>
            {toast}
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 800, color: '#097434', margin: 0 }}>
              Verification Queue
            </h1>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>
              Review and approve teacher verification tiers
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {(['all', 'pending', 'identity', 'quran_mentor', 'ijazah'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  border: '1.5px solid',
                  borderColor: filter === f ? '#1B5E37' : '#E5E7EB',
                  background: filter === f ? '#1B5E37' : '#fff',
                  color: filter === f ? '#fff' : '#6B7280',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {f === 'all' ? 'All' : f === 'pending' ? 'New Applications' : f === 'identity' ? '🛡️ ID' : f === 'quran_mentor' ? '📖 QM' : '🏅 Ijazah'}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            Loading verification queue…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: 60, background: '#fff',
            borderRadius: 16, border: '1px dashed #E5E7EB',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ fontWeight: 700, color: '#097434', fontSize: 16 }}>Queue is clear!</p>
            <p style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4 }}>No pending verification requests.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(teacher => {
              const isExpanded = expanded === teacher.id
              const pendingTiers = getPendingTiers(teacher)
              const verifiedCount = getVerifiedCount(teacher)
              const name = getName(teacher)

              return (
                <div
                  key={teacher.id}
                  style={{
                    background: '#fff', borderRadius: 16,
                    border: `1.5px solid ${teacher.status === 'pending' ? '#FDE68A' : '#E5E7EB'}`,
                    overflow: 'hidden', transition: 'all 0.2s',
                  }}
                >
                  {/* Header row */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : teacher.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 20px', cursor: 'pointer', border: 'none', background: 'transparent',
                      textAlign: 'left', gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                        background: teacher.profile_photo_url ? undefined : 'linear-gradient(135deg, #1B5E37, #097434)',
                        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: 16,
                      }}>
                        {teacher.profile_photo_url
                          ? <img src={teacher.profile_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : (teacher.profiles?.first_name?.[0] || '?').toUpperCase()
                        }
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: '#1A1A1A' }}>{name}</span>
                          {teacher.status === 'pending' && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                              background: '#FEF3C7', color: '#D97706',
                            }}>NEW APPLICATION</span>
                          )}
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                            {verifiedCount}/4 tiers
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                          {teacher.profiles?.email} · {teacher.profiles?.country || 'N/A'}
                          {teacher.submitted_at && ` · Submitted ${new Date(teacher.submitted_at).toLocaleDateString()}`}
                        </div>
                      </div>
                    </div>

                    {/* Tier status dots */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                      <span title="Basic" style={{ width: 10, height: 10, borderRadius: '50%', background: (teacher.email_verified && teacher.phone_verified) ? '#22C55E' : '#E5E7EB' }} />
                      <span title="Identity" style={{ width: 10, height: 10, borderRadius: '50%', background: teacher.identity_verified ? '#3B82F6' : teacher.identity_document_url ? '#FCD34D' : '#E5E7EB' }} />
                      <span title="QM" style={{ width: 10, height: 10, borderRadius: '50%', background: teacher.quran_mentor_verified ? '#1B5E37' : '#E5E7EB' }} />
                      <span title="Ijazah" style={{ width: 10, height: 10, borderRadius: '50%', background: teacher.ijazah_verified ? '#B8952A' : teacher.ijazah_document_url ? '#FCD34D' : '#E5E7EB' }} />
                      {isExpanded ? <ChevronUp size={16} color="#9CA3AF" /> : <ChevronDown size={16} color="#9CA3AF" />}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ padding: '0 20px 20px', borderTop: '1px solid #F3F4F6' }}>

                      {/* Teacher info summary */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 12, padding: '16px 0', marginBottom: 16,
                      }}>
                        {[
                          { label: 'Experience', value: `${teacher.years_experience} years` },
                          { label: 'Phone', value: teacher.profiles?.phone || 'N/A' },
                          { label: 'Specializations', value: (teacher.specializations || []).join(', ') || 'N/A' },
                          { label: 'Languages', value: (teacher.teaching_languages || []).join(', ') || 'N/A' },
                        ].map(item => (
                          <div key={item.label} style={{
                            padding: '10px 14px', borderRadius: 10,
                            background: '#F9FAFB', border: '1px solid #F3F4F6',
                          }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                              {item.label}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                              {item.value}
                            </div>
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

                      {/* Existing notes */}
                      {teacher.verification_notes && (
                        <div style={{
                          padding: '12px 14px', borderRadius: 10, marginBottom: 16,
                          background: '#FFFBEB', border: '1px solid #FDE68A',
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                            Admin Notes History
                          </div>
                          <pre style={{ fontSize: 12, color: '#92400E', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                            {teacher.verification_notes}
                          </pre>
                        </div>
                      )}

                      {/* Per-tier verification cards */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {TIER_CONFIG.map(tierCfg => {
                          const isVerified = teacher[`${tierCfg.key}_verified` as keyof Teacher] as boolean
                          const docUrl = tierCfg.key === 'identity'
                            ? teacher.identity_document_url
                            : tierCfg.key === 'ijazah'
                              ? teacher.ijazah_document_url
                              : null
                          const hasDoc = !!docUrl
                          const needsReview = tierCfg.key === 'identity'
                            ? (hasDoc && !isVerified)
                            : tierCfg.key === 'ijazah'
                              ? (hasDoc && !isVerified)
                              : tierCfg.key === 'quran_mentor'
                                ? (!isVerified && teacher.status === 'approved')
                                : !isVerified
                          const notesKey = `${teacher.id}-${tierCfg.key}`

                          return (
                            <div
                              key={tierCfg.key}
                              style={{
                                padding: '14px 16px', borderRadius: 12,
                                border: `1.5px solid ${isVerified ? '#D1FAE5' : needsReview ? '#FDE68A' : '#F3F4F6'}`,
                                background: isVerified ? '#F0FDF4' : '#fff',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontSize: 20 }}>{tierCfg.icon}</span>
                                  <div>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1A1A1A' }}>{tierCfg.label}</span>
                                    {isVerified && (
                                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#16A34A' }}>✓ Verified</span>
                                    )}
                                    {!isVerified && needsReview && (
                                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#D97706' }}>⏳ Needs review</span>
                                    )}
                                    {!isVerified && !needsReview && (
                                      <span style={{ marginLeft: 8, fontSize: 11, color: '#9CA3AF' }}>Not submitted</span>
                                    )}
                                  </div>
                                </div>

                                {/* Action buttons */}
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                  {/* View document button */}
                                  {hasDoc && (
                                    <button
                                      onClick={() => {
                                        if (docUrls[docUrl!]) {
                                          window.open(docUrls[docUrl!], '_blank')
                                        } else {
                                          loadSignedUrl(docUrl!)
                                          showToast('Loading document… click again in a moment')
                                        }
                                      }}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                        border: '1.5px solid #3B82F6', color: '#3B82F6', background: '#EFF6FF',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Eye size={14} /> View Doc
                                    </button>
                                  )}

                                  {!isVerified && needsReview && (
                                    <>
                                      <button
                                        onClick={() => handleTierAction(teacher, tierCfg.key, 'approve')}
                                        disabled={actionLoading !== null}
                                        style={{
                                          display: 'flex', alignItems: 'center', gap: 4,
                                          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                          border: 'none', color: '#fff', background: '#1B5E37',
                                          cursor: 'pointer', opacity: actionLoading ? 0.6 : 1,
                                        }}
                                      >
                                        <CheckCircle size={14} />
                                        {actionLoading === `${teacher.id}-${tierCfg.key}-approve` ? 'Approving…' : 'Approve'}
                                      </button>
                                      <button
                                        onClick={() => handleTierAction(teacher, tierCfg.key, 'reject')}
                                        disabled={actionLoading !== null}
                                        style={{
                                          display: 'flex', alignItems: 'center', gap: 4,
                                          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                          border: '1.5px solid #FECACA', color: '#DC2626', background: '#FEF2F2',
                                          cursor: 'pointer', opacity: actionLoading ? 0.6 : 1,
                                        }}
                                      >
                                        <XCircle size={14} />
                                        {actionLoading === `${teacher.id}-${tierCfg.key}-reject` ? 'Rejecting…' : 'Reject'}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Notes input for tiers needing review */}
                              {!isVerified && needsReview && (
                                <div style={{ marginTop: 10 }}>
                                  <input
                                    type="text"
                                    placeholder={`Notes for ${tierCfg.label} decision…`}
                                    value={notes[notesKey] || ''}
                                    onChange={e => setNotes(prev => ({ ...prev, [notesKey]: e.target.value }))}
                                    style={{
                                      width: '100%', padding: '8px 12px', borderRadius: 8,
                                      border: '1.5px solid #E5E7EB', fontSize: 12, outline: 'none',
                                      fontFamily: 'inherit',
                                    }}
                                    onFocus={e => { e.currentTarget.style.borderColor = '#B8952A' }}
                                    onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
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
