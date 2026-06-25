// ============================================================
// FOR qmg-admin REPO → src/app/finance-reports/page.tsx
// Financial Reports — a lightweight finance-only summary so reviewers and
// processors get the numbers without the full analytics dashboard. (Phase F5)
// Charcoal-gold palette, same chrome as the rest of admin.
// ============================================================
'use client'

import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import RangeTabs from '@/components/RangeTabs'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

const GOLD = '#C9A227'
const INK  = '#111111'
const MUTED = '#6B7280'
const BORDER = 'rgba(201,162,39,0.14)'

const fmt = (n: number) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const STAGE = [
  { key: 'requested',    label: 'Requested',    color: '#C9A227' },
  { key: 'under_review', label: 'Under Review', color: '#B45309' },
  { key: 'approved',     label: 'Approved',     color: '#6366F1' },
  { key: 'processing',   label: 'Processing',   color: '#0284C7' },
  { key: 'completed',    label: 'Completed',    color: '#16A34A' },
  { key: 'rejected',     label: 'Rejected',     color: '#DC2626' },
  { key: 'failed',       label: 'Failed',       color: '#DC2626' },
]

export default function FinanceReportsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams({ range, from, to }).toString()
    fetch(`/api/finance/reports?${qs}`).then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range, from, to])

  const monthly = (data?.monthlyPaidOut || []).map((m: any) => ({
    label: new Date(m.month + '-01').toLocaleString('en-GB', { month: 'short' }),
    amount: m.amount,
  }))

  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, padding: 18, border: `1px solid ${BORDER}` }

  return (
    <AdminLayout>
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: GOLD, margin: 0 }}>Finance</p>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: INK, margin: '4px 0 0', fontFamily: "'Fraunces',serif" }}>Financial Reports</h1>
            <p style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Payout pipeline and payments for the selected period · liabilities are live.</p>
          </div>
          <div className="qmg-fr-controls" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <RangeTabs value={range} onChange={setRange} from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          </div>
        </div>
        <style>{`@media (max-width:640px){ .qmg-fr-controls{ width:100%; justify-content:center; } }`}</style>

        {/* Headline numbers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Paid Out', value: fmt(data?.totalPaidOut || 0), color: '#16A34A' },
            { label: 'Teacher Liabilities', value: fmt(data?.teacherLiability || 0), color: '#6366F1' },
            { label: 'In Pipeline (unpaid)', value: fmt(['requested', 'under_review', 'approved', 'processing'].reduce((s, k) => s + (data?.byStatus?.[k]?.amount || 0), 0)), color: GOLD },
          ].map(s => (
            <div key={s.label} style={card}>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: "'Fraunces',serif" }}>{loading ? '—' : s.value}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Pipeline by stage */}
        <div style={{ ...card, marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: INK, margin: '0 0 14px', fontFamily: "'Fraunces',serif" }}>Payout Pipeline by Stage</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            {STAGE.map(s => {
              const cell = data?.byStatus?.[s.key] || { count: 0, amount: 0 }
              return (
                <div key={s.key} style={{ borderRadius: 12, padding: 12, background: 'rgba(248,245,240,0.6)', border: '1px solid rgba(201,162,39,0.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: s.color }}>{s.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: INK, marginTop: 4 }}>{loading ? '—' : fmt(cell.amount)}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{cell.count} payout{cell.count === 1 ? '' : 's'}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Monthly paid-out trend */}
        <div style={{ ...card, marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: INK, margin: '0 0 14px', fontFamily: "'Fraunces',serif" }}>Paid Out — Last 6 Months</p>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: MUTED }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: MUTED }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                <Bar dataKey="amount" fill={GOLD} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent completed payouts */}
        <div style={{ ...card, padding: 0, overflow: 'auto' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(201,162,39,0.05)' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: INK, fontFamily: "'Fraunces',serif" }}>Recent Completed Payouts</span>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>Loading…</div>
          ) : (data?.recentCompleted || []).length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>No completed payouts yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  {['Teacher', 'Amount', 'Method', 'Reference', 'Paid'].map(h => (
                    <th key={h} style={{ padding: '10px 18px', fontSize: 11, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentCompleted.map((r: any) => (
                  <tr key={r.id} style={{ borderTop: '1px solid rgba(201,162,39,0.07)' }}>
                    <td style={{ padding: '10px 18px', fontSize: 14, fontWeight: 600, color: INK }}>{r.teacher_name}</td>
                    <td style={{ padding: '10px 18px', fontSize: 14, fontWeight: 700, color: '#16A34A' }}>{fmt(r.amount_usd)}</td>
                    <td style={{ padding: '10px 18px', fontSize: 13, color: MUTED, textTransform: 'capitalize' }}>{(r.method || '—').replace(/_/g, ' ')}</td>
                    <td style={{ padding: '10px 18px', fontSize: 13, color: MUTED }}>{r.reference || '—'}</td>
                    <td style={{ padding: '10px 18px', fontSize: 13, color: MUTED }}>{fmtDate(r.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
