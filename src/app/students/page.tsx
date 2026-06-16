'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { Search, BookOpen, Globe } from 'lucide-react'

type Student = {
  id: string
  first_name: string
  last_name: string
  email: string
  country: string
  phone: string
  is_active: boolean
  created_at: string
}

export default function StudentManagementPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [filtered, setFiltered] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => { fetchStudents() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(students.filter(s =>
      `${s.first_name} ${s.last_name} ${s.email}`.toLowerCase().includes(q)
    ))
  }, [search, students])

  async function fetchStudents() {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('created_at', { ascending: false }) as any
    setStudents(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  async function toggleActive(student: Student) {
    const supabase = createClient()
    setActionLoading(student.id)
    await (supabase.from('profiles') as any)
      .update({ is_active: !student.is_active })
      .eq('id', student.id)
    const msg = student.is_active ? '🚫 Student deactivated.' : '✅ Student reactivated.'
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
    await fetchStudents()
    setActionLoading(null)
  }

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-ink">Student Management</h1>
            <p className="text-sm text-ink-light mt-1">{students.length} registered students</p>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search students..."
              className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-DEFAULT w-64"
            />
          </div>
        </div>

        {toast && (
          <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-semibold"
            style={{ background: '#1B5E37' }}>{toast}</div>
        )}

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />)}</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(s => (
              <div key={s.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ background: s.is_active ? 'linear-gradient(135deg, #B8952A, #D4AF50)' : '#9CA3AF' }}>
                  {(s.first_name || 'S')[0]}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink">{s.first_name} {s.last_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      s.is_active ? 'bg-green-light text-green-DEFAULT' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-light mt-0.5">{s.email}</p>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-ink-light">
                    {s.country && <span className="flex items-center gap-1"><Globe size={11} /> {s.country}</span>}
                    {s.phone && <span>📞 {s.phone}</span>}
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(s)}
                  disabled={actionLoading === s.id}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all hover:opacity-80 disabled:opacity-50 flex-shrink-0"
                  style={s.is_active
                    ? { background: '#FEE2E2', color: '#DC2626', borderColor: '#FECACA' }
                    : { background: '#E8F5EE', color: '#1B5E37', borderColor: '#C6E6D1' }}>
                  {actionLoading === s.id ? '...' : s.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center">
                <p className="text-ink-light">No students found.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
