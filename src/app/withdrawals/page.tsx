// ============================================================
// FOR qmg-admin REPO → src/app/withdrawals/page.tsx
// Wallet Withdrawals — manual lifecycle queue (mirror of Payout Management).
// Reviewer (finance.review): review / approve / reject.
// Processor (finance.process): start processing / mark paid / fail.
// reject + fail restore the reserved funds to the user's withdrawable balance.
// ============================================================
'use client'

import { useEffect, useState } from 'react'
import PageHead from '@/components/PageHead'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'

const GOLD = '#C9A227'
const INK  = '#111111'
const MUTED = '#6B7280'

interface Row {
  id: string
  user_id: string
  user_name?: string
  user_email?: string | null
  amount_usd: number
  status: string
  method: string
  account_name?: string | null
  account_number?: string | null
  account_extra?: string | null
  reject_reason?: string | null
  requested_at?: string | null
  processed_at?: string | null
  created_at?: string | null
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  requested:    { bg: 'rgba(201,162,39,0.14)', color: '#C9A227' },
  under_review: { bg: 'rgba(245,158,11,0.14)', color: '#B45309' },
  approved:     { bg: 'rgba(99,102,241,0.12)', color: '#6366F1' },
  processing:   { bg: 'rgba(14,165,233,0.12)', color: '#0284C7' },
  completed:    { bg: 'rgba(22,163,74,0.12)',  color: '#16A34A' },
  rejected:     { bg: 'rgba(220,38,38,0.12)',  color: '#DC2626' },
  failed:       { bg: 'rgba(220,38,38,0.12)',  color: '#DC2626' },
}
const STATUS_LABEL: Record<string, string> = {
  requested: 'requested', under_review: 'under review', approved: 'approved',
  processing: 'processing', completed: 'completed', rejected: 'rejected', failed: 'failed',
}
const FILTERS = ['requested', 'under_review', 'approved', 'processing', 'completed', 'rejected', 'failed', 'all'] as const

