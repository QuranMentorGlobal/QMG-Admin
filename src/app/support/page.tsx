// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/support/page.tsx
// Support — ticketing workspace: priority, categories, response & resolution
// metrics, filters + search, two-pane list/detail with reply + status/priority
// controls. Reads /api/support-metrics; updates via /api/support-ticket.
// ============================================================
'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import RangeTabs, { withinRange } from '@/components/RangeTabs'
import { format } from 'date-fns'
import { Search, Inbox, AlertTriangle, CheckCircle2, Clock, MessageSquare, Send, Tag, Flag } from 'lucide-react'

const GOLD = '#C9A227', INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F8F5EE', GREEN = '#16A34A', RED = '#DC2626'

const PRIORITY: Record<string, { bg: string; color: string }> = {
  urgent: { bg: 'rgba(239,68,68,0.12)', color: RED }, high: { bg: 'rgba(249,115,22,0.12)', color: '#EA580C' },
  normal: { bg: 'rgba(99,102,241,0.1)', color: '#6366F1' }, low: { bg: 'rgba(0,0,0,0.06)', color: '#666' },
}
const STATUS: Record<string, { bg: string; color: string; label: string }> = {
  open: { bg: CREAM, color: GOLD, label: 'Open' }, in_progress: { bg: 'rgba(99,102,241,0.1)', color: '#6366F1', label: 'In progress' },
  resolved: { bg: 'rgba(22,163,74,0.1)', color: GREEN, label: 'Resolved' }, closed: { bg: 'rgba(0,0,0,0.06)', color: '#666', label: 'Closed' },
}
const STATUSES = ['all', 'open', 'in_progress', 'resolved', 'closed']
const PRIORITIES = ['low', 'normal', 'high', 'urgent']
const CATEGORIES = ['general', 'billing', 'technical', 'account']

function Kpi({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <div className="adminx-stat" style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={14} style={{ color: GOLD }} /></div>
        <p style={{ fontSize: 11, color: MUTED, margin: 0, fontWeight: 600 }}>{label}</p>
      </div>
      <p style={{ fontSize: 20, fontWeight: 800, color: accent ? GOLD : INK, margin: 0, lineHeight: 1, fontFamily: "'Fraunces',serif" }}>{value}</p>
    </div>
  )
}
function Badge({ map, k }: { map: Record<string, { bg: string; color: string; label?: string }>; k: string }) {
  const s = map[k] || { bg: '#F3F4F6', color: MUTED }
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 7, textTransform: 'capitalize', background: s.bg, color: s.color }}>{(s as any).label || k.replace('_', ' ')}</span>
}
function Skel({ h }: { h: number }) { return <div className="qmg-skel" style={{ width: '100%', height: h }} /> }

