// qmg-admin: src/app/moderation/page.tsx
// ────────────────────────────────────────────────────────────────────────────
// Trust & Safety — review conversations the AI scanner flagged as possibly
// trying to move contact or payment off-platform. Admin reads the transcript in
// context and marks each flag Reviewed or Dismissed. No auto-ban: any account
// action is a separate, deliberate step elsewhere.
// ────────────────────────────────────────────────────────────────────────────
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import RangeTabs, { withinRange } from '@/components/RangeTabs'
import { ShieldAlert, CheckCircle, XCircle, Clock, MessageSquareWarning, AlertTriangle } from 'lucide-react'

const GOLD = '#C9A227', INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F8F5EE', RED = '#DC2626'

type Person = { name: string; role: string; email: string }
type Msg = { body: string; created_at: string; sender: string; senderRole: string }
type Flag = {
  id: string
  conversation_id: string
  risk: 'low' | 'medium' | 'high'
  signals: string[]
  reasons: string[]
  evidence: string[]
  status: string
  admin_notes: string | null
  message_count: number
  last_message_at: string | null
  last_scanned_at: string | null
  created_at: string
  participant_1: Person
  participant_2: Person
  messages: Msg[]
}

const SIGNAL_LABEL: Record<string, string> = {
  phone: 'Phone number', email: 'Email address', whatsapp: 'WhatsApp', telegram: 'Telegram',
  external_link: 'External link', social: 'Social/app handle', direct_payment: 'Direct payment', contact_move: 'Move off-platform',
}
const fmtTime = (s: string) => { try { return new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return s } }
const riskColor = (r: string) => r === 'high' ? RED : r === 'medium' ? GOLD : MUTED

