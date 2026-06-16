'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { CheckCircle, XCircle } from 'lucide-react'

type Review = {
  id: string; rating: number; comment: string; is_public: boolean; created_at: string
  student: { first_name: string; last_name: string }
  teacher: { first_name: string; last_name: string }
}

function Stars({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s} style={{ fontSize: 14, color: s <= rating ? '#B8952A' : '#E5E7EB' }}>★</span>
      ))}
    </div>
  )
}

export default function ReviewsModerationPage() {
  const [reviews, setReviews]           = useState<Review[]>([])
  const [loading, setLoading]           = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast]               = useState('')
  const [filter, setFilter]             = useState<'pending' | 'approved' | 'all'>('pending')

  useEffect(() => { fetchReviews() }, [filter])

  async function fetchReviews() {
    setLoading(true)
    const supabase = createClient()
    let q = supabase.from('reviews').select(`
      id, rating, comment, is_public, created_at,
      student:profiles!reviews_student_id_fkey(first_name,last_name),
      teacher:profiles!reviews_teacher_id_fkey(first_name,last_name)
    `).order('created_at', { ascending: false }) as any
    if (filter === 'pending')  q = q.eq('is_public', false)
    if (filter === 'approved') q = q.eq('is_public', true)
    const { data } = await q
    setReviews(data || [])
    setLoading(false)
  }

  async function handleReview(id: string, approve: boolean) {
    const supabase = createClient()
    setActionLoading(id)
    await (supabase.from('reviews') as any).update({ is_public: approve }).eq('id', id)
    showToast(approve ? '✅ Review approved & published!' : '🗑️ Review rejected.')
    await fetchReviews()
    setActionLoading(null)
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  return (
    <AdminLayout>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, padding: '12px 20px', borderRadius: 12, background: '#1B5E37', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>{toast}</div>}

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 800, color: '#097434', margin: 0 }}>Reviews Moderation</h1>
          <p style={{ fontSize: 13, color: '#6B7A6B', marginTop: 4 }}>Review and publish student feedback</p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['pending','approved','all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', textTransform: 'capitalize', fontFamily: "'DM Sans',sans-serif",
                background: filter === f ? '#1B5E37' : '#fff',
                color: filter === f ? '#fff' : '#6B6B6B',
                boxShadow: filter === f ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
              }}>{f === 'pending' ? 'Awaiting Review' : f === 'approved' ? 'Published' : 'All Reviews'}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3].map(i => <div key={i} style={{ background: '#fff', borderRadius: 16, height: 120, border: '1px solid #E8E4DA', animation: 'pulse 1.5s infinite' }} />)}
          </div>
        ) : reviews.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 20, padding: '60px 24px', textAlign: 'center', border: '1px solid #E8E4DA' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: '#097434', margin: 0 }}>
              {filter === 'pending' ? 'All caught up!' : filter === 'approved' ? 'No published reviews yet' : 'No reviews yet'}
            </p>
            <p style={{ fontSize: 13, color: '#9A9A8A', marginTop: 6 }}>
              {filter === 'pending' ? 'No reviews waiting for moderation.' : 'Reviews will appear here once students leave feedback.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reviews.map(r => (
              <div key={r.id} style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #E8E4DA', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <Stars rating={r.rating} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#B8952A' }}>{r.rating}/5</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: r.is_public ? '#E8F5EE' : '#FEF3C7', color: r.is_public ? '#1B5E37' : '#B8952A' }}>
                        {r.is_public ? 'Published' : 'Pending'}
                      </span>
                    </div>
                    {r.comment && <p style={{ fontSize: 14, color: '#3D3D3D', margin: '0 0 10px', lineHeight: 1.6 }}>"{r.comment}"</p>}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#9A9A8A' }}>
                      <span>👤 From: <strong style={{ color: '#1B5E37' }}>{r.student?.first_name} {r.student?.last_name}</strong></span>
                      <span>🎓 For: <strong style={{ color: '#1B5E37' }}>{r.teacher?.first_name} {r.teacher?.last_name}</strong></span>
                      <span>📅 {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  {!r.is_public && (
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => handleReview(r.id, true)} disabled={actionLoading === r.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#1B5E37', color: '#fff', fontSize: 12, fontWeight: 700, opacity: actionLoading === r.id ? 0.6 : 1 }}>
                        <CheckCircle size={14} /> Approve
                      </button>
                      <button onClick={() => handleReview(r.id, false)} disabled={actionLoading === r.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#FEE2E2', color: '#DC2626', fontSize: 12, fontWeight: 700, opacity: actionLoading === r.id ? 0.6 : 1 }}>
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }`}</style>
    </AdminLayout>
  )
}
