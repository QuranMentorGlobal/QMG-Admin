// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/email-logs/page.tsx
// Email Logs — delivery status for every email sent via Resend.
// Status filter (incl. Failed view), search, unified date range, retry-failed.
// ============================================================
'use client'
import { useEffect, useMemo, useState } from 'react'
import PageHead from '@/components/PageHead'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import RangeTabs, { withinRange } from '@/components/RangeTabs'
import { Search, Mail, RotateCcw, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react'

const GOLD = '#C9A227', INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F8F5EE'

type Log = {
  id: string; created_at: string; email_type: string; recipient: string
  subject: string | null; status: string; provider_message_id: string | null
  error: string | null; attempts: number; last_attempt_at: string | null
  related_type: string | null
}

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  pending:    { label: 'Pending',    bg: 'rgba(154,154,138,0.12)', fg: '#6B6B6B' },
  sent:       { label: 'Sent',       bg: 'rgba(201,162,39,0.12)',  fg: '#8A6A16' },
  delivered:  { label: 'Delivered',  bg: 'rgba(22,101,52,0.12)',   fg: '#166534' },
  opened:     { label: 'Opened',     bg: 'rgba(22,101,52,0.14)',   fg: '#166534' },
  failed:     { label: 'Failed',     bg: 'rgba(220,38,38,0.10)',   fg: '#DC2626' },
  bounced:    { label: 'Bounced',    bg: 'rgba(220,38,38,0.10)',   fg: '#DC2626' },
  complained: { label: 'Complained', bg: 'rgba(234,88,12,0.12)',   fg: '#C2410C' },
  delayed:    { label: 'Delayed',    bg: 'rgba(234,88,12,0.10)',   fg: '#C2410C' },
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) + ' · ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
function typeLabel(t: string) {
  return (t || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function EmailLogsPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [logs, setLogs] = useState<Log[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [range, setRange] = useState('30')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const sb = createClient(); const { data: { user } } = await sb.auth.getUser()
        if (user) { const { data: p } = await sb.from('profiles').select('first_name').eq('id', user.id).single(); setAdminName((p as any)?.first_name || 'Admin') }
      } catch {}
    })()
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/email-logs')
      const d = await res.json()
      if (res.ok) { setLogs(d.logs || []); setStats(d.stats || {}); setAvailable(d.available !== false) }
    } catch {}
    setLoading(false)
  }

  async function retryFailed() {
    setRetrying(true); setToast(null)
    try {
      const res = await fetch('/api/email-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'retry' }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Retry failed')
      setToast(d.resent != null ? `Retried ${d.processed || 0} · resent ${d.resent}, still failing ${d.stillFailing || 0}.` : 'Retry triggered.')
      await load()
    } catch (e: any) {
      setToast(e.message || 'Could not retry.')
    }
    setRetrying(false)
    setTimeout(() => setToast(null), 5000)
  }

  const filtered = useMemo(() => {
    let rows = withinRange(logs, range, r => r.created_at, from, to)
    if (status !== 'all') rows = rows.filter(r => r.status === status)
    const term = q.trim().toLowerCase()
    if (term) rows = rows.filter(r =>
      (r.recipient || '').toLowerCase().includes(term) ||
      (r.subject || '').toLowerCase().includes(term) ||
      (r.email_type || '').toLowerCase().includes(term))
    return rows
  }, [logs, range, from, to, status, q])

  const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'sent', label: 'Sent' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'opened', label: 'Opened' },
    { key: 'failed', label: 'Failed' },
    { key: 'bounced', label: 'Bounced' },
  ]

  const failedCount = (stats.failed || 0) + (stats.bounced || 0)

  return (
    <AdminLayout adminName={adminName}>
      {/* Header */}
      <PageHead
        title="Email Logs"
        subtitle="Delivery status for every transactional email."
        actions={<button onClick={retryFailed} disabled={retrying || failedCount === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 11, border: 'none', cursor: failedCount === 0 ? 'default' : 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', background: failedCount === 0 ? '#C9C3B5' : 'linear-gradient(135deg,#166534,#C9A227)', opacity: retrying ? 0.6 : 1 }}>
          <RotateCcw size={15} /> {retrying ? 'Retrying…' : `Retry failed${failedCount ? ` (${failedCount})` : ''}`}
        </button>}
      />

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { k: 'total', label: 'Total', icon: Mail, color: INK },
          { k: 'delivered', label: 'Delivered', icon: CheckCircle2, color: '#166534' },
          { k: 'sent', label: 'Sent', icon: Clock, color: GOLD },
          { k: 'failed', label: 'Failed', icon: XCircle, color: '#DC2626' },
          { k: 'bounced', label: 'Bounced', icon: AlertTriangle, color: '#C2410C' },
        ].map(c => {
          const IC = c.icon
          return (
            <div key={c.k} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: MUTED, fontSize: 12, fontWeight: 600 }}>
                <IC size={14} color={c.color} /> {c.label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: INK, marginTop: 4, fontFamily: 'var(--ff)' }}>{stats[c.k] ?? 0}</div>
            </div>
          )
        })}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'inline-flex', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 4, gap: 2, flexWrap: 'wrap' }}>
          {STATUS_TABS.map(t => {
            const on = status === t.key
            return (
              <button key={t.key} onClick={() => setStatus(t.key)} style={{ border: 'none', cursor: 'pointer', padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, background: on ? INK : 'transparent', color: on ? '#fff' : '#6B6B6B' }}>
                {t.label}
              </button>
            )
          })}
        </div>
        <RangeTabs value={range} onChange={setRange} from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      </div>

      <div style={{ position: 'relative', marginBottom: 14, maxWidth: 380 }}>
        <Search size={16} color={MUTED} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search recipient, subject or type…"
          style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 11, border: `1px solid ${BORDER}`, fontSize: 13, color: INK, background: '#fff', outline: 'none' }} />
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: MUTED, fontSize: 13 }}>Loading…</div>
        ) : !available ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: 0 }}>email_logs table not found</p>
            <p style={{ fontSize: 12.5, color: MUTED, marginTop: 6 }}>Run the Batch 1 migration in Supabase, then refresh.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: MUTED, fontSize: 13 }}>No emails match these filters.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: CREAM, color: MUTED, textAlign: 'left' }}>
                  {['Recipient', 'Type', 'Subject', 'Status', 'Attempts', 'When'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const m = STATUS_META[l.status] || STATUS_META.pending
                  return (
                    <tr key={l.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '11px 14px', color: INK, fontWeight: 600, whiteSpace: 'nowrap' }}>{l.recipient}</td>
                      <td style={{ padding: '11px 14px', color: '#6B6B6B', whiteSpace: 'nowrap' }}>{typeLabel(l.email_type)}</td>
                      <td style={{ padding: '11px 14px', color: '#6B6B6B', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.subject || ''}>{l.subject || '—'}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, background: m.bg, color: m.fg }}>{m.label}</span>
                        {l.error && <span title={l.error} style={{ marginLeft: 6, color: '#DC2626', cursor: 'help', fontSize: 12 }}>ⓘ</span>}
                      </td>
                      <td style={{ padding: '11px 14px', color: '#6B6B6B', textAlign: 'center' }}>{l.attempts}</td>
                      <td style={{ padding: '11px 14px', color: '#6B6B6B', whiteSpace: 'nowrap' }}>{fmt(l.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ fontSize: 11.5, color: MUTED, marginTop: 10 }}>
        Showing {filtered.length} of {logs.length} logged emails. Delivery/open status updates as Resend webhooks arrive.
      </p>

      {toast && (
        <div style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 60, background: INK, color: '#fff', padding: '12px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', maxWidth: 380 }}>{toast}</div>
      )}
    </AdminLayout>
  )
}