export default function ModerationPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [flags, setFlags] = useState<Flag[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<{ m: string; k: 'success' | 'error' } | null>(null)
  const [range, setRange] = useState('all')

  useEffect(() => {
    (async () => { try { const sb = createClient(); const { data: { user } } = await sb.auth.getUser(); if (user) { const { data: p } = await sb.from('profiles').select('first_name').eq('id', user.id).single(); setAdminName((p as any)?.first_name || 'Admin') } } catch {} })()
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/moderation')
      const data = await res.json()
      setFlags(Array.isArray(data) ? data : [])
    } catch { showToast('Failed to load the moderation queue', 'error') }
    setLoading(false)
  }

  function showToast(m: string, k: 'success' | 'error' = 'success') { setToast({ m, k }); setTimeout(() => setToast(null), 3500) }

  async function act(f: Flag, action: 'review' | 'dismiss') {
    setBusy(f.id + action)
    try {
      const res = await fetch('/api/moderation-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: f.id, action, notes: notes[f.id] || '' }),
      })
      const j = await res.json()
      if (!res.ok || j.error) throw new Error(j.error || 'Action failed')
      showToast(action === 'dismiss' ? 'Dismissed as benign' : 'Marked reviewed')
      setFlags(prev => prev.filter(x => x.id !== f.id))
    } catch (e: any) { showToast('' + (e.message || 'Action failed'), 'error') }
    setBusy(null)
  }

  const highCount = flags.filter(f => f.risk === 'high').length

  return (
    <AdminLayout adminName={adminName}>
      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 60, background: toast.k === 'success' ? 'linear-gradient(135deg,#166534,#C9A227)' : RED, color: '#fff', padding: '12px 18px', borderRadius: 12, fontWeight: 700, fontSize: 14, boxShadow: '0 8px 24px rgba(0,0,0,.18)' }}>{toast.m}</div>
      )}

      <div className="w-full">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 800, color: INK, margin: 0 }}>
          <ShieldAlert size={24} color={GOLD} /> Trust &amp; Safety
        </h1>
        <p style={{ color: MUTED, fontSize: 14, margin: '6px 0 0' }}>
          Conversations the scanner flagged for possibly moving contact or payment off-platform.
          {highCount > 0 && <span style={{ color: RED, fontWeight: 700 }}> · {highCount} high-risk</span>}
        </p>

        <div style={{ marginTop: 14 }}><RangeTabs value={range} onChange={setRange} /></div>

        {(() => { const shownFlags = withinRange(flags, range, (f: any) => f.created_at); return (
        loading ? (
          <p style={{ color: MUTED, marginTop: 28 }}>Loading…</p>
        ) : shownFlags.length === 0 ? (
          <div style={{ marginTop: 28, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: '40px 24px', textAlign: 'center' }}>
            <CheckCircle size={30} color={GOLD} style={{ margin: '0 auto 10px' }} />
            <p style={{ color: INK, fontWeight: 700, margin: 0 }}>Queue is clear</p>
            <p style={{ color: MUTED, fontSize: 13, margin: '6px 0 0' }}>No open flags in this range. The scanner runs on a schedule and will surface anything new here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 22 }}>
            {shownFlags.map((f: any) => {
              const isOpen = open[f.id]
              return (
                <div key={f.id} className="adminx-rise" style={{ background: '#fff', border: `1px solid ${f.risk === 'high' ? 'rgba(220,38,38,.35)' : BORDER}`, borderRadius: 16, padding: '18px 20px' }}>
                  {/* header row */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: riskColor(f.risk), color: '#fff', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, padding: '4px 10px', borderRadius: 999 }}>
                        <AlertTriangle size={12} /> {f.risk} risk
                      </span>
                      <span style={{ fontWeight: 700, color: INK, fontSize: 14 }}>
                        {f.participant_1.name} <span style={{ color: MUTED, fontWeight: 500 }}>({f.participant_1.role})</span>
                        <span style={{ color: MUTED, fontWeight: 500 }}> ↔ </span>
                        {f.participant_2.name} <span style={{ color: MUTED, fontWeight: 500 }}>({f.participant_2.role})</span>
                      </span>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: MUTED, fontSize: 12 }}>
                      <Clock size={12} /> scanned {f.last_scanned_at ? fmtTime(f.last_scanned_at) : '—'}
                    </span>
                  </div>

                  {/* signals */}
                  {f.signals?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                      {f.signals.map(s => (
                        <span key={s} style={{ background: CREAM, color: '#8A6D1E', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8 }}>{SIGNAL_LABEL[s] || s}</span>
                      ))}
                    </div>
                  )}

                  {/* reasons */}
                  {f.reasons?.length > 0 && (
                    <ul style={{ margin: '12px 0 0', paddingLeft: 18, color: INK, fontSize: 13.5, lineHeight: 1.6 }}>
                      {f.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  )}

                  {/* evidence */}
                  {f.evidence?.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {f.evidence.map((e, i) => (
                        <div key={i} style={{ borderLeft: `3px solid ${riskColor(f.risk)}`, background: '#FBF8F0', padding: '6px 10px', borderRadius: 6, color: '#5A5A5A', fontSize: 13, fontStyle: 'italic' }}>“{e}”</div>
                      ))}
                    </div>
                  )}

                  {/* transcript toggle */}
                  <button onClick={() => setOpen(o => ({ ...o, [f.id]: !o[f.id] }))}
                    style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${BORDER}`, color: INK, fontWeight: 700, fontSize: 12.5, padding: '6px 12px', borderRadius: 9, cursor: 'pointer' }}>
                    <MessageSquareWarning size={13} /> {isOpen ? 'Hide' : 'Show'} recent messages ({f.message_count})
                  </button>

                  {isOpen && (
                    <div style={{ marginTop: 12, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, background: '#FCFAF5', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                      {f.messages.length === 0 ? <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>No messages available.</p> :
                        f.messages.map((m, i) => (
                          <div key={i} style={{ fontSize: 13 }}>
                            <span style={{ fontWeight: 700, color: INK }}>{m.sender}</span>
                            <span style={{ color: MUTED, fontSize: 11 }}> · {m.senderRole} · {fmtTime(m.created_at)}</span>
                            <div style={{ color: '#3A3A3A', marginTop: 2, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* notes + actions */}
                  <textarea value={notes[f.id] || ''} onChange={e => setNotes(n => ({ ...n, [f.id]: e.target.value }))}
                    placeholder="Optional note (what you decided / action taken)…"
                    rows={2} style={{ width: '100%', marginTop: 14, padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, outline: 'none', resize: 'vertical', color: INK }} />

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                    <button onClick={() => act(f, 'review')} disabled={!!busy}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg,#166534,#C9A227)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 13, padding: '9px 16px', borderRadius: 10, cursor: 'pointer', opacity: busy ? .6 : 1 }}>
                      <CheckCircle size={15} /> {busy === f.id + 'review' ? 'Saving…' : 'Mark reviewed'}
                    </button>
                    <button onClick={() => act(f, 'dismiss')} disabled={!!busy}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', color: MUTED, border: `1px solid ${BORDER}`, fontWeight: 800, fontSize: 13, padding: '9px 16px', borderRadius: 10, cursor: 'pointer', opacity: busy ? .6 : 1 }}>
                      <XCircle size={15} /> {busy === f.id + 'dismiss' ? 'Saving…' : 'Dismiss (benign)'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )) })()}
      </div>
    </AdminLayout>
  )
}
