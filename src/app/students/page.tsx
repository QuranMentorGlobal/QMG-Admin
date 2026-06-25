'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { Search, BookOpen, Globe } from 'lucide-react'
import RangeTabs, { withinRange } from '@/components/RangeTabs'

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
  const [range, setRange] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => { fetchStudents() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    const ranged = withinRange(students, range, (s: any) => s.created_at, from, to)
    setFiltered(ranged.filter(s =>
      `${s.first_name} ${s.last_name} ${s.email}`.toLowerCase().includes(q)
    ))
  }, [search, students, range, from, to])

  async function fetchStudents() {
    let data: any[] = []
    try { const res = await fetch('/api/students'); data = res.ok ? await res.json() : [] } catch {}
    if (!Array.isArray(data)) data = []
    setStudents(data)
    setFiltered(data)
    setLoading(false)
  }

  async function toggleActive(student: Student) {
    setActionLoading(student.id)
    const res = await fetch('/api/student-status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: student.id, isActive: !student.is_active }),
    })
    const msg = res.ok ? (student.is_active ? '🚫 Student deactivated.' : '✅ Student reactivated.') : '❌ Action not permitted'
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
            <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: "'Fraunces',serif" }}>Student Management</h1>
            <p className="text-sm text-ink-light mt-1">{students.length} registered students</p>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search students..."
              className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#C9A227] w-64"
            />
          </div>
        </div>

        <div className="mb-4"><RangeTabs value={range} onChange={setRange} from={from} to={to} onFromChange={setFrom} onToChange={setTo} /></div>

        {toast && (
          <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg,#166534,#C9A227)' }}>{toast}</div>
        )}

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />)}</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(s => (
              <div key={s.id}
                className="adminx-row bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ background: s.is_active ? 'linear-gradient(135deg, #166534, #C9A227)' : '#9CA3AF' }}>
                  {(s.first_name || 'S')[0]}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink">{s.first_name} {s.last_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
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
                <div className="flex gap-2 flex-shrink-0">
                  <a
                    href={`/students/${s.id}`}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all hover:opacity-80 text-center"
                    style={{ background: '#fff', color: '#111111', borderColor: '#E8E4DA' }}>
                    View
                  </a>
                  <button
                    onClick={() => toggleActive(s)}
                    disabled={actionLoading === s.id}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all hover:opacity-80 disabled:opacity-50"
                    style={s.is_active
                      ? { background: '#FEE2E2', color: '#DC2626', borderColor: '#FECACA' }
                      : { background: '#F8F5EE', color: '#C9A227', borderColor: '#C6E6D1' }}>
                    {actionLoading === s.id ? '...' : s.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
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
