// ============================================================
// FOR qmg-admin REPO → src/app/payouts/page.tsx
// Admin Payout Management — review, approve, reject, complete
// ============================================================
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Charcoal-gold admin palette
const GOLD = '#C8A24A'
const DARK = '#0B0B0B'
const INK  = '#111111'
const MUTED = '#6B7280'

interface PayoutRow {
  id: string
  teacher_id: string
  teacher_name?: string
  amount_usd: number
  currency: string
  status: string
  payout_method: string | null
  payout_account: string | null
  requested_at: string | null
  approved_at: string | null
  completed_at: string | null
  rejection_reason: string | null
  payout_settings_snapshot: any
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    pending:    { bg: 'rgba(200,162,74,0.14)', color: '#C8A24A' },
    approved:   { bg: 'rgba(99,102,241,0.12)', color: '#6366F1' },
    processing: { bg: 'rgba(99,102,241,0.12)', color: '#6366F1' },
    completed:  { bg: 'rgba(22,163,74,0.12)',  color: '#16A34A' },
    rejected:   { bg: 'rgba(220,38,38,0.12)',  color: '#DC2626' },
    failed:     { bg: 'rgba(220,38,38,0.12)',  color: '#DC2626' },
  }
  const s = map[status] ?? map.pending
  return <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 8, textTransform: 'uppercase', background: s.bg, color: s.color }}>{status}</span>
}

const fmt = (n: number, c = 'usd') => `$${(n || 0).toFixed(2)}`
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function AdminPayoutsPage() {
  const supabase = createClient()
  const [rows, setRows]       = useState<PayoutRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all'|'pending'|'approved'|'completed'|'rejected'>('pending')
  const [busy, setBusy]       = useState<string | null>(null)
  const [detail, setDetail]   = useState<PayoutRow | null>(null)

  useEffect(() => { load() }, []) // eslint-disable-line

  async function load() {
    setLoading(true)
    const { data } = await (supabase as any)
      .from('teacher_payouts')
      .select('*, profiles!teacher_payouts_teacher_id_fkey(first_name, last_name)')
      .order('requested_at', { ascending: false, nullsFirst: false })
    const list: PayoutRow[] = (data ?? []).map((r: any) => ({
      ...r,
      teacher_name: r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}`.trim() : 'Teacher',
    }))
    setRows(list)
    setLoading(false)
  }

  async function action(payoutId: string, act: 'approve' | 'reject' | 'complete', extra?: any) {
    setBusy(payoutId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: act, payoutId, ...extra }),
      })
      if (!res.ok) { const j = await res.json(); alert(j.error || 'Failed') }
      await load()
      setDetail(null)
    } finally { setBusy(null) }
  }

  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter)
  const totals = {
    pending:   rows.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount_usd, 0),
    approved:  rows.filter(r => r.status === 'approved').reduce((s, r) => s + r.amount_usd, 0),
    completed: rows.filter(r => r.status === 'completed').reduce((s, r) => s + r.amount_usd, 0),
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: GOLD, margin: 0 }}>Finance</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: INK, margin: '4px 0 0' }}>Payout Management</h1>
        <p style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>Review and process teacher payout requests.</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Pending Requests', value: fmt(totals.pending), color: GOLD },
          { label: 'Approved (unpaid)', value: fmt(totals.approved), color: '#6366F1' },
          { label: 'Total Paid Out', value: fmt(totals.completed), color: '#16A34A' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 16, padding: 18, border: '1px solid rgba(200,162,74,0.12)' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['pending','approved','completed','rejected','all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
              background: filter === f ? GOLD : '#fff', color: filter === f ? '#1A1400' : MUTED, border: `1px solid ${filter === f ? GOLD : '#E5E7EB'}` }}>
            {f} {f !== 'all' && `(${rows.filter(r => r.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(200,162,74,0.12)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>No {filter} payouts.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(200,162,74,0.05)', textAlign: 'left' }}>
                {['Teacher', 'Amount', 'Method', 'Requested', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid rgba(200,162,74,0.07)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: INK }}>{r.teacher_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: INK }}>{fmt(r.amount_usd, r.currency)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: MUTED, textTransform: 'capitalize' }}>{(r.payout_method || '—').replace('_', ' ')}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: MUTED }}>{fmtDate(r.requested_at)}</td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={r.status} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => setDetail(r)}
                        style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', background: 'rgba(200,162,74,0.08)', color: GOLD, border: 'none' }}>
                        View
                      </button>
                      {r.status === 'pending' && (
                        <>
                          <button disabled={busy === r.id} onClick={() => action(r.id, 'approve')}
                            style={{ fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', background: '#6366F1', color: '#fff', border: 'none' }}>
                            Approve
                          </button>
                          <button disabled={busy === r.id} onClick={() => { const reason = prompt('Rejection reason:'); if (reason) action(r.id, 'reject', { reason }) }}
                            style={{ fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: 'none' }}>
                            Reject
                          </button>
                        </>
                      )}
                      {r.status === 'approved' && (
                        <button disabled={busy === r.id} onClick={() => { const ref = prompt('Payment reference / transaction ID:'); action(r.id, 'complete', { reference: ref || '' }) }}
                          style={{ fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', background: '#16A34A', color: '#fff', border: 'none' }}>
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail modal — shows payout settings snapshot */}
      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: INK, margin: '0 0 4px' }}>Payout Details</h3>
            <p style={{ fontSize: 13, color: MUTED, margin: '0 0 16px' }}>{detail.teacher_name} · {fmt(detail.amount_usd, detail.currency)}</p>
            <div style={{ background: 'rgba(200,162,74,0.05)', borderRadius: 12, padding: 16, fontSize: 13 }}>
              {detail.payout_settings_snapshot && Object.entries(detail.payout_settings_snapshot)
                .filter(([k, v]) => v && !['id','teacher_id','created_at','updated_at','is_verified'].includes(k))
                .map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ color: MUTED, textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
                    <span style={{ color: INK, fontWeight: 600 }}>{String(v)}</span>
                  </div>
                ))}
            </div>
            {detail.rejection_reason && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(220,38,38,0.06)', fontSize: 13, color: '#DC2626' }}>
                Rejected: {detail.rejection_reason}
              </div>
            )}
            <button onClick={() => setDetail(null)} style={{ marginTop: 16, width: '100%', padding: 12, borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', background: '#F5F0E8', color: INK, border: 'none' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
