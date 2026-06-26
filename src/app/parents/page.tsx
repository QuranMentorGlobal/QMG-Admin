// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/parents/page.tsx
// Parents — every parent account, their linked children, pending link requests
// and lessons booked. Search + date range. Click a parent to see their children.
// Mobile view centers content.
// ============================================================
'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import RangeTabs, { withinRange } from '@/components/RangeTabs'
import { Search, Users, UserPlus, Link2, ChevronDown, GraduationCap, Clock } from 'lucide-react'

const GOLD = '#C9A227', INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F8F5EE', GREEN = '#166534'

type Child = { id: string; name: string; email: string; lessons: number }
type Parent = {
  id: string; name: string; email: string; country: string; avatar_url: string | null
  created_at: string; childCount: number; pendingRequests: number; lessons: number; children: Child[]
}

function initials(name: string) {
  return (name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'
}
function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ParentsPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [parents, setParents] = useState<Parent[]>([])
  const [totals, setTotals] = useState<{ parents: number; linkedChildren: number; pendingRequests: number }>({ parents: 0, linkedChildren: 0, pendingRequests: 0 })
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [range, setRange] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [open, setOpen] = useState<string | null>(null)

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
      const res = await fetch('/api/parents'); const d = await res.json()
      if (res.ok) { setParents(d.parents || []); setTotals(d.totals || { parents: 0, linkedChildren: 0, pendingRequests: 0 }) }
    } catch {}
    setLoading(false)
  }

  const filtered = useMemo(() => {
    let rows = withinRange(parents, range, r => r.created_at, from, to)
    const term = q.trim().toLowerCase()
    if (term) rows = rows.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.email.toLowerCase().includes(term) ||
      p.children.some(c => c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term)))
    return rows
  }, [parents, range, from, to, q])

  return (
    <AdminLayout adminName={adminName}>
      <style>{`
        @media(max-width:640px){
          .pa-card-main{flex-direction:column;text-align:center}
          .pa-meta{justify-content:center}
          .pa-section-head{justify-content:center;text-align:center}
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: INK, fontFamily: 'var(--ff)', margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
          <Users size={20} color={GOLD} /> Parents
        </h1>
        <p style={{ fontSize: 13, color: MUTED, margin: '3px 0 0' }}>Parent accounts, their linked children and pending link requests.</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Parents', value: totals.parents, icon: Users, color: INK },
          { label: 'Linked Children', value: totals.linkedChildren, icon: GraduationCap, color: GREEN },
          { label: 'Pending Link Requests', value: totals.pendingRequests, icon: UserPlus, color: GOLD },
        ].map(c => {
          const IC = c.icon
          return (
            <div key={c.label} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: MUTED, fontSize: 12, fontWeight: 600 }}>
                <IC size={14} color={c.color} /> {c.label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: INK, marginTop: 4, fontFamily: 'var(--ff)' }}>{c.value}</div>
            </div>
          )
        })}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 380 }}>
          <Search size={16} color={MUTED} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search parent or child…"
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 11, border: `1px solid ${BORDER}`, fontSize: 13, color: INK, background: '#fff', outline: 'none' }} />
        </div>
        <RangeTabs value={range} onChange={setRange} from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: MUTED, fontSize: 13 }}>Loading parents…</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
            <Users size={26} color={MUTED} style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: 0 }}>No parents found</p>
            <p style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>{q ? 'Try a different search.' : 'Parent accounts will appear here once people register as parents.'}</p>
          </div>
        ) : filtered.map(p => {
          const expanded = open === p.id
          return (
            <div key={p.id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
              <button onClick={() => setOpen(expanded ? null : p.id)}
                className="pa-card-main"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 42, height: 42, borderRadius: '50%', background: CREAM, color: GOLD, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0, overflow: 'hidden' }}>
                  {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(p.name)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, color: INK, fontSize: 14.5 }}>{p.name}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}{p.country ? ` · ${p.country}` : ''}</span>
                </span>
                <span className="pa-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: 'rgba(22,101,52,0.10)', color: GREEN }}>
                    <GraduationCap size={13} /> {p.childCount}
                  </span>
                  {p.pendingRequests > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: 'rgba(201,162,39,0.14)', color: '#8A6A16' }}>
                      <Link2 size={13} /> {p.pendingRequests}
                    </span>
                  )}
                  <ChevronDown size={17} color={MUTED} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                </span>
              </button>

              {expanded && (
                <div style={{ borderTop: `1px solid ${BORDER}`, background: CREAM, padding: '12px 16px' }}>
                  <div className="pa-section-head" style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: MUTED, marginBottom: 10 }}>
                    <span>Joined {fmtDate(p.created_at)}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={12} /> {p.lessons} lessons across children</span>
                  </div>
                  {p.children.length === 0 ? (
                    <p style={{ fontSize: 12.5, color: MUTED, margin: 0 }}>No children linked yet.{p.pendingRequests > 0 ? ` ${p.pendingRequests} request(s) pending.` : ''}</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {p.children.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 11, padding: '9px 12px' }}>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: INK }}>{c.name}</span>
                            {c.email && <span style={{ display: 'block', fontSize: 11.5, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</span>}
                          </span>
                          <span style={{ fontSize: 12, color: MUTED, fontWeight: 700, flexShrink: 0 }}>{c.lessons} lessons</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!loading && filtered.length > 0 && (
        <p style={{ fontSize: 11.5, color: MUTED, marginTop: 12, textAlign: 'center' }}>Showing {filtered.length} of {parents.length} parents.</p>
      )}
    </AdminLayout>
  )
}
