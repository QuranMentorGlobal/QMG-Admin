'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { Search, Star, DollarSign, BookOpen } from 'lucide-react'

type Teacher = {
  id: string
  user_id: string
  status: string
  avg_rating: number
  total_lessons: number
  hourly_rate_usd: number
  specializations: string[]
  profiles: {
    first_name: string
    last_name: string
    email: string
    country: string
    is_active: boolean
  }
}

export default function TeacherManagementPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [filtered, setFiltered] = useState<Teacher[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => { fetchTeachers() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(teachers.filter(t =>
      `${t.profiles?.first_name} ${t.profiles?.last_name} ${t.profiles?.email}`.toLowerCase().includes(q)
    ))
  }, [search, teachers])

  async function fetchTeachers() {
    const supabase = createClient()
    const { data } = await supabase
      .from('teacher_profiles')
      .select('*, profiles(first_name, last_name, email, country, is_active)')
      .eq('status', 'approved')
      .order('id', { ascending: false }) as any
    setTeachers(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  async function toggleSuspend(teacher: Teacher) {
    const supabase = createClient()
    setActionLoading(teacher.id)
    const newStatus = teacher.status === 'suspended' ? 'approved' : 'suspended'
    const isActive = newStatus === 'approved'
    await (supabase.from('teacher_profiles') as any).update({ status: newStatus }).eq('id', teacher.id)
    await (supabase.from('profiles') as any).update({ is_active: isActive }).eq('id', teacher.user_id)
    showToast(isActive ? '✅ Teacher reinstated.' : '🚫 Teacher suspended.')
    await fetchTeachers()
    setActionLoading(null)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-ink">Teacher Management</h1>
            <p className="text-sm text-ink-light mt-1">{teachers.length} approved teachers on platform</p>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search teachers..."
              className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-DEFAULT w-64"
            />
          </div>
        </div>

        {toast && (
          <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-semibold"
            style={{ background: '#B8952A' }}>{toast}</div>
        )}

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse" />)}</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => (
              <div key={t.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ background: t.status === 'suspended' ? '#9CA3AF' : 'linear-gradient(135deg, #B8952A, #0B0B0B)' }}>
                  {(t.profiles?.first_name || 'T')[0]}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink">{t.profiles?.first_name} {t.profiles?.last_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      t.status === 'suspended' ? 'bg-red-100 text-red-600' : 'bg-green-light text-green-DEFAULT'
                    }`}>
                      {t.status === 'suspended' ? 'Suspended' : 'Active'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-light mt-0.5">{t.profiles?.email} · {t.profiles?.country}</p>
                  <div className="flex flex-wrap gap-4 mt-1.5 text-xs text-ink-light">
                    <span className="flex items-center gap-1"><Star size={11} /> {t.avg_rating?.toFixed(1) || 'N/A'}</span>
                    <span className="flex items-center gap-1"><BookOpen size={11} /> {t.total_lessons || 0} lessons</span>
                    <span className="flex items-center gap-1"><DollarSign size={11} /> ${t.hourly_rate_usd}/hr</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleSuspend(t)}
                  disabled={actionLoading === t.id}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all hover:opacity-80 disabled:opacity-50 flex-shrink-0"
                  style={t.status === 'suspended'
                    ? { background: '#B8952A', color: '#fff', borderColor: '#B8952A' }
                    : { background: '#FEE2E2', color: '#DC2626', borderColor: '#FECACA' }}>
                  {actionLoading === t.id ? '...' : t.status === 'suspended' ? 'Reinstate' : 'Suspend'}
                </button>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center">
                <p className="text-ink-light">No teachers found.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
