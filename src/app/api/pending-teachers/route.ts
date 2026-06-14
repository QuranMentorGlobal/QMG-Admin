'use client'
import { useEffect, useState } from 'react'
// Admin data fetched via API routes that use service role key
import AdminLayout from '@/components/AdminLayout'
import { CheckCircle, XCircle, Clock, Globe, DollarSign } from 'lucide-react'

type Application = {
  id: string
  user_id: string
  years_experience: number
  specializations: string[]
  teaching_languages: string[]
  hourly_rate_usd: number
  trial_rate_usd: number
  available_days: string[]
  ijazah_verified: boolean
  status: string
  profiles: {
    first_name: string
    last_name: string
    email: string
    country: string
    bio: string
    phone: string
  }
}

export default function TeacherApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selected, setSelected] = useState<Application | null>(null)
  const [showRejectModal, setShowRejectModal] = useState<Application | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => { fetchApplications() }, [])

  async function fetchApplications() {
    const res = await fetch('/api/pending-teachers')
    if (res.ok) {
      const data = await res.json()
      setApplications(data || [])
    }
    setLoading(false)
  }

  async function handleAction(id: string, userId: string, action: 'approved' | 'rejected', reason?: string) {
  setActionLoading(id)

  // Use API route to bypass RLS
  await fetch('/api/review-teacher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, userId, action, reason }),
  })

  // Get teacher details for email
  const { data: prof } = await supabase
    .from('profiles')
    .select('first_name, last_name, email')
    .eq('id', userId)
    .single() as any

  if (prof) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_FRONTEND_URL}/api/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: action,
          teacherName: `${prof.first_name} ${prof.last_name}`,
          teacherEmail: prof.email,
          reason: reason || '',
        }),
      })
    } catch (e) {
      console.error('Email notification failed:', e)
    }
  }

  showToast(action === 'approved' ? '✅ Teacher approved & notified!' : '❌ Application rejected & teacher notified.')
  setSelected(null)
  setShowRejectModal(null)
  setRejectionReason('')
  await fetchApplications()
  setActionLoading(null)
}
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function openRejectModal(app: Application) {
    setRejectionReason('')
    setShowRejectModal(app)
    setSelected(null)
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Teacher Applications</h1>
          <p className="text-sm text-ink-light mt-1">Review and approve incoming teacher applications</p>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-semibold"
            style={{ background: '#1B5E37' }}>
            {toast}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse" />)}
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center shadow-sm border border-gray-100">
            <div className="text-5xl mb-4">🎉</div>
            <p className="text-lg font-bold text-ink">All caught up!</p>
            <p className="text-sm text-ink-light mt-1">No pending teacher applications.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map(app => (
              <div key={app.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center gap-4 transition-all hover:shadow-md">

                {/* Avatar */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #1B5E37, #0D3D20)' }}>
                  {(app.profiles?.first_name || 'T')[0]}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink">
                      {app.profiles?.first_name} {app.profiles?.last_name}
                    </p>
                    {app.ijazah_verified && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: '#F0E4B8', color: '#B8952A' }}>
                        ✓ Ijazah
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-light mt-0.5">{app.profiles?.email} · {app.profiles?.country}</p>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-ink-light">
                    <span className="flex items-center gap-1"><Clock size={12} /> {app.years_experience} yrs exp</span>
                    <span className="flex items-center gap-1"><DollarSign size={12} /> ${app.hourly_rate_usd}/hr</span>
                    <span className="flex items-center gap-1"><Globe size={12} /> {(app.teaching_languages || []).join(', ')}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setSelected(app)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-ink-mid hover:bg-gray-50 transition-all">
                    View Details
                  </button>
                  <button
                    onClick={() => handleAction(app.id, app.user_id, 'approved')}
                    disabled={actionLoading === app.id}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                    style={{ background: '#1B5E37' }}>
                    <CheckCircle size={15} className="inline mr-1" />Approve
                  </button>
                  <button
                    onClick={() => openRejectModal(app)}
                    disabled={actionLoading === app.id}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                    style={{ background: '#DC2626' }}>
                    <XCircle size={15} className="inline mr-1" />Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detail Modal */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-ink">Application Details</h2>
                  <button onClick={() => setSelected(null)}
                    className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-ink-light hover:bg-gray-200 text-lg">
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                      style={{ background: 'linear-gradient(135deg, #1B5E37, #0D3D20)' }}>
                      {(selected.profiles?.first_name || 'T')[0]}
                    </div>
                    <div>
                      <p className="font-bold text-ink">{selected.profiles?.first_name} {selected.profiles?.last_name}</p>
                      <p className="text-sm text-ink-light">{selected.profiles?.email}</p>
                      <p className="text-sm text-ink-light">{selected.profiles?.country} · {selected.profiles?.phone}</p>
                    </div>
                  </div>

                  {selected.profiles?.bio && (
                    <div>
                      <p className="text-xs font-bold text-ink-light uppercase tracking-wide mb-1">Bio</p>
                      <p className="text-sm text-ink-mid leading-relaxed">{selected.profiles.bio}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Experience', value: `${selected.years_experience} years` },
                      { label: 'Hourly Rate', value: `$${selected.hourly_rate_usd}` },
                      { label: 'Trial Rate', value: `$${selected.trial_rate_usd}` },
                      { label: 'Ijazah', value: selected.ijazah_verified ? 'Verified ✓' : 'Not verified' },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-ink-light font-medium">{label}</p>
                        <p className="text-sm font-bold text-ink mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="text-xs font-bold text-ink-light uppercase tracking-wide mb-2">Specializations</p>
                    <div className="flex flex-wrap gap-2">
                      {(selected.specializations || []).map(s => (
                        <span key={s} className="text-xs px-3 py-1 rounded-full font-medium"
                          style={{ background: '#E8F5EE', color: '#1B5E37' }}>{s}</span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-ink-light uppercase tracking-wide mb-2">Teaching Languages</p>
                    <div className="flex flex-wrap gap-2">
                      {(selected.teaching_languages || []).map(l => (
                        <span key={l} className="text-xs px-3 py-1 rounded-full font-medium"
                          style={{ background: '#F0E4B8', color: '#B8952A' }}>{l}</span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-ink-light uppercase tracking-wide mb-2">Available Days</p>
                    <div className="flex flex-wrap gap-2">
                      {(selected.available_days || []).map(d => (
                        <span key={d} className="text-xs px-3 py-1 rounded-full bg-gray-100 text-ink-mid font-medium">{d}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => handleAction(selected.id, selected.user_id, 'approved')}
                    disabled={!!actionLoading}
                    className="flex-1 py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90"
                    style={{ background: '#1B5E37' }}>
                    ✅ Approve
                  </button>
                  <button
                    onClick={() => openRejectModal(selected)}
                    disabled={!!actionLoading}
                    className="flex-1 py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90"
                    style={{ background: '#DC2626' }}>
                    ❌ Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reject Reason Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-ink">Reject Application</h2>
                <button
                  onClick={() => { setShowRejectModal(null); setRejectionReason('') }}
                  className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-ink-light hover:bg-gray-200 text-lg">
                  ×
                </button>
              </div>

              <p className="text-sm text-ink-light mb-1">
                Rejecting: <strong className="text-ink">{showRejectModal.profiles?.first_name} {showRejectModal.profiles?.last_name}</strong>
              </p>
              <p className="text-sm text-ink-light mb-4">
                Please give a reason so the teacher knows what to fix and can resubmit.
              </p>

              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                rows={4}
                placeholder="e.g. Your profile photo is unclear. Please upload a professional photo showing your face clearly. Also please add more detail to your bio."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none resize-none mb-2 leading-relaxed"
              />
              <p className="text-xs text-right mb-4" style={{ color: '#9CA3AF' }}>
                {rejectionReason.length} characters
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowRejectModal(null); setRejectionReason('') }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-ink-mid hover:bg-gray-50 transition-all">
                  Cancel
                </button>
                <button
                  onClick={() => handleAction(showRejectModal.id, showRejectModal.user_id, 'rejected', rejectionReason)}
                  disabled={!rejectionReason.trim() || !!actionLoading}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#DC2626' }}>
                  {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  )
}
