// ============================================================
// FOR qmg-admin REPO → src/app/payouts/page.tsx
// Payout Management — full manual lifecycle (Phase F3).
// Reviewer (finance.review): approve / reject / request info.
// Processor (finance.process): start processing / complete (+proof) / fail.
// UI palette + structure unchanged from the original page.
// ============================================================
'use client'

import { useEffect, useState } from 'react'
import PageHead from '@/components/PageHead'
import { Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import RangeTabs, { withinRange } from '@/components/RangeTabs'
import SearchBar from '@/components/SearchBar'

const GOLD = '#C9A227'
const INK  = '#111111'
const MUTED = '#6B7280'

const METHODS = ['bank_transfer', 'wise', 'payoneer', 'jazzcash', 'easypaisa', 'other']

interface PayoutRow {
  id: string
  teacher_id: string
  teacher_name?: string
  amount_usd: number
  currency: string
  settlement_currency?: string | null; amount_local?: number | null; payout_rate?: number | null; local_breakdown?: any
  status: string
  payout_method: string | null
  payout_account: string | null
  requested_at: string | null
  approved_at: string | null
  processing_at: string | null
  completed_at: string | null
  paid_at: string | null
  processed_by: string | null
  payment_method_used: string | null
  reference_number: string | null
  transaction_id: string | null
  payment_proof_url: string | null
  rejection_reason: string | null
  failure_reason: string | null
  info_request_note: string | null
  payout_settings_snapshot: any
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  requested:    { bg: 'rgba(201,162,39,0.14)', color: '#C9A227' },
  pending:      { bg: 'rgba(201,162,39,0.14)', color: '#C9A227' },
  under_review: { bg: 'rgba(245,158,11,0.14)', color: '#B45309' },
  approved:     { bg: 'rgba(99,102,241,0.12)', color: '#6366F1' },
  processing:   { bg: 'rgba(14,165,233,0.12)', color: '#0284C7' },
  completed:    { bg: 'rgba(22,163,74,0.12)',  color: '#16A34A' },
  rejected:     { bg: 'rgba(220,38,38,0.12)',  color: '#DC2626' },
  failed:       { bg: 'rgba(220,38,38,0.12)',  color: '#DC2626' },
}
const STATUS_LABEL: Record<string, string> = {
  requested: 'requested', pending: 'requested', under_review: 'under review',
  approved: 'approved', processing: 'processing', completed: 'completed',
  rejected: 'rejected', failed: 'failed',
}
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.requested
  return <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 8, textTransform: 'uppercase', background: s.bg, color: s.color }}>{STATUS_LABEL[status] || status}</span>
}

const fmt = (n: number) => `$${(n || 0).toFixed(2)}`
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const prettyMethod = (m: string | null) => (m || '—').replace(/_/g, ' ')

const FILTERS = ['requested', 'under_review', 'approved', 'processing', 'completed', 'rejected', 'failed', 'all'] as const
type Filter = typeof FILTERS[number]
// 'requested' tab also surfaces legacy 'pending' rows.
const matchesFilter = (status: string, f: Filter) =>
  f === 'all' ? true : f === 'requested' ? (status === 'requested' || status === 'pending') : status === f