const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`
const fdate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const methodLabel = (m: string) => (m === 'bank' ? 'Bank' : m === 'jazzcash' ? 'JazzCash' : m === 'easypaisa' ? 'Easypaisa' : m)

export default function WithdrawalsPage() {
  const supabase = createClient()
  const [rows, setRows]       = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<string | null>(null)
  const [filter, setFilter]   = useState<string>('requested')
  const [canReview, setCanReview]   = useState(false)
  const [canProcess, setCanProcess] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        // Server-side role/perms (service role) — browser can't read profiles' admin cols.
        const res = await fetch('/api/admin/me', { cache: 'no-store' })
        const me: any = res.ok ? await res.json() : null
        const isSuper = !!me?.isSuper
        const perms: string[] = Array.isArray(me?.permissions) ? me.permissions : []
        setCanReview(isSuper || perms.includes('finance.review'))
        setCanProcess(isSuper || perms.includes('finance.process'))
      } catch {}
      load()
    })()
  }, []) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/admin-withdrawals?_=${Date.now()}`, { cache: 'no-store', headers: { Authorization: `Bearer ${session?.access_token}` } })
      const j = res.ok ? await res.json() : []
      setRows(Array.isArray(j) ? j : [])
    } catch { setRows([]) }
    setLoading(false)
  }

  async function action(id: string, act: string, extra?: any) {
    if (busy === id) return   // re-entry guard: ignore double-fire on same row
    setBusy(id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin-withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: act, withdrawalId: id, ...extra }),
      })
      const t = await res.text(); const j = t ? JSON.parse(t) : {}
      if (!res.ok) { alert(j.error || 'Failed'); await load(); return }
      await load()
    } finally { setBusy(null) }
  }

  const filtered = rows.filter(r => (filter === 'all' ? true : r.status === filter))
  const sum = (pred: (r: Row) => boolean) => rows.filter(pred).reduce((s, r) => s + (Number(r.amount_usd) || 0), 0)
  const totals = {
    open: sum(r => ['requested', 'under_review', 'approved', 'processing'].includes(r.status)),
    paid: sum(r => r.status === 'completed'),
  }

  const btn = (bg: string, color: string): React.CSSProperties => ({ fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', background: bg, color, border: 'none' })

  function actionsFor(r: Row) {
    const st = r.status
    const out: React.ReactNode[] = []
    if (canReview && (st === 'requested' || st === 'under_review')) {
      if (st === 'requested') out.push(<button key="ur" disabled={busy === r.id} onClick={() => action(r.id, 'under_review')} style={btn('rgba(245,158,11,0.12)', '#B45309')}>Review</button>)
      out.push(<button key="ap" disabled={busy === r.id} onClick={() => action(r.id, 'approve')} style={btn('rgba(99,102,241,0.12)', '#6366F1')}>Approve</button>)
      out.push(<button key="rj" disabled={busy === r.id} onClick={() => { const reason = window.prompt('Reason for rejection?'); if (reason !== null) action(r.id, 'reject', { reason }) }} style={btn('rgba(220,38,38,0.1)', '#DC2626')}>Reject</button>)
    }
    if (canProcess && st === 'approved') {
      out.push(<button key="pr" disabled={busy === r.id} onClick={() => action(r.id, 'processing')} style={btn('rgba(14,165,233,0.12)', '#0284C7')}>Start</button>)
    }
    if (canProcess && (st === 'approved' || st === 'processing')) {
      out.push(<button key="cp" disabled={busy === r.id} onClick={() => { const reference = window.prompt('Payment reference (optional):') || ''; action(r.id, 'complete', { reference }) }} style={btn('rgba(22,163,74,0.12)', '#16A34A')}>Mark Paid</button>)
      out.push(<button key="fl" disabled={busy === r.id} onClick={() => { const reason = window.prompt('Failure reason?'); if (reason !== null) action(r.id, 'fail', { reason }) }} style={btn('rgba(220,38,38,0.1)', '#DC2626')}>Fail</button>)
    }
    return out
  }

  return (
    <AdminLayout>
      <PageHead title="Wallet Withdrawals" subtitle="Review and process user wallet cash-out requests. Rejecting or failing a request returns the funds to the user's withdrawable balance." />

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div style={{ background: '#fff', border: '1px solid rgba(201,162,39,0.18)', borderRadius: 14, padding: 16 }}>
          <p style={{ fontSize: 12, color: MUTED, margin: 0, fontWeight: 700 }}>Open (reserved)</p>
          <p style={{ fontSize: 24, color: INK, margin: '4px 0 0', fontWeight: 800 }}>{money(totals.open)}</p>
        </div>
        <div style={{ background: '#fff', border: '1px solid rgba(201,162,39,0.18)', borderRadius: 14, padding: 16 }}>
          <p style={{ fontSize: 12, color: MUTED, margin: 0, fontWeight: 700 }}>Paid out</p>
          <p style={{ fontSize: 24, color: INK, margin: '4px 0 0', fontWeight: 800 }}>{money(totals.paid)}</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {FILTERS.map(f => {
          const on = filter === f
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                background: on ? 'linear-gradient(135deg,#166534,#C9A227)' : '#fff',
                color: on ? '#fff' : '#166534', border: on ? 'none' : '1px solid rgba(201,162,39,0.3)' }}>
              {f === 'all' ? 'All' : (STATUS_LABEL[f] || f)}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid rgba(201,162,39,0.18)', borderRadius: 16, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>No withdrawals in this view.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: MUTED, background: 'rgba(201,162,39,0.05)' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>User</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>Amount</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>To</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>Requested</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const ss = STATUS_STYLE[r.status] || { bg: 'rgba(0,0,0,0.05)', color: MUTED }
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid #F0EAD9' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: INK }}>{r.user_name || 'User'}</div>
                        {r.user_email && <div style={{ fontSize: 11, color: MUTED }}>{r.user_email}</div>}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: INK }}>{money(r.amount_usd)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: INK }}>{methodLabel(r.method)}</div>
                        <div style={{ fontSize: 11, color: MUTED }}>
                          {r.account_name || ''}{r.account_number ? ` · ${r.account_number}` : ''}{r.account_extra ? ` · ${r.account_extra}` : ''}
                        </div>
                        {r.reject_reason && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>{r.reject_reason}</div>}
                      </td>
                      <td style={{ padding: '12px 14px', color: MUTED }}>{fdate(r.requested_at || r.created_at)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: ss.bg, color: ss.color }}>
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {actionsFor(r)}
                          {actionsFor(r).length === 0 && <span style={{ fontSize: 12, color: MUTED }}>—</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