export default function AdminSupportPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [d, setD] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [reply, setReply] = useState('')
  const [replyStatus, setReplyStatus] = useState('resolved')
  const [replyPriority, setReplyPriority] = useState('normal')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')
  const [fStatus, setFStatus] = useState('all')
  const [fCat, setFCat] = useState('all')
  const [search, setSearch] = useState('')
  const [range, setRange] = useState('all')

  useEffect(() => {
    (async () => { try { const sb = createClient(); const { data: { user } } = await sb.auth.getUser(); if (user) { const { data: p } = await sb.from('profiles').select('first_name').eq('id', user.id).single(); setAdminName((p as any)?.first_name || 'Admin') } } catch {} })()
  }, [])

  async function load() {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/support-metrics')
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) throw new Error(json.error || `Failed to load tickets (${res.status})`)
      setD(json)
      if (json.error) setErr(`Tickets could not be read: ${json.error}`)
    } catch (e: any) {
      setErr(e.message || 'Could not load support tickets.')
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openTicket(t: any) { setSelected(t); setReply(t.adminReply || ''); setReplyStatus(t.status === 'open' ? 'resolved' : t.status); setReplyPriority(t.priority || 'normal') }

  async function save() {
    if (!selected) return
    setSending(true)
    const res = await fetch('/api/support-ticket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticketId: selected.id, status: replyStatus, reply: reply.trim(), priority: replyPriority }) })
    const ok = res.ok
    setToast(ok ? '✅ Ticket updated' : '❌ ' + ((await res.json().catch(() => ({}))).error || 'Not permitted'))
    setTimeout(() => setToast(''), 3000)
    if (ok) { await load(); setSelected((s: any) => s ? { ...s, status: replyStatus, priority: replyPriority, adminReply: reply.trim() } : null) }
    setSending(false)
  }

  const m = d?.metrics || { total: 0, open: 0, inProgress: 0, resolved: 0, urgentOpen: 0, responded: 0, responseRate: 0, resolutionRate: 0, avgResolutionHours: 0 }
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return withinRange((d?.tickets || []), range, (t: any) => t.createdAt).filter((t: any) => {
      if (fStatus !== 'all' && t.status !== fStatus) return false
      if (fCat !== 'all' && t.category !== fCat) return false
      if (q && !`${t.subject} ${t.message} ${t.userName} ${t.userEmail}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [d, fStatus, fCat, search, range])

  return (
    <AdminLayout adminName={adminName}>
      {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, padding: '12px 18px', borderRadius: 12, background: toast.startsWith('✅') ? 'linear-gradient(135deg,#166534,#C9A227)' : RED, color: toast.startsWith('✅') ? '#111111' : '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>{toast}</div>}

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 800, color: INK, margin: 0 }}>Support</h1>
        <p style={{ fontSize: 13, color: '#6B6B6B', margin: '5px 0 0' }}>Ticketing workspace — respond, prioritise and resolve.</p>
      </div>

      {err && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', borderRadius: 12, padding: '12px 16px', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          <span>{err}</span>
          <button onClick={load} style={{ padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#166534,#C9A227)', color: '#fff', fontSize: 12.5, fontWeight: 700 }}>Retry</button>
        </div>
      )}

      {/* Metrics */}
      <div className="qmg-sp-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10, marginBottom: 18 }}>
        {loading ? [...Array(6)].map((_, i) => <Skel key={i} h={84} />) : <>
          <Kpi icon={Inbox} label="Total" value={String(m.total)} />
          <Kpi icon={Clock} label="Open" value={String(m.open)} accent />
          <Kpi icon={AlertTriangle} label="Urgent open" value={String(m.urgentOpen)} />
          <Kpi icon={MessageSquare} label="Response rate" value={`${m.responseRate}%`} />
          <Kpi icon={CheckCircle2} label="Resolution rate" value={`${m.resolutionRate}%`} />
          <Kpi icon={Clock} label="Avg resolution" value={m.avgResolutionHours >= 24 ? `${(m.avgResolutionHours / 24).toFixed(1)}d` : `${m.avgResolutionHours}h`} />
        </>}
      </div>

      {/* Breakdown */}
      {!loading && d && (
        <div className="qmg-sp-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 18, marginBottom: 18 }}>
          <div className="adminx-rise" style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', border: `1px solid ${BORDER}` }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: INK, margin: '0 0 10px' }}><Tag size={14} style={{ color: GOLD }} /> By Category</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{d.byCategory.map((c: any) => <span key={c.name} style={{ fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 9, background: CREAM, color: INK, textTransform: 'capitalize' }}>{c.name} · <strong style={{ color: GOLD }}>{c.count}</strong></span>)}</div>
          </div>
          <div className="adminx-rise" style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', border: `1px solid ${BORDER}` }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: INK, margin: '0 0 10px' }}><Flag size={14} style={{ color: GOLD }} /> By Priority</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{d.byPriority.map((c: any) => { const s = PRIORITY[c.name] || { bg: CREAM, color: INK }; return <span key={c.name} style={{ fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 9, background: s.bg, color: s.color, textTransform: 'capitalize' }}>{c.name} · {c.count}</span> })}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="qmg-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUSES.map(s => <button key={s} onClick={() => setFStatus(s)} style={{ padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, textTransform: 'capitalize', cursor: 'pointer', border: fStatus === s ? 'none' : `1px solid ${BORDER}`, background: fStatus === s ? 'linear-gradient(135deg,#166534,#C9A227)' : '#fff', color: fStatus === s ? '#111111' : '#6B6B6B' }}>{s.replace('_', ' ')}</button>)}
        </div>
        <select value={fCat} onChange={e => setFCat(e.target.value)} style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 12.5, color: INK, background: '#fff', fontWeight: 600 }}>
          <option value="all">All categories</option>{CATEGORIES.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 300 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 10, color: MUTED }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets…" style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 13, background: '#fff', color: INK }} />
        </div>
        <RangeTabs value={range} onChange={setRange} />
      </div>

      {/* Two-pane workspace */}
      <div className="qmg-sp-work" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', gap: 18 }}>
        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 620, overflowY: 'auto' }}>
          {loading ? [...Array(4)].map((_, i) => <Skel key={i} h={76} />)
            : filtered.length === 0 ? <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', border: `1px solid ${BORDER}` }}><p style={{ fontSize: 13, color: MUTED, margin: 0 }}>No tickets match.</p></div>
              : filtered.map((t: any) => (
                <button key={t.id} onClick={() => openTicket(t)} className="adminx-row" style={{ textAlign: 'left', background: selected?.id === t.id ? CREAM : '#fff', borderRadius: 13, padding: 14, border: `1px solid ${selected?.id === t.id ? GOLD : BORDER}`, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, flexWrap: 'wrap' }}>
                    <Badge map={PRIORITY} k={t.priority} /><Badge map={STATUS} k={t.status} />
                    <span style={{ fontSize: 10.5, color: MUTED, marginLeft: 'auto' }}>{t.createdAt ? format(new Date(t.createdAt), 'dd MMM') : ''}</span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: INK, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject}</p>
                  <p style={{ fontSize: 11.5, color: MUTED, margin: '3px 0 0' }}>{t.userName}{t.category ? ` · ${t.category}` : ''}</p>
                </button>
              ))}
        </div>

        {/* Detail */}
        <div className="adminx-rise" style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, padding: 20, minHeight: 320 }}>
          {!selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 280, gap: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MessageSquare size={22} style={{ color: GOLD }} /></div>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: INK, margin: 0 }}>Select a ticket</p>
              <p style={{ fontSize: 12.5, color: MUTED, margin: 0 }}>Choose a ticket from the list to view and respond.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <Badge map={PRIORITY} k={selected.priority} /><Badge map={STATUS} k={selected.status} />
                {selected.category && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 7, background: '#F1F1ED', color: MUTED, textTransform: 'capitalize' }}>{selected.category}</span>}
                <span style={{ fontSize: 11, color: MUTED, marginLeft: 'auto' }}>{selected.createdAt ? format(new Date(selected.createdAt), 'dd MMM yyyy, HH:mm') : ''}</span>
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: INK, margin: '0 0 4px', fontFamily: "'Fraunces',serif" }}>{selected.subject}</h2>
              <p style={{ fontSize: 12, color: MUTED, margin: '0 0 12px' }}>From {selected.userName} · {selected.userEmail}</p>
              {selected.message && <p style={{ fontSize: 13.5, color: '#444', lineHeight: 1.6, margin: '0 0 14px', padding: '12px 14px', background: '#FBF8F1', borderRadius: 11, border: `1px solid ${BORDER}` }}>{selected.message}</p>}
              {selected.adminReply && <div style={{ margin: '0 0 14px', padding: '12px 14px', background: 'rgba(201,162,39,0.06)', borderRadius: 11, border: '1px solid rgba(201,162,39,0.25)' }}><p style={{ fontSize: 10.5, fontWeight: 700, color: GOLD, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Previous reply</p><p style={{ fontSize: 13, color: '#444', margin: 0, lineHeight: 1.55 }}>{selected.adminReply}</p></div>}

              <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply…" rows={4} style={{ width: '100%', padding: 12, borderRadius: 11, border: `1px solid ${BORDER}`, fontSize: 13.5, fontFamily: "'Inter',sans-serif", color: INK, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 12 }}>
                <label style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>Status
                  <select value={replyStatus} onChange={e => setReplyStatus(e.target.value)} style={{ marginLeft: 6, padding: '6px 10px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 12.5, color: INK, background: '#fff', fontWeight: 600 }}>
                    {['open', 'in_progress', 'resolved', 'closed'].map(s => <option key={s} value={s}>{STATUS[s]?.label || s}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>Priority
                  <select value={replyPriority} onChange={e => setReplyPriority(e.target.value)} style={{ marginLeft: 6, padding: '6px 10px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 12.5, color: INK, background: '#fff', fontWeight: 600 }}>
                    {PRIORITIES.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </label>
                <button onClick={save} disabled={sending} style={{ display: 'flex', alignItems: 'center', gap: 7, marginLeft: 'auto', padding: '9px 16px', borderRadius: 11, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#166534,#C9A227)', color: '#fff', fontSize: 13, fontWeight: 700, opacity: sending ? 0.6 : 1 }}><Send size={14} /> {sending ? 'Saving…' : 'Send & Update'}</button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        .qmg-skel{background:linear-gradient(90deg,#F1ECE2 25%,#E8E2D6 50%,#F1ECE2 75%);background-size:200% 100%;animation:qmgsh 1.4s infinite;border-radius:14px}
        @keyframes qmgsh{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @media(max-width:1000px){ .qmg-sp-kpi{grid-template-columns:repeat(3, minmax(0, 1fr))!important} .qmg-sp-2{grid-template-columns:minmax(0,1fr)!important} .qmg-sp-work{grid-template-columns:minmax(0,1fr)!important} }
        @media(max-width:520px){ .qmg-sp-kpi{grid-template-columns:repeat(2, minmax(0, 1fr))!important} }
      `}</style>
    </AdminLayout>
  )
}
