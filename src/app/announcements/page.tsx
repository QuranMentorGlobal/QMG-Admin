// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/announcements/page.tsx
// System Announcements — broadcast an in-app notification to a target role.
// In-app only (appears in every recipient's bell + notifications page).
// ============================================================
'use client'
import { useEffect, useState } from 'react'
import PageHead from '@/components/PageHead'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { Megaphone, Users, GraduationCap, UserCog, Send, LinkIcon } from 'lucide-react'

const GOLD = '#C9A227', INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F8F5EE'

type Counts = { all: number; student: number; teacher: number; parent: number }
type Recent = { title: string; body: string; href: string | null; created_at: string }

const AUDIENCES: { key: keyof Counts; label: string; icon: any }[] = [
  { key: 'all',     label: 'Everyone', icon: Users },
  { key: 'student', label: 'Students', icon: GraduationCap },
  { key: 'teacher', label: 'Teachers', icon: UserCog },
  { key: 'parent',  label: 'Parents',  icon: Users },
]

function fmt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function AnnouncementsPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [counts, setCounts] = useState<Counts>({ all: 0, student: 0, teacher: 0, parent: 0 })
  const [recent, setRecent] = useState<Recent[]>([])
  const [loading, setLoading] = useState(true)
  const [audience, setAudience] = useState<keyof Counts>('all')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [href, setHref] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

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
    try {
      const res = await fetch('/api/announcements')
      const d = await res.json()
      if (res.ok) { setCounts(d.counts || counts); setRecent(d.recent || []) }
    } catch {}
    setLoading(false)
  }

  const reach = counts[audience] || 0
  const ready = title.trim().length > 0 && message.trim().length > 0

  async function send() {
    setSending(true); setToast(null)
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: message.trim(), href: href.trim() || null, audience }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to send')
      setToast(`Announcement sent to ${d.sent} ${audience === 'all' ? 'people' : audience + 's'}.`)
      setTitle(''); setMessage(''); setHref(''); setConfirming(false)
      load()
    } catch (e: any) {
      setToast(e.message || 'Could not send announcement.')
    }
    setSending(false)
    setTimeout(() => setToast(null), 5000)
  }

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: MUTED, marginBottom: 6 }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 11, border: `1px solid ${BORDER}`, fontSize: 14, color: INK, background: '#fff', outline: 'none' }

  return (
    <AdminLayout adminName={adminName}>
      <PageHead
        title="System Announcements"
        subtitle="Broadcast an in-app notification to everyone in a chosen audience. It appears in their bell and notifications page."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16 }}>
        {/* Composer */}
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 22 }}>
          {/* Audience */}
          <label style={labelStyle}>Audience</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {AUDIENCES.map(a => {
              const IC = a.icon; const on = audience === a.key
              return (
                <button key={a.key} onClick={() => setAudience(a.key)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 11, cursor: 'pointer',
                  border: on ? '1.5px solid transparent' : `1.5px solid ${BORDER}`, fontSize: 13, fontWeight: 700,
                  background: on ? 'linear-gradient(135deg,#166534,#C9A227)' : '#fff', color: on ? '#fff' : '#6B6B6B',
                }}>
                  <IC size={15} /> {a.label}
                  <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, marginLeft: 2, padding: '1px 7px', borderRadius: 99, background: on ? 'rgba(255,255,255,0.22)' : CREAM }}>{counts[a.key] ?? 0}</span>
                </button>
              )
            })}
          </div>

          <label style={labelStyle}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Scheduled maintenance this weekend" style={{ ...inputStyle, marginBottom: 16 }} />

          <label style={labelStyle}>Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} maxLength={500}
            placeholder="Write the announcement your audience will see…"
            style={{ ...inputStyle, resize: 'vertical', marginBottom: 4 }} />
          <p style={{ fontSize: 11, color: MUTED, textAlign: 'right', margin: '0 0 16px' }}>{message.length}/500</p>

          <label style={labelStyle}><LinkIcon size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />Link (optional)</label>
          <input value={href} onChange={e => setHref(e.target.value)} placeholder="/platform/student/courses" style={{ ...inputStyle, marginBottom: 20 }} />

          {!confirming ? (
            <button onClick={() => setConfirming(true)} disabled={!ready}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 12, border: 'none', cursor: ready ? 'pointer' : 'default', fontSize: 14, fontWeight: 700, color: '#fff', background: ready ? 'linear-gradient(135deg,#166534,#C9A227)' : '#C9C3B5' }}>
              <Send size={15} /> Review &amp; send
            </button>
          ) : (
            <div style={{ background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
              <p style={{ fontSize: 13.5, color: INK, fontWeight: 700, margin: '0 0 4px' }}>
                Send to {reach} {audience === 'all' ? 'people' : audience + 's'}?
              </p>
              <p style={{ fontSize: 12.5, color: MUTED, margin: '0 0 14px' }}>This will appear in every recipient&apos;s notifications immediately and cannot be recalled.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={send} disabled={sending}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#166534,#C9A227)', opacity: sending ? 0.6 : 1 }}>
                  <Send size={14} /> {sending ? 'Sending…' : `Send to ${reach}`}
                </button>
                <button onClick={() => setConfirming(false)} disabled={sending}
                  style={{ padding: '10px 18px', borderRadius: 11, border: `1px solid ${BORDER}`, background: '#fff', fontSize: 13.5, fontWeight: 700, color: '#6B6B6B', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recent */}
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 22 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: INK, margin: '0 0 12px' }}>Recent announcements</p>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[1, 2, 3].map(i => <div key={i} style={{ height: 46, borderRadius: 10, background: '#EFEADD' }} className="animate-pulse" />)}</div>
          ) : recent.length === 0 ? (
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>No announcements sent yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recent.map((r, i) => (
                <div key={i} style={{ borderLeft: `3px solid ${GOLD}`, paddingLeft: 12 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: INK, margin: 0 }}>{r.title}</p>
                  <p style={{ fontSize: 12.5, color: '#6B6B6B', margin: '2px 0 0' }}>{r.body}</p>
                  <p style={{ fontSize: 11, color: MUTED, margin: '4px 0 0' }}>{fmt(r.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize: 11.5, color: MUTED, marginTop: 14 }}>
        Announcements are delivered in-app only. For bulk marketing email with unsubscribe handling, use Resend Broadcasts — per-event marketing email remains controlled by each user&apos;s notification preferences.
      </p>

      {toast && (
        <div style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 60, background: INK, color: '#fff', padding: '12px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', maxWidth: 380 }}>{toast}</div>
      )}
    </AdminLayout>
  )
}
