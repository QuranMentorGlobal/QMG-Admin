'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { Search, Globe } from 'lucide-react'

type Student = { id: string; first_name: string; last_name: string; email: string; country: string; phone: string; is_active: boolean; created_at: string }

export default function StudentManagementPage() {
  const [students, setStudents]         = useState<Student[]>([])
  const [filtered, setFiltered]         = useState<Student[]>([])
  const [search, setSearch]             = useState('')
  const [loading, setLoading]           = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast]               = useState('')

  useEffect(() => { fetchStudents() }, [])
  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(students.filter(s => `${s.first_name} ${s.last_name} ${s.email}`.toLowerCase().includes(q)))
  }, [search, students])

  async function fetchStudents() {
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('*').eq('role', 'student').order('created_at', { ascending: false }) as any
    setStudents(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  async function toggleActive(s: Student) {
    const supabase = createClient()
    setActionLoading(s.id)
    await (supabase.from('profiles') as any).update({ is_active: !s.is_active }).eq('id', s.id)
    setToast(s.is_active ? '🚫 Student deactivated.' : '✅ Student reactivated.')
    setTimeout(() => setToast(''), 3000)
    await fetchStudents()
    setActionLoading(null)
  }

  return (
    <AdminLayout>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, padding: '12px 20px', borderRadius: 12, background: '#1B5E37', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>{toast}</div>}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 800, color: '#097434', margin: 0 }}>Student Management</h1>
            <p style={{ fontSize: 13, color: '#6B7A6B', marginTop: 4 }}>{students.length} registered students</p>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9A9A8A' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…"
              style={{ paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 12, border: '1.5px solid #E8E4DA', fontSize: 13, outline: 'none', width: 240, background: '#fff', fontFamily: "'DM Sans',sans-serif" }} />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3,4].map(i => <div key={i} style={{ background: '#fff', borderRadius: 16, height: 72, border: '1px solid #E8E4DA', animation: 'pulse 1.5s infinite' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 20, padding: '60px 24px', textAlign: 'center', border: '1px solid #E8E4DA' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👩‍🎓</div>
            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: '#097434', margin: 0 }}>
              {search ? 'No students match your search' : 'No students yet'}
            </p>
            <p style={{ fontSize: 13, color: '#9A9A8A', marginTop: 6 }}>
              {search ? 'Try a different name or email.' : 'Students will appear here once they register.'}
            </p>
            {search && <button onClick={() => setSearch('')} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 10, background: '#1B5E37', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Clear search</button>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(s => (
              <div key={s.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 20px', border: '1px solid #E8E4DA', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: s.is_active ? 'linear-gradient(135deg,#B8952A,#D4AF50)' : '#D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                  {(s.first_name || 'S')[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ fontWeight: 700, color: '#1A1A1A', margin: 0, fontSize: 14 }}>{s.first_name} {s.last_name}</p>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: s.is_active ? '#E8F5EE' : '#F3F4F6', color: s.is_active ? '#1B5E37' : '#9CA3AF' }}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: '#9A9A8A', margin: '3px 0 0' }}>{s.email}</p>
                  <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
                    {s.country && <span style={{ fontSize: 12, color: '#6B7A6B', display: 'flex', alignItems: 'center', gap: 3 }}><Globe size={11} /> {s.country}</span>}
                    {s.created_at && <span style={{ fontSize: 12, color: '#9A9A8A' }}>Joined {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  </div>
                </div>
                <button onClick={() => toggleActive(s)} disabled={actionLoading === s.id}
                  style={{ padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', flexShrink: 0, background: s.is_active ? '#FEE2E2' : '#E8F5EE', color: s.is_active ? '#DC2626' : '#1B5E37', opacity: actionLoading === s.id ? 0.6 : 1 }}>
                  {actionLoading === s.id ? '…' : s.is_active ? 'Deactivate' : 'Reactivate'}
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
