// qmg-admin: src/app/teachers/pending/page.tsx
'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { Clock, CheckCircle, XCircle, Play, Eye } from 'lucide-react'

type PendingTeacher = {
  id: string
  user_id: string
  status: string
  years_experience: number
  ijazah_verified: boolean
  specializations: string[]
  teaching_languages: string[]
  available_days: string[]
  hourly_rate_usd: number
  trial_rate_usd: number
  profile_photo_url: string
  intro_video_url: string | null
  rejection_reason: string | null
  profiles: {
    first_name: string
    last_name: string
    email: string
    country: string
    bio: string
    phone: string
  }
}

export default function PendingTeachersPage() {
  const [teachers, setTeachers] = useState<PendingTeacher[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})
  const [showReject, setShowReject] = useState<string | null>(null)
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)

  useEffect(() => { fetchPending() }, [])

  async function fetchPending() {
    setLoading(true)
    try {
      const res = await fetch('/api/pending-teachers')
      const data = await res.json()
      setTeachers(Array.isArray(data) ? data : [])
    } catch (e) {
      showToast('❌ Failed to load pending teachers')
    }
    setLoading(false)
  }

  async function handleAction(teacher: PendingTeacher, action: 'approved' | 'rejected') {
    if (action === 'rejected' && !rejectReason[teacher.id]?.trim()) {
      showToast('❌ Please provide a rejection reason')
      return
    }
    setActionLoading(teacher.id)
    try {
      const res = await fetch('/api/review-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: teacher.id,
          userId: teacher.user_id,
          action,
          reason: rejectReason[teacher.id] || null,
        }),
      })
      const data = await res.json()
      if (data.error) { showToast('❌ ' + data.error); setActionLoading(null); return }
      showToast(action === 'approved' ? '✅ Teacher approved!' : '❌ Teacher rejected.')
      setShowReject(null)
      await fetchPending()
    } catch (e) {
      showToast('❌ Action failed. Please try again.')
    }
    setActionLoading(null)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-semibold"
            style={{ background: toast.startsWith('✅') ? '#1B5E37' : '#DC2626' }}>
            {toast}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-ink">Pending Applications</h1>
            <p className="text-sm text-ink-light mt-1">
              {teachers.length} teacher{teachers.length !== 1 ? 's' : ''} awaiting review
            </p>
          </div>
          <button onClick={fetchPending}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-all">
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-28 animate-pulse" />)}
          </div>
        ) : teachers.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#F5F0E8' }}>
              <CheckCircle size={28} style={{ color: '#1B5E37' }} />
            </div>
            <p className="font-semibold text-ink">All caught up!</p>
            <p className="text-sm text-ink-light mt-1">No pending applications at the moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {teachers.map(t => {
              const name = `${t.profiles?.first_name || ''} ${t.profiles?.last_name || ''}`.trim()
              const isExpanded = expanded === t.id
              const isRejecting = showReject === t.id

              return (
                <div key={t.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                  {/* Header row */}
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Avatar */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                      {t.profile_photo_url
                        ? <img src={t.profile_photo_url} className="w-full h-full object-cover" alt={name} />
                        : <div className="w-full h-full flex items-center justify-center text-xl font-bold"
                            style={{ background: 'linear-gradient(135deg,#1B5E37,#097434)', color: '#fff' }}>
                            {(t.profiles?.first_name || 'T')[0]}
                          </div>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-bold text-ink">{name || 'Unknown'}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                          style={{ background: '#FEF3C7', color: '#D97706' }}>
                          <Clock size={10} /> Pending Review
                        </span>
                        {t.ijazah_verified && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: '#E8F5EE', color: '#1B5E37' }}>
                            ✓ Ijazah
                          </span>
                        )}
                        {t.intro_video_url && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: '#EEF2FF', color: '#4F46E5' }}>
                            🎥 Video Attached
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-light">{t.profiles?.email} · {t.profiles?.country}</p>
                      <p className="text-xs mt-1 text-ink-light">
                        {t.years_experience} yrs exp · ${t.hourly_rate_usd}/hr ·&nbsp;
                        {(t.specializations || []).join(', ')}
                      </p>
                    </div>

                    <div className="flex gap-2 flex-shrink-0 flex-wrap">
                      <button onClick={() => setExpanded(isExpanded ? null : t.id)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold border transition-all hover:bg-gray-50 flex items-center gap-1.5"
                        style={{ borderColor: '#E0DDD5', color: '#6B6B6B' }}>
                        <Eye size={13} /> {isExpanded ? 'Hide' : 'View Details'}
                      </button>
                      <button onClick={() => handleAction(t, 'approved')}
                        disabled={actionLoading === t.id}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                        style={{ background: 'linear-gradient(135deg,#1B5E37,#097434)' }}>
                        <CheckCircle size={13} />
                        {actionLoading === t.id ? '...' : 'Approve'}
                      </button>
                      <button onClick={() => setShowReject(isRejecting ? null : t.id)}
                        disabled={actionLoading === t.id}
                        className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                        style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}>
                        <XCircle size={13} />
                        Reject
                      </button>
                    </div>
                  </div>

                  {/* Rejection reason input */}
                  {isRejecting && (
                    <div className="px-5 pb-4 border-t border-gray-50">
                      <p className="text-xs font-semibold mb-2 mt-3" style={{ color: '#DC2626' }}>Rejection Reason (required — sent to teacher)</p>
                      <textarea
                        value={rejectReason[t.id] || ''}
                        onChange={e => setRejectReason(prev => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder="e.g. Please upload a clearer profile photo and provide more detail about your teaching experience..."
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
                        style={{ borderColor: '#FECACA', fontFamily: 'inherit' }}
                      />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => handleAction(t, 'rejected')}
                          disabled={actionLoading === t.id || !rejectReason[t.id]?.trim()}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                          style={{ background: '#DC2626' }}>
                          {actionLoading === t.id ? 'Rejecting...' : 'Confirm Reject'}
                        </button>
                        <button onClick={() => setShowReject(null)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold border hover:bg-gray-50 transition-all"
                          style={{ borderColor: '#E0DDD5', color: '#6B6B6B' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-5 space-y-4" style={{ background: '#FAFAFA' }}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Bio */}
                        <div className="sm:col-span-2">
                          <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#9A9A8A' }}>Bio</p>
                          <p className="text-sm" style={{ color: '#3D3D3D', lineHeight: 1.6 }}>
                            {t.profiles?.bio || '—'}
                          </p>
                        </div>
                        {[
                          { label: 'Phone', value: t.profiles?.phone || '—' },
                          { label: 'Experience', value: `${t.years_experience} years` },
                          { label: 'Ijazah', value: t.ijazah_verified ? 'Yes ✓' : 'No' },
                          { label: 'Hourly Rate', value: `$${t.hourly_rate_usd}/hr` },
                          { label: 'Trial Rate', value: t.trial_rate_usd ? `$${t.trial_rate_usd}` : 'Free' },
                          { label: 'Languages', value: (t.teaching_languages || []).join(', ') || '—' },
                          { label: 'Specializations', value: (t.specializations || []).join(', ') || '—' },
                          { label: 'Available Days', value: (t.available_days || []).join(', ') || '—' },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: '#9A9A8A' }}>{label}</p>
                            <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Intro video */}
                      {t.intro_video_url && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#9A9A8A' }}>
                            Introduction Video
                          </p>
                          {playingVideo === t.id ? (
                            <div className="rounded-xl overflow-hidden" style={{ maxWidth: 480 }}>
                              <video controls autoPlay className="w-full rounded-xl"
                                style={{ maxHeight: 280, background: '#000' }}>
                                <source src={t.intro_video_url} />
                                Your browser does not support video playback.
                              </video>
                              <button onClick={() => setPlayingVideo(null)}
                                className="mt-2 text-xs font-semibold" style={{ color: '#6B6B6B' }}>
                                ✕ Close video
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setPlayingVideo(t.id)}
                              className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:border-indigo-300 hover:bg-indigo-50"
                              style={{ borderColor: '#E0DDD5' }}>
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}>
                                <Play size={16} color="#fff" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Watch Introduction Video</p>
                                <p className="text-xs" style={{ color: '#6B6B6B' }}>Click to play teacher's intro video</p>
                              </div>
                            </button>
                          )}
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
