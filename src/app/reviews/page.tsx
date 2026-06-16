'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { Star, CheckCircle, XCircle } from 'lucide-react'
import { format } from 'date-fns'

type Review = {
  id: string
  rating: number
  title: string
  body: string
  is_published: boolean
  created_at: string
  student: { first_name: string; last_name: string }
  teacher: { first_name: string; last_name: string }
}

export default function ReviewsModerationPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => { fetchReviews() }, [])

  async function fetchReviews() {
    const supabase = createClient()
    const { data } = await supabase
      .from('reviews')
      .select(`
        *,
        student:profiles!reviews_student_id_fkey(first_name, last_name),
        teacher:profiles!reviews_teacher_id_fkey(first_name, last_name)
      `)
      .eq('is_published', false)
      .order('created_at', { ascending: false }) as any
    setReviews(data || [])
    setLoading(false)
  }

  async function handleReview(id: string, approve: boolean) {
    const supabase = createClient()
    setActionLoading(id)
    await (supabase.from('reviews') as any).update({ is_published: approve }).eq('id', id)
    setToast(approve ? '✅ Review published!' : '🗑️ Review rejected.')
    setTimeout(() => setToast(''), 3000)
    await fetchReviews()
    setActionLoading(null)
  }

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Reviews Moderation</h1>
          <p className="text-sm text-ink-light mt-1">{reviews.length} reviews awaiting moderation</p>
        </div>

        {toast && (
          <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-semibold"
            style={{ background: '#1B5E37' }}>{toast}</div>
        )}

        {loading ? (
          <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-36 animate-pulse" />)}</div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center shadow-sm border border-gray-100">
            <div className="text-5xl mb-4">⭐</div>
            <p className="text-lg font-bold text-ink">All reviews moderated!</p>
            <p className="text-sm text-ink-light mt-1">No pending reviews to review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map(r => (
              <div key={r.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {/* Stars */}
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={14}
                            fill={s <= r.rating ? '#B8952A' : 'none'}
                            stroke={s <= r.rating ? '#B8952A' : '#D1D5DB'}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-bold" style={{ color: '#B8952A' }}>{r.rating}/5</span>
                    </div>

                    {r.title && <p className="font-bold text-ink mb-1">{r.title}</p>}
                    {r.body && <p className="text-sm text-ink-mid leading-relaxed mb-3">{r.body}</p>}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-light">
                      <span>👤 From: <strong>{r.student?.first_name} {r.student?.last_name}</strong></span>
                      <span>🎓 For: <strong>{r.teacher?.first_name} {r.teacher?.last_name}</strong></span>
                      <span>📅 {r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy') : '—'}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleReview(r.id, true)}
                      disabled={actionLoading === r.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: '#1B5E37' }}>
                      <CheckCircle size={15} /> Approve
                    </button>
                    <button
                      onClick={() => handleReview(r.id, false)}
                      disabled={actionLoading === r.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: '#DC2626' }}>
                      <XCircle size={15} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
