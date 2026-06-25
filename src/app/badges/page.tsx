// PASTE THIS WHOLE FILE INTO:  src/app/badges/page.tsx
// Badge Management — search a user, view/assign/remove their badges, see history,
// tune thresholds, and run the platform-wide backfill. Reads /api/badges.
'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { Award, Search, Plus, X, History, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { TEACHER_BADGES, STUDENT_BADGES, PARENT_BADGES, BADGE_BY_KEY, type BadgeDef } from '@/lib/badges'
import RangeTabs, { withinRange } from '@/components/RangeTabs'
import SearchBar from '@/components/SearchBar'

const GOLD = '#C9A227', INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F8F5EE', GREEN = '#16A34A', RED = '#DC2626'

type U = { id: string; first_name: string; last_name: string; email: string; role: string }
type UB = { badge_key: string; source: string; reason: string | null; created_at: string }
type H = { badge_key: string; action: string; source: string; actor_name: string | null; reason: string | null; created_at: string }
type LedgerRow = { id: string; userId: string; name: string; email: string; role: string; badgeKey: string; badgeName: string; source: string; reason: string | null; actorName: string | null; createdAt: string | null }

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }

export default function BadgeManagementPage() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<U[]>([])
  const [user, setUser] = useState<U | null>(null)
  const [badges, setBadges] = useState<UB[]>([])
  const [history, setHistory] = useState<H[]>([])
  const [tab, setTab] = useState<'badges' | 'history' | 'thresholds'>('badges')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [config, setConfig] = useState<Record<string, any>>({})

  // Ledger (transaction view of all badge grants)
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<'all' | 'teacher' | 'student' | 'parent'>('all')
  const [range, setRange] = useState('30')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [ledgerSearch, setLedgerSearch] = useState('')

  const note = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  async function search() {
    if (q.trim().length < 2) return
    const r = await fetch(`/api/badges?search=${encodeURIComponent(q.trim())}`)
    const j = await r.json(); setResults(j.users || [])
  }
  async function loadUser(u: U) {
    setUser(u); setResults([]); setQ(`${u.first_name} ${u.last_name}`)
    const r = await fetch(`/api/badges?userId=${u.id}`)
    const j = await r.json(); setBadges(j.badges || []); setHistory(j.history || [])
  }
  async function loadConfig() {
    const r = await fetch('/api/badges?config=1'); const j = await r.json()
    const map: Record<string, any> = {}; (j.config || []).forEach((c: any) => { map[c.badge_key] = c.overrides }); setConfig(map)
  }
  async function loadLedger() {
    setLedgerLoading(true)
    try {
      const r = await fetch('/api/badges?ledger=1')
      const t = await r.text(); const j = t ? JSON.parse(t) : {}
      setLedger(j.ledger || [])
    } catch {}
    setLedgerLoading(false)
  }
  useEffect(() => { loadConfig(); loadLedger() }, [])

  async function act(action: string, payload: any) {
    setBusy(true)
    try {
      const r = await fetch('/api/badges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) })
      const t = await r.text(); const j = t ? JSON.parse(t) : {}
      if (!r.ok) throw new Error(j.error || 'Failed')
      return j
    } finally { setBusy(false) }
  }

  async function assign(badgeKey: string) {
    if (!user) return
    const reason = prompt('Reason for awarding this badge?') || 'Manually assigned'
    try { await act('assign', { userId: user.id, badgeKey, reason }); note('Badge assigned'); loadUser(user); loadLedger() }
    catch (e: any) { note(e.message) }
  }
  async function remove(badgeKey: string) {
    if (!user || !confirm(`Remove "${BADGE_BY_KEY[badgeKey]?.name || badgeKey}"?`)) return
    const reason = prompt('Reason for removing?') || 'Removed by admin'
    try { await act('remove', { userId: user.id, badgeKey, reason }); note('Badge removed'); loadUser(user); loadLedger() }
    catch (e: any) { note(e.message) }
  }
  async function recompute() {
    if (!user) return
    try { const j = await act('recompute', { userId: user.id }); note(`Recomputed — awarded ${j.awarded?.length || 0}, revoked ${j.revoked?.length || 0}`); loadUser(user); loadLedger() }
    catch (e: any) { note(e.message) }
  }
  async function backfill() {
    if (!confirm('Re-evaluate badges for ALL approved teachers and active students? This runs the engine across the platform.')) return
    try { const j = await act('backfill', {}); note(`Backfill done — ${j.backfilled?.teachers || 0} teachers, ${j.backfilled?.students || 0} students`); loadLedger() }
    catch (e: any) { note(e.message) }
  }
  async function saveThreshold(b: BadgeDef, overrides: Record<string, number>) {
    try { await act('config', { badgeKey: b.key, overrides }); note('Threshold saved'); loadConfig() }
    catch (e: any) { note(e.message) }
  }

  const activeKeys = new Set(badges.map(b => b.badge_key))
  const audience = user?.role === 'teacher' ? 'teacher' : user?.role === 'parent' ? 'parent' : 'student'
  const catalog = audience === 'teacher' ? TEACHER_BADGES : audience === 'parent' ? PARENT_BADGES : STUDENT_BADGES

  const filteredLedger = (() => {
    let rows = ledger
    if (roleFilter !== 'all') rows = rows.filter(r => r.role === roleFilter)
    rows = withinRange(rows, range, r => r.createdAt, from, to)
    const ql = ledgerSearch.trim().toLowerCase()
    if (ql) rows = rows.filter(r => `${r.name} ${r.email} ${r.badgeName}`.toLowerCase().includes(ql))
    return rows
  })()
  const ledgerCounts = { total: filteredLedger.length, auto: filteredLedger.filter(r => r.source === 'auto').length, manual: filteredLedger.filter(r => r.source === 'manual').length }
  const ROLE_TABS: { k: 'all' | 'teacher' | 'student' | 'parent'; label: string }[] = [
    { k: 'all', label: 'All' }, { k: 'teacher', label: 'Teachers' }, { k: 'student', label: 'Students' }, { k: 'parent', label: 'Parents' },
  ]

  return (
    <AdminLayout>
      <div style={{ maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Award size={22} style={{ color: GOLD }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: INK, margin: 0, fontFamily: "'Fraunces',serif" }}>Badge Management</h1>
        </div>
        <p style={{ color: MUTED, fontSize: 13, margin: '0 0 18px' }}>Search a user to view, assign, or remove badges. All auto-badges sync from the engine; manual grants are preserved.</p>

        {/* Search + backfill */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: MUTED }} />
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Search teacher or student by name or email…"
              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 14 }} />
            {results.length > 0 && (
              <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                {results.map(u => (
                  <button key={u.id} onClick={() => loadUser(u)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'none', border: 'none', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 14, color: INK, fontWeight: 600 }}>{u.first_name} {u.last_name} <span style={{ color: MUTED, fontWeight: 400 }}>· {u.email}</span></span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: u.role === 'teacher' ? GOLD : GREEN, textTransform: 'uppercase' }}>{u.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={search} style={{ padding: '10px 18px', borderRadius: 12, background: 'linear-gradient(135deg,#166534,#C9A227)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Search</button>
          <button onClick={backfill} disabled={busy} style={{ padding: '10px 16px', borderRadius: 12, background: '#fff', color: INK, border: `1px solid ${BORDER}`, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={15} /> Backfill all
          </button>
        </div>

        {!user ? (
          <div>
            {/* Filters: role tabs + range + search */}
            <div className="qmg-badge-filters" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ROLE_TABS.map(rt => {
                  const on = roleFilter === rt.k
                  const n = rt.k === 'all' ? ledger.length : ledger.filter(r => r.role === rt.k).length
                  return (
                    <button key={rt.k} onClick={() => setRoleFilter(rt.k)} style={{ padding: '7px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: on ? 'none' : `1px solid ${BORDER}`, background: on ? 'linear-gradient(135deg,#166534,#C9A227)' : '#fff', color: on ? '#fff' : '#6B6B6B' }}>
                      {rt.label} · {n}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <SearchBar value={ledgerSearch} onChange={setLedgerSearch} placeholder="Search person or badge…" width={260} />
                <RangeTabs value={range} onChange={setRange} from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
              </div>
            </div>

            {/* Summary chips */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              {[
                { label: 'Total grants', value: ledgerCounts.total, color: GOLD },
                { label: 'Auto-awarded', value: ledgerCounts.auto, color: GREEN },
                { label: 'Manually assigned', value: ledgerCounts.manual, color: '#6366F1' },
              ].map(s => (
                <div key={s.label} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 16px', minWidth: 130 }}>
                  <p style={{ fontSize: 20, fontWeight: 800, color: s.color, margin: 0, fontFamily: "'Fraunces',serif" }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: MUTED, margin: '2px 0 0', fontWeight: 600 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Ledger table */}
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
              <div className="badge-led-head" style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 1.4fr 0.8fr 1.4fr 1fr', gap: 8, padding: '11px 18px', background: CREAM, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                <span>Person</span><span>Role</span><span>Badge</span><span>Type</span><span>Awarded by / reason</span><span>Date</span>
              </div>
              {ledgerLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: MUTED, fontSize: 13 }}>Loading badge activity…</div>
              ) : filteredLedger.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center' }}>
                  <Award size={30} style={{ color: 'rgba(201,162,39,0.4)' }} />
                  <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: '10px 0 4px' }}>No badge grants in this view</p>
                  <p style={{ fontSize: 12.5, color: MUTED, margin: 0 }}>Try a wider date range or a different role.</p>
                </div>
              ) : filteredLedger.map((r, i) => (
                <div key={r.id} className="badge-led-row" style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 1.4fr 0.8fr 1.4fr 1fr', gap: 8, padding: '12px 18px', borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`, alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <button onClick={() => loadUser({ id: r.userId, first_name: r.name.split(' ')[0] || '', last_name: r.name.split(' ').slice(1).join(' '), email: r.email, role: r.role } as U)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', maxWidth: '100%' }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                      {r.email && <span style={{ display: 'block', fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</span>}
                    </button>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: r.role === 'teacher' ? GOLD : r.role === 'parent' ? '#6366F1' : GREEN }} className="badge-led-cell">{r.role}</span>
                  <span style={{ fontSize: 13, color: INK }} className="badge-led-cell">{r.badgeName}</span>
                  <span className="badge-led-cell">
                    <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', padding: '3px 9px', borderRadius: 20, background: r.source === 'manual' ? 'rgba(99,102,241,0.1)' : 'rgba(22,163,74,0.1)', color: r.source === 'manual' ? '#6366F1' : GREEN }}>{r.source === 'manual' ? 'Manual' : 'Auto'}</span>
                  </span>
                  <span style={{ fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="badge-led-cell">{r.source === 'manual' ? (r.actorName || 'Admin') : 'Badge engine'}{r.reason ? ` · ${r.reason}` : ''}</span>
                  <span style={{ fontSize: 12, color: MUTED }} className="badge-led-cell">{r.createdAt ? fmtDate(r.createdAt) : '—'}</span>
                </div>
              ))}
            </div>
            <style>{`@media (max-width:760px){ .badge-led-head{ display:none !important; } .badge-led-row{ grid-template-columns: 1fr 1fr !important; } .badge-led-row > div:first-child{ grid-column:1 / -1; } }`}</style>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <p style={{ fontWeight: 800, color: INK, margin: 0, fontSize: 16 }}>{user.first_name} {user.last_name}</p>
                <p style={{ color: MUTED, fontSize: 12, margin: '2px 0 0' }}>{user.email} · <span style={{ color: audience === 'teacher' ? GOLD : GREEN, fontWeight: 700, textTransform: 'uppercase' }}>{user.role}</span></p>
              </div>
              <button onClick={recompute} disabled={busy} style={{ padding: '8px 14px', borderRadius: 10, background: CREAM, color: GOLD, border: `1px solid ${GOLD}55`, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={14} /> Recompute
              </button>
              <button onClick={() => { setUser(null); setQ(''); setResults([]) }} style={{ padding: '8px 14px', borderRadius: 10, background: '#fff', color: INK, border: `1px solid ${BORDER}`, fontWeight: 700, cursor: 'pointer' }}>← All badges</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, padding: '10px 16px', borderBottom: `1px solid ${BORDER}` }}>
              {([['badges', 'Badges', Award], ['history', 'History', History], ['thresholds', 'Thresholds', SlidersHorizontal]] as const).map(([k, lbl, Ic]) => (
                <button key={k} onClick={() => setTab(k)} style={{ padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, background: tab === k ? 'linear-gradient(135deg,#166534,#C9A227)' : 'transparent', color: tab === k ? '#111111' : MUTED }}>
                  <Ic size={14} /> {lbl}
                </button>
              ))}
            </div>

            <div style={{ padding: 20 }}>
              {tab === 'badges' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
                  {catalog.map(b => {
                    const has = activeKeys.has(b.key)
                    const src = badges.find(x => x.badge_key === b.key)?.source
                    return (
                      <div key={b.key} style={{ border: `1px solid ${has ? GOLD + '55' : BORDER}`, borderRadius: 12, padding: 14, background: has ? CREAM : '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div>
                            <p style={{ fontWeight: 700, color: INK, margin: 0, fontSize: 14 }}>{b.name}</p>
                            <p style={{ color: MUTED, fontSize: 11, margin: '2px 0 0', lineHeight: 1.4 }}>{b.description}</p>
                          </div>
                          {has
                            ? <button onClick={() => remove(b.key)} disabled={busy} title="Remove" style={{ background: 'rgba(220,38,38,0.08)', color: RED, border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', flexShrink: 0 }}><X size={15} /></button>
                            : <button onClick={() => assign(b.key)} disabled={busy} title="Assign" style={{ background: 'rgba(201,162,39,0.1)', color: GOLD, border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', flexShrink: 0 }}><Plus size={15} /></button>}
                        </div>
                        {has && <span style={{ display: 'inline-block', marginTop: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, background: src === 'manual' ? 'rgba(99,102,241,0.1)' : 'rgba(22,163,74,0.1)', color: src === 'manual' ? '#6366F1' : GREEN }}>{src === 'manual' ? 'Manual' : 'Auto'}</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {tab === 'history' && (
                history.length === 0 ? <p style={{ color: MUTED, fontSize: 13 }}>No badge history yet.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {history.map((h, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10 }}>
                        <div>
                          <span style={{ fontWeight: 700, color: INK, fontSize: 13 }}>{BADGE_BY_KEY[h.badge_key]?.name || h.badge_key}</span>
                          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: h.action === 'revoked' ? RED : GREEN, textTransform: 'uppercase' }}>{h.action}</span>
                          <span style={{ marginLeft: 8, fontSize: 11, color: MUTED }}>· {h.source}{h.actor_name ? ` · ${h.actor_name}` : ''}</span>
                          {h.reason && <p style={{ fontSize: 11, color: MUTED, margin: '3px 0 0' }}>{h.reason}</p>}
                        </div>
                        <span style={{ fontSize: 11, color: MUTED, flexShrink: 0 }}>{fmtDate(h.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'thresholds' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ color: MUTED, fontSize: 12, margin: 0 }}>Override the default thresholds for auto-badges. Leave blank to use the code default. Changes apply on the next recompute/backfill.</p>
                  {catalog.filter(b => Object.keys(b.criteria).length > 0).map(b => (
                    <ThresholdRow key={b.key} def={b} current={config[b.key] || {}} onSave={ov => saveThreshold(b, ov)} busy={busy} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, background: INK, color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 100 }}>{toast}</div>}
      <style>{`@media(max-width:640px){ .qmg-badge-filters{justify-content:center!important} .qmg-badge-filters>div{justify-content:center!important} }`}</style>
      </div>
    </AdminLayout>
  )
}

function ThresholdRow({ def, current, onSave, busy }: { def: BadgeDef; current: Record<string, number>; onSave: (ov: Record<string, number>) => void; busy: boolean }) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    Object.keys(def.criteria).forEach(k => { o[k] = String(current[k] ?? def.criteria[k]) })
    return o
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 700, color: INK, fontSize: 13, minWidth: 150 }}>{def.name}</span>
      <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
        {Object.keys(def.criteria).map(k => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED }}>
            {k}
            <input type="number" value={vals[k]} onChange={e => setVals({ ...vals, [k]: e.target.value })}
              style={{ width: 80, padding: '5px 8px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13 }} />
          </label>
        ))}
      </div>
      <button onClick={() => onSave(Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, Number(v)])))} disabled={busy}
        style={{ padding: '6px 14px', borderRadius: 9, background: 'linear-gradient(135deg,#166534,#C9A227)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Save</button>
    </div>
  )
}
