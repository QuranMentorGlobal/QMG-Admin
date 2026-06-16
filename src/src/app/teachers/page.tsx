'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { Search, Star, BookOpen, DollarSign, ShieldOff, ShieldCheck } from 'lucide-react'

type Teacher = {
  id: string; user_id: string; status: string; avg_rating: number
  total_lessons: number; hourly_rate_usd: number; specializations: string[]
  profiles: { first_name: string; last_name: string; email: string; country: string; is_active: boolean }
}

export default function TeacherManagementPage() {
  const [teachers, setTeachers]         = useState<Teacher[]>([])
  const [filtered, setFiltered]         = useState<Teacher[]>([])
  const [search, setSearch]             = useState('')
  const [loading, setLoading]           = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast]               = useState('')

  useEffect(() => { fetchTeachers() }, [])
  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(teachers.filter(t =>
      `${t.profiles?.first_name} ${t.profiles?.last_name} ${t.profiles?.email}`.toLowerCase().includes(q)
    ))
  }, [search, teachers])

  async function fetchTeachers() {
    const supabase = createClient()
    const { data } = await supabase.from('teacher_profiles')
      .select('*, profiles(first_name,last_name,email,country,is_active)')
      .eq('status', 'approved').order('id', { ascending: false }) as any
    setTeachers(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  async function toggleSuspend(t: Teacher) {
    const supabase = createClient()
    setActionLoading(t.id)
    const newStatus = t.status === 'suspended' ? 'approved' : 'suspended'
    await (supabase.from('teacher_profiles') as any).update({ status: newStatus }).eq('id', t.id)
    await (supabase.from('profiles') as any).update({ is_active: newStatus === 'approved' }).eq('id', t.user_id)
    showToast(newStatus === 'approved' ? '✅ Teacher reinstated.' : '🚫 Teacher suspended.')
    await fetchTeachers()
    setActionLoading(null)
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  return (
    <AdminLayout>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {toast && (
          <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, padding: '12px 20px', borderRadius: 12, background: '#1B5E37', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            {toast}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 800, color: '#097434', margin: 0 }}>Teacher Management</h1>
            <p style={{ fontSize: 13, color: '#6B7A6B', marginTop: 4 }}>{teachers.length} approved teachers on platform</p>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9A9A8A' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teachers…"
              style={{ paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 12, border: '1.5px solid #E8E4DA', fontSize: 13, outline: 'none', width: 240, background: '#fff', fontFamily: "'DM Sans',sans-serif" }} />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3].map(i => <div key={i} style={{ background: '#fff', borderRadius: 16, height: 80, border: '1px solid #E8E4DA', animation: 'pulse 1.5s infinite' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 20, padding: '60px 24px', textAlign: 'center', border: '1px solid #E8E4DA' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎓</div>
            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: '#097434', margin: 0 }}>
              {search ? 'No teachers match your search' : 'No approved teachers yet'}
            </p>
            <p style={{ fontSize: 13, color: '#9A9A8A', marginTop: 6 }}>
              {search ? 'Try a different name or email.' : 'Approve teacher applications to see them here.'}
            </p>
            {search && <button onClick={() => setSearch('')} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 10, background: '#1B5E37', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Clear search</button>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(t => (
              <div key={t.id} style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', border: '1px solid #E8E4DA', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: t.status === 'suspended' ? '#9CA3AF' : 'linear-gradient(135deg,rgb(0,87,34),rgb(15,137,61))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0, fontFamily: "'DM Sans',sans-serif" }}>
                  {(t.profiles?.first_name || 'T')[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ fontWeight: 700, color: '#1A1A1A', margin: 0, fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{t.profiles?.first_name} {t.profiles?.last_name}</p>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: t.status === 'suspended' ? '#FEE2E2' : '#E8F5EE', color: t.status === 'suspended' ? '#DC2626' : '#1B5E37' }}>
                      {t.status === 'suspended' ? 'Suspended' : 'Active'}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: '#9A9A8A', margin: '3px 0 0' }}>{t.profiles?.email} · {t.profiles?.country}</p>
                  <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#6B7A6B', display: 'flex', alignItems: 'center', gap: 4 }}><Star size={11} color="#B8952A" /> {t.avg_rating?.toFixed(1) || 'N/A'}</span>
                    <span style={{ fontSize: 12, color: '#6B7A6B', display: 'flex', alignItems: 'center', gap: 4 }}><BookOpen size={11} /> {t.total_lessons || 0} lessons</span>
                    <span style={{ fontSize: 12, color: '#6B7A6B', display: 'flex', alignItems: 'center', gap: 4 }}><DollarSign size={11} /> ${t.hourly_rate_usd}/hr</span>
                  </div>
                </div>
                <button onClick={() => toggleSuspend(t)} disabled={actionLoading === t.id}
                  style={{
                    padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', flexShrink: 0,
                    background: t.status === 'suspended' ? '#E8F5EE' : '#FEE2E2',
                    color: t.status === 'suspended' ? '#1B5E37' : '#DC2626',
                    opacity: actionLoading === t.id ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                  {t.status === 'suspended' ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
                  {actionLoading === t.id ? '…' : t.status === 'suspended' ? 'Reinstate' : 'Suspend'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }`}</style>
    </AdminLayout>
  )
}
