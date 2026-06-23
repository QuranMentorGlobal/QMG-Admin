// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/audit-log/page.tsx
// Audit Log viewer — who did what, when. Reads /api/audit-log (guarded).
// ============================================================
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { Search, ShieldCheck } from 'lucide-react'

const GOLD = '#C9A227', INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F8F5EE'

type Log = { id: string; actor_name: string; action: string; target_type: string | null; target_id: string | null; details: any; created_at: string }

const ACTION_LABEL: Record<string, string> = {
  'sub_admin.create': 'Created sub-admin', 'sub_admin.update': 'Updated sub-admin',
  'sub_admin.suspend': 'Suspended sub-admin', 'sub_admin.activate': 'Activated sub-admin', 'sub_admin.delete': 'Deleted sub-admin',
  'teacher.approve': 'Approved teacher', 'teacher.reject': 'Rejected teacher',
  'teacher.suspend': 'Suspended teacher', 'teacher.reinstate': 'Reinstated teacher',
  'student.activate': 'Activated student', 'student.deactivate': 'Deactivated student',
  'review.publish': 'Published review', 'review.unpublish': 'Unpublished review',
  'settings.update': 'Updated settings', 'ticket.update': 'Updated support ticket',
}
function label(a: string) {
  if (ACTION_LABEL[a]) return ACTION_LABEL[a]
  if (a.startsWith('verification.')) return 'Verification: ' + a.split('.').slice(1).join(' ')
  return a
}
function fmt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function AuditLogPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const sb = createClient(); const { data: { user } } = await sb.auth.getUser()
        if (user) { const { data: p } = await sb.from('profiles').select('first_name').eq('id', user.id).single(); setAdminName((p as any)?.first_name || 'Admin') }
      } catch {}
    })()
  }, [])

  useEffect(() => {
    const t = setTimeout(load, q ? 350 : 0)
    return () => clearTimeout(t)
  }, [q])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/audit-log${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      const d = await res.json(); if (res.ok) setLogs(d.logs || [])
    } catch {}
    setLoading(false)
  }

  return (
    <AdminLayout adminName={adminName}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 800, color: INK, margin: 0 }}>Audit Log</h1>
        <p style={{ fontSize: 13, color: '#6B6B6B', margin: '5px 0 0' }}>Every administrative action — who did it and when.</p>
      </div>

      <div style={{ position: 'relative', maxWidth: 380, marginBottom: 14 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: MUTED }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search action, admin or target…"
          style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 11, border: `1px solid ${BORDER}`, fontSize: 13, background: '#fff', color: INK }} />
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>Loading…</div>
          : logs.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <ShieldCheck size={28} style={{ color: GOLD }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: '10px 0 4px' }}>No audit entries yet</p>
              <p style={{ fontSize: 12.5, color: MUTED, margin: 0 }}>Admin actions will appear here as they happen.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', background: '#FBF8F1' }}>
                    <th style={{ padding: '11px 16px' }}>When</th><th style={{ padding: '11px 16px' }}>Admin</th>
                    <th style={{ padding: '11px 16px' }}>Action</th><th style={{ padding: '11px 16px' }}>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '11px 16px', color: '#555', whiteSpace: 'nowrap' }}>{fmt(l.created_at)}</td>
                      <td style={{ padding: '11px 16px', fontWeight: 600, color: INK }}>{l.actor_name || '—'}</td>
                      <td style={{ padding: '11px 16px' }}><span style={{ fontSize: 11.5, fontWeight: 700, color: GOLD, background: CREAM, padding: '3px 9px', borderRadius: 8 }}>{label(l.action)}</span></td>
                      <td style={{ padding: '11px 16px', color: MUTED }}>{l.target_type ? `${l.target_type}${l.target_id ? ` · ${String(l.target_id).slice(0, 8)}` : ''}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </AdminLayout>
  )
}
