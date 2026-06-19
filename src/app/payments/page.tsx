'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'

interface Payment {
  id: string
  gross_amount_usd: number
  platform_fee_usd: number
  teacher_payout_usd: number
  status: string
  provider: string
  payment_type: string
  created_at: string
  student_name?: string
  teacher_name?: string
}

function fmt(n: number) { return `$${n.toFixed(2)}` }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    succeeded: { bg: 'rgba(184,149,42,0.1)',    color: '#B8952A' },
    pending:   { bg: 'rgba(184,149,42,0.12)', color: '#B8952A' },
    failed:    { bg: 'rgba(239,68,68,0.1)',   color: '#DC2626' },
    refunded:  { bg: 'rgba(99,102,241,0.1)',  color: '#6366F1' },
  }
  const s = map[status] ?? { bg: 'rgba(0,0,0,0.06)', color: '#666' }
  return <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase" style={{ background: s.bg, color: s.color }}>{status}</span>
}

export default function AdminPaymentsPage() {
  const supabase = createClient()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [search, setSearch]     = useState('')
  const [stats, setStats]       = useState({ totalRevenue: 0, totalCommission: 0, thisMonth: 0, totalPayments: 0, failedPayments: 0 })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await (supabase as any)
      .from('payments')
      .select(`id, gross_amount_usd, platform_fee_usd, teacher_payout_usd, status, provider, payment_type, created_at,
        student:profiles!payments_student_id_fkey(first_name, last_name),
        teacher:profiles!payments_teacher_id_fkey(first_name, last_name)`)
      .order('created_at', { ascending: false }).limit(300)

    const pmts: Payment[] = (data ?? []).map((p: any) => ({
      ...p,
      student_name: p.student ? `${p.student.first_name} ${p.student.last_name}` : 'Unknown',
      teacher_name: p.teacher ? `${p.teacher.first_name} ${p.teacher.last_name}` : 'Unknown',
    }))
    setPayments(pmts)

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)
    const ok = pmts.filter(p => p.status === 'succeeded')
    setStats({
      totalRevenue:    ok.reduce((s, p) => s + p.gross_amount_usd, 0),
      totalCommission: ok.reduce((s, p) => s + p.platform_fee_usd, 0),
      thisMonth:       ok.filter(p => new Date(p.created_at) >= monthStart).reduce((s, p) => s + p.gross_amount_usd, 0),
      totalPayments:   pmts.length,
      failedPayments:  pmts.filter(p => p.status === 'failed').length,
    })
    setLoading(false)
  }

  const filtered = payments.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false
    if (search) {
      const s = search.toLowerCase()
      return p.student_name?.toLowerCase().includes(s) || p.teacher_name?.toLowerCase().includes(s)
    }
    return true
  })

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#0B0B0B', fontFamily: "'Fraunces', serif" }}>Payments & Revenue</h1>
          <p className="text-sm mt-1 text-gray-500">Full payment history, revenue and commission tracking</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total Revenue',    value: fmt(stats.totalRevenue),    icon: '💰', bg: '#F7F1E2' },
            { label: 'Commission Earned',value: fmt(stats.totalCommission), icon: '📊', bg: '#FFF8E8' },
            { label: 'This Month',       value: fmt(stats.thisMonth),       icon: '📅', bg: '#EEF2FF' },
            { label: 'Total Payments',   value: stats.totalPayments,        icon: '🧾', bg: '#F5F0FF' },
            { label: 'Failed',           value: stats.failedPayments,       icon: '❌', bg: '#FFF0F0' },
          ].map(c => (
            <div key={c.label} className="rounded-2xl p-4 shadow-sm border border-gray-100" style={{ background: c.bg }}>
              {loading ? <div className="animate-pulse h-8 bg-gray-200 rounded" /> : (
                <>
                  <div className="text-xl mb-1">{c.icon}</div>
                  <div className="text-lg font-bold" style={{ color: '#0B0B0B' }}>{c.value}</div>
                  <div className="text-xs text-gray-500">{c.label}</div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search student or teacher…"
            className="flex-1 px-4 py-2 rounded-xl border text-sm outline-none"
            style={{ borderColor: '#E0DDD5', minWidth: 200 }} />
          <div className="flex gap-1 rounded-xl p-1 bg-gray-100">
            {['all', 'succeeded', 'pending', 'failed', 'refunded'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                style={filter === f ? { background: '#B8952A', color: '#fff' } : { color: '#666' }}>{f}</button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="font-bold text-sm" style={{ color: '#0B0B0B' }}>Payment History ({filtered.length})</p>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No payments found</div>
          ) : (
            <>
              <div className="grid grid-cols-6 px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400 bg-gray-50">
                <span className="col-span-2">Details</span><span>Student</span><span>Teacher</span><span>Amount</span><span>Status</span>
              </div>
              <div className="divide-y divide-gray-50">
                {filtered.map(p => (
                  <div key={p.id} className="grid grid-cols-6 items-center px-6 py-3 hover:bg-gray-50">
                    <div className="col-span-2">
                      <p className="text-xs font-semibold capitalize" style={{ color: '#0B0B0B' }}>{p.payment_type?.replace('_',' ')}</p>
                      <p className="text-[10px] text-gray-400">{fmtDate(p.created_at)} · {p.provider}</p>
                    </div>
                    <div className="text-xs text-gray-600 truncate">{p.student_name}</div>
                    <div className="text-xs text-gray-600 truncate">{p.teacher_name}</div>
                    <div>
                      <div className="text-sm font-bold" style={{ color: '#0B0B0B' }}>{fmt(p.gross_amount_usd)}</div>
                      <div className="text-[10px] text-gray-400">fee: {fmt(p.platform_fee_usd)}</div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