export default function AdminPayoutsPage() {
  const supabase = createClient()
  const [rows, setRows]       = useState<PayoutRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<Filter>('requested')
  const [search, setSearch]   = useState('')
  const [range, setRange]     = useState('all')
  const [from, setFrom]       = useState('')
  const [to, setTo]           = useState('')
  const [busy, setBusy]       = useState<string | null>(null)
  const [detail, setDetail]   = useState<PayoutRow | null>(null)
  const [detailData, setDetailData] = useState<any>(null)
  const [completeFor, setCompleteFor] = useState<PayoutRow | null>(null)

  // Caller permissions (gate the action buttons; the API also enforces).
  const [canReview, setCanReview]   = useState(false)
  const [canProcess, setCanProcess] = useState(false)

  useEffect(() => { loadCtx(); load() }, []) // eslint-disable-line

  async function loadCtx() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await (supabase as any).from('profiles')
        .select('admin_role, admin_permissions').eq('id', user.id).single()
      const isSuper = prof?.admin_role !== 'sub'
      const perms: string[] = Array.isArray(prof?.admin_permissions) ? prof.admin_permissions : []
      setCanReview(isSuper || perms.includes('finance.review'))
      setCanProcess(isSuper || perms.includes('finance.process'))
    } catch {}
  }

  async function load() {
    setLoading(true)
    let data: any[] = []
    try { const res = await fetch('/api/payouts'); data = res.ok ? await res.json() : [] } catch {}
    const list: PayoutRow[] = (Array.isArray(data) ? data : []).map((r: any) => ({
      ...r,
      teacher_name: r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}`.trim() : 'Teacher',
    }))
    setRows(list)
    setLoading(false)
  }

  async function authHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }
  }

  async function action(payoutId: string, act: string, extra?: any) {
    setBusy(payoutId)
    try {
      const res = await fetch('/api/admin-payouts', {
        method: 'POST', headers: await authHeader(),
        body: JSON.stringify({ action: act, payoutId, ...extra }),
      })
      const text = await res.text(); const j = text ? JSON.parse(text) : {}
      if (!res.ok) { alert(j.error || 'Failed'); return }
      await load(); setDetail(null); setCompleteFor(null)
    } finally { setBusy(null) }
  }

  async function openDetail(r: PayoutRow) {
    setDetail(r); setDetailData(null)
    try {
      const res = await fetch(`/api/finance/detail?payoutId=${r.id}`)
      setDetailData(res.ok ? await res.json() : null)
    } catch { setDetailData(null) }
  }

  const filtered = withinRange(rows, range, (r) => r.requested_at, from, to)
    .filter(r => matchesFilter(r.status, filter))
    .filter(r => !search.trim() || (r.teacher_name || '').toLowerCase().includes(search.trim().toLowerCase()))

  const sum = (pred: (r: PayoutRow) => boolean) => rows.filter(pred).reduce((s, r) => s + (r.amount_usd || 0), 0)
  const totals = {
    requested:  sum(r => r.status === 'requested' || r.status === 'pending' || r.status === 'under_review'),
    approved:   sum(r => r.status === 'approved'),
    processing: sum(r => r.status === 'processing'),
    paid:       sum(r => r.status === 'completed'),
  }

  const btn = (bg: string, color: string): React.CSSProperties => ({ fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', background: bg, color, border: 'none' })

  function exportCSV() {
    const headers = ['Teacher', 'Amount', 'Currency', 'Method', 'Status', 'Requested', 'Approved', 'Paid', 'Reference', 'Transaction ID']
    const lines = [headers.join(',')]
    filtered.forEach(r => {
      const cells = [r.teacher_name || '', r.amount_usd ?? '', r.currency || '', r.payment_method_used || r.payout_method || '', r.status || '', r.requested_at || '', r.approved_at || '', r.paid_at || r.completed_at || '', r.reference_number || '', r.transaction_id || '']
      lines.push(cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `muddarris-payouts-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  function RowActions({ r }: { r: PayoutRow }) {
    const st = r.status === 'pending' ? 'requested' : r.status
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => openDetail(r)} style={btn('rgba(201,162,39,0.08)', GOLD)}>View</button>

        {canReview && (st === 'requested' || st === 'under_review') && (
          <>
            <button disabled={busy === r.id} onClick={() => action(r.id, 'approve')} style={btn('#6366F1', '#fff')}>Approve</button>
            <button disabled={busy === r.id} onClick={() => { const reason = prompt('Rejection reason:'); if (reason) action(r.id, 'reject', { reason }) }} style={btn('rgba(220,38,38,0.08)', '#DC2626')}>Reject</button>
            <button disabled={busy === r.id} onClick={() => { const note = prompt('What information do you need from the teacher?'); if (note) action(r.id, 'request_info', { note }) }} style={btn('rgba(245,158,11,0.10)', '#B45309')}>Request Info</button>
          </>
        )}

        {canProcess && st === 'approved' && (
          <button disabled={busy === r.id} onClick={() => { const m = prompt(`Payment method (${METHODS.join(', ')}):`, 'bank_transfer'); if (m) action(r.id, 'processing', { payment_method_used: m }) }} style={btn('rgba(14,165,233,0.12)', '#0284C7')}>Start Processing</button>
        )}
        {canProcess && (st === 'approved' || st === 'processing') && (
          <>
            <button disabled={busy === r.id} onClick={() => setCompleteFor(r)} style={btn('#16A34A', '#fff')}>Mark Paid</button>
            <button disabled={busy === r.id} onClick={() => { const reason = prompt('Failure reason:'); if (reason) action(r.id, 'fail', { reason }) }} style={btn('rgba(220,38,38,0.08)', '#DC2626')}>Mark Failed</button>
          </>
        )}
      </div>
    )
  }

  return (
    <AdminLayout>
    <div style={{ width: '100%' }}>
      <PageHead
        title="Payout Management"
        subtitle="Review and process teacher payout requests."
        range={{ value: range, onChange: setRange, from, to, onFrom: setFrom, onTo: setTo }}
        actions={<button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 11, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#166534,#C9A227)', color: '#fff', fontSize: 12.5, fontWeight: 700 }}><Download size={14} /> Export CSV</button>}
      />

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Requested / In Review', value: fmt(totals.requested), color: GOLD },
          { label: 'Approved (unpaid)', value: fmt(totals.approved), color: '#6366F1' },
          { label: 'Processing', value: fmt(totals.processing), color: '#0284C7' },
          { label: 'Total Paid Out', value: fmt(totals.paid), color: '#16A34A' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 16, padding: 18, border: '1px solid rgba(201,162,39,0.12)' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs + search */}
      <div className="qmg-payout-filterbar" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="qmg-payout-tabs" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
                background: filter === f ? 'linear-gradient(135deg,#166534,#C9A227)' : '#fff', color: filter === f ? '#111111' : MUTED, border: `1px solid ${filter === f ? GOLD : '#E5E7EB'}` }}>
              {f.replace('_', ' ')} {f !== 'all' && `(${rows.filter(r => matchesFilter(r.status, f)).length})`}
            </button>
          ))}
        </div>
        <div className="qmg-payout-search" style={{ marginLeft: 'auto', flex: '0 1 320px', minWidth: 200 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search teacher…" />
        </div>
        <style>{`@media (max-width:640px){
          .qmg-payout-controls{ width:100%; justify-content:center; }
          .qmg-payout-filterbar{ justify-content:center; }
          .qmg-payout-tabs{ width:100%; justify-content:center; }
          .qmg-payout-search{ margin-left:0 !important; flex:1 1 100% !important; width:100%; }
        }`}</style>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'auto', border: '1px solid rgba(201,162,39,0.12)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>No {filter.replace('_', ' ')} payouts.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead>
              <tr style={{ background: 'rgba(201,162,39,0.05)', textAlign: 'left' }}>
                {['Teacher', 'Amount', 'Method', 'Status', 'Requested', 'Approved', 'Paid', 'Reference', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid rgba(201,162,39,0.07)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>{r.teacher_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: INK }}>{fmt(r.amount_usd)}{r.settlement_currency && r.settlement_currency !== 'usd' && r.amount_local != null && <span style={{ display: 'block', fontSize: 11, color: MUTED, fontWeight: 600 }}>→ {r.settlement_currency.toUpperCase()} {Number(r.amount_local).toLocaleString()}</span>}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: MUTED, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{prettyMethod(r.payment_method_used || r.payout_method)}</td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={r.status} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: MUTED, whiteSpace: 'nowrap' }}>{fmtDate(r.requested_at)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: MUTED, whiteSpace: 'nowrap' }}>{fmtDate(r.approved_at)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: MUTED, whiteSpace: 'nowrap' }}>{fmtDate(r.paid_at || r.completed_at)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: MUTED, whiteSpace: 'nowrap' }}>{r.reference_number || '—'}</td>
                  <td style={{ padding: '12px 16px' }}><RowActions r={r} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Complete (Mark Paid) modal — method, reference, txn id, notes, proof */}
      {completeFor && (
        <CompleteModal
          payout={completeFor}
          onClose={() => setCompleteFor(null)}
          busy={busy === completeFor.id}
          uploadHeaders={authHeader}
          onSubmit={(payload) => action(completeFor.id, 'complete', payload)}
          supabase={supabase}
        />
      )}

      {/* Detail modal — timeline + proof + snapshot */}
      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: INK, margin: '0 0 4px' }}>Payout Details</h3>
            <p style={{ fontSize: 13, color: MUTED, margin: '0 0 16px' }}>{detail.teacher_name} · {fmt(detail.amount_usd)} · <StatusBadge status={detail.status} /></p>

            {/* Key facts */}
            <div style={{ background: 'rgba(201,162,39,0.05)', borderRadius: 12, padding: 16, fontSize: 13 }}>
              {[
                ['Requested', fmtDate(detail.requested_at)],
                ['Approved', fmtDate(detail.approved_at)],
                ['Paid', fmtDate(detail.paid_at || detail.completed_at)],
                ['Method', prettyMethod(detail.payment_method_used || detail.payout_method)],
                ['Reference', detail.reference_number || '—'],
                ['Transaction ID', detail.transaction_id || '—'],
                ['Processed by', detailData?.processedByName || '—'],
                ...(detail.settlement_currency && detail.settlement_currency !== 'usd'
                  ? [
                      ['Paid as', `${detail.settlement_currency.toUpperCase()} ${Number(detail.amount_local || 0).toLocaleString()}`],
                      ...(detail.local_breakdown?.frozen?.local ? [['  • Frozen (payment-day)', `${detail.settlement_currency.toUpperCase()} ${Number(detail.local_breakdown.frozen.local).toLocaleString()}`]] : []),
                      ...(detail.local_breakdown?.converted?.local ? [[`  • Converted @ ${detail.payout_rate || '—'}`, `${detail.settlement_currency.toUpperCase()} ${Number(detail.local_breakdown.converted.local).toLocaleString()}`]] : []),
                    ]
                  : []),
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ color: MUTED }}>{k}</span><span style={{ color: INK, fontWeight: 600 }}>{v as string}</span>
                </div>
              ))}
            </div>

            {/* Proof */}
            {detailData?.proofUrl && (
              <a href={detailData.proofUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 12, fontSize: 13, fontWeight: 700, color: '#6366F1' }}>View payment proof ↗</a>
            )}

            {(detail.rejection_reason || detail.failure_reason || detail.info_request_note) && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(220,38,38,0.06)', fontSize: 13, color: '#DC2626' }}>
                {detail.rejection_reason && <>Rejected: {detail.rejection_reason}</>}
                {detail.failure_reason && <>Failed: {detail.failure_reason}</>}
                {detail.info_request_note && <>Info requested: {detail.info_request_note}</>}
              </div>
            )}

            {/* Timeline */}
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px' }}>Timeline</p>
              {!detailData ? <p style={{ fontSize: 13, color: MUTED }}>Loading…</p> : (detailData.events || []).length === 0 ? <p style={{ fontSize: 13, color: MUTED }}>No events.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detailData.events.map((e: any) => (
                    <div key={e.id} style={{ display: 'flex', gap: 10, fontSize: 12.5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: GOLD, marginTop: 5, flexShrink: 0 }} />
                      <div>
                        <span style={{ fontWeight: 700, color: INK, textTransform: 'capitalize' }}>{String(e.action).replace(/_/g, ' ')}</span>
                        <span style={{ color: MUTED }}> · {e.actor_name} ({e.actor_role}) · {new Date(e.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        {e.note && <div style={{ color: MUTED }}>{e.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setDetail(null)} style={{ marginTop: 18, width: '100%', padding: 12, borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', background: '#F8F5EE', color: INK, border: 'none' }}>Close</button>
          </div>
        </div>
      )}
    </div>
    </AdminLayout>
  )
}

// ── Complete modal (processor) ────────────────────────────────────────────────
function CompleteModal({ payout, onClose, onSubmit, busy, uploadHeaders, supabase }: {
  payout: PayoutRow; onClose: () => void; onSubmit: (p: any) => void; busy: boolean
  uploadHeaders: () => Promise<any>; supabase: any
}) {
  const [method, setMethod] = useState(payout.payment_method_used || payout.payout_method || 'bank_transfer')
  const [reference, setReference] = useState('')
  const [txn, setTxn] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  const input: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13, background: '#fff', color: INK, marginTop: 4 }
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: MUTED }

  async function submit() {
    setErr('')
    if (!reference.trim()) { setErr('A reference / transaction number is required.'); return }
    let proofPath: string | null = null
    try {
      if (file) {
        setUploading(true)
        const fd = new FormData(); fd.append('file', file); fd.append('payoutId', payout.id)
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/finance/upload-proof', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: fd,
        })
        const j = await res.json()
        if (!res.ok) { setErr(j.error || 'Proof upload failed.'); setUploading(false); return }
        proofPath = j.path
      }
    } catch { setErr('Proof upload failed.'); setUploading(false); return }
    setUploading(false)
    onSubmit({
      payment_method_used: method, reference_number: reference.trim(),
      transaction_id: txn.trim() || null, finance_notes: notes.trim() || null,
      payment_proof_url: proofPath,
    })
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: INK, margin: '0 0 4px' }}>Mark Payout Paid</h3>
        <p style={{ fontSize: 13, color: MUTED, margin: '0 0 16px' }}>{payout.teacher_name} · {fmt(payout.amount_usd)}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><span style={label}>Payment Method</span>
            <select value={method} onChange={e => setMethod(e.target.value)} style={input}>
              {METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div><span style={label}>Reference Number *</span>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. TRX-99123" style={input} />
          </div>
          <div><span style={label}>Transaction ID</span>
            <input value={txn} onChange={e => setTxn(e.target.value)} placeholder="Optional" style={input} />
          </div>
          <div><span style={label}>Notes</span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" style={{ ...input, minHeight: 60, resize: 'vertical' }} />
          </div>
          <div><span style={label}>Payment Proof (image or PDF)</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} style={{ ...input, padding: 8 }} />
          </div>
          {err && <div style={{ fontSize: 13, color: '#DC2626' }}>{err}</div>}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', background: '#F8F5EE', color: INK, border: 'none' }}>Cancel</button>
          <button disabled={busy || uploading} onClick={submit} style={{ flex: 1, padding: 12, borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', background: '#16A34A', color: '#fff', border: 'none', opacity: (busy || uploading) ? 0.6 : 1 }}>
            {uploading ? 'Uploading…' : busy ? 'Saving…' : 'Confirm Paid'}
          </button>
        </div>
      </div>
    </div>
  )
}
