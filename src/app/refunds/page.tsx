// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/refunds/page.tsx
// Refunds & Cancellations — finance/trust view over the `refunds` ledger.
// Totals, who-initiated breakdown, 12-month trend, top reasons, recent table.
// Reads /api/refunds (service-role aggregate). Read-only by design.
// ============================================================
'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import {
  RotateCcw, DollarSign, CalendarClock, Users, GraduationCap, Search, Download, MessageSquareWarning,
} from 'lucide-react'

const GOLD = '#B8952A', INK = '#1A1A1A'
const GRID = '#EDE6D6', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F7F1E2', GREEN = '#16A34A', RED = '#DC2626', INDIGO = '#6366F1'

function money(n: number) { if (Math.abs(n) >= 1_000_000) return '$' + (n / 1e6).toFixed(1) + 'M'; if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(1) + 'k'; return '$' + Math.round(n).toLocaleString() }
function full(n: number) { return '$' + (Number(n) || 0).toFixed(2) }
function monthLabel(m: string) { const [y, mo] = m.split('-'); return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(undefined, { month: 'short' }) }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }

const INITIATOR: Record<string, { bg: string; color: string; label: string }> = {
  student: { bg: 'rgba(99,102,241,0.1)', color: INDIGO, label: 'Student cancelled' },
  teacher: { bg: 'rgba(184,149,42,0.12)', color: GOLD, label: 'Teacher declined' },
  admin: { bg: 'rgba(22,163,74,0.1)', color: GREEN, label: 'Admin' },
  system: { bg: '#F3F4F6', color: MUTED, label: 'System' },
}

function Kpi({ icon: Icon, label, value, accent, sub }: { icon: any; label: string; value: string; accent?: boolean; sub?: string }) {
  return (
    <div className="adminx-stat" style={{ background: '#fff', borderRadius: 16, padding: '16px 18px', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={15} style={{ color: GOLD }} /></div>
        <p style={{ fontSize: 11.5, color: MUTED, margin: 0, fontWeight: 600 }}>{label}</p>
      </div>
      <p style={{ fontSize: 23, fontWeight: 800, color: accent ? GOLD : INK, margin: 0, lineHeight: 1, fontFamily: "'Fraunces',serif" }}>{value}</p>
      {sub && <p style={{ fontSize: 10.5, color: MUTED, margin: '5px 0 0' }}>{sub}</p>}
    </div>
  )
}

function Panel({ title, icon: Icon, children, right }: { title: string; icon?: any; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="adminx-rise" style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: INK, margin: 0, fontFamily: "'Fraunces',serif" }}>{Icon && <Icon size={16} style={{ color: GOLD }} />}{title}</h2>
        {right}
      </div>
      {children}
    </div>
  )
}
function Skel({ h }: { h: number }) { return <div className="qmg-skel" style={{ width: '100%', height: h }} /> }

export default function AdminRefundsPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [d, setD] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    (async () => {
      try { const sb = createClient(); const { data: { user } } = await sb.auth.getUser(); if (user) { const { data: p } = await sb.from('profiles').select('first_name').eq('id', user.id).single(); setAdminName((p as any)?.first_name || 'Admin') } } catch {}
    })()
    fetch('/api/refunds').then(r => r.ok ? r.json() : null).then(j => { setD(j); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const t = d?.totals || { total: 0, count: 0, thisMonth: 0, students: 0, teachers: 0, admins: 0 }
  const byInitiator = d?.byInitiator || []
  const topReasons = d?.topReasons || []
  const trend = (d?.byMonth || []).map((x: any) => ({ ...x, label: monthLabel(x.m) }))
  const maxReason = Math.max(1, ...topReasons.map((r: any) => r.count))

  const recent = useMemo(() => {
    const q = search.toLowerCase()
    return (d?.recent || []).filter((p: any) => {
      if (filter !== 'all' && p.initiatedBy !== filter) return false
      if (q && !`${p.student} ${p.teacher} ${p.course} ${p.reason} ${p.provider}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [d, filter, search])

  function exportCSV() {
    if (!d) return
    const lines = ['Date,Student,Teacher,Course,Initiated By,Reason,Provider,Status,Amount']
    d.recent.forEach((p: any) => lines.push(`${fmtDate(p.createdAt)},"${p.student}","${p.teacher}","${p.course}",${p.initiatedBy},"${(p.reason || '').replace(/"/g, "'")}",${p.provider},${p.status},${p.amount}`))
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' }); const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `qmg-refunds-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  return (
    <AdminLayout adminName={adminName}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 800, color: INK, margin: 0 }}>Refunds &amp; Cancellations</h1>
          <p style={{ fontSize: 13, color: '#6B6B6B', margin: '5px 0 0' }}>Every refund issued when a paid booking is cancelled or declined.</p>
        </div>
        <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 11, border: 'none', cursor: 'pointer', background: GOLD, color: '#1A1400', fontSize: 12.5, fontWeight: 700 }}><Download size={14} /> Export CSV</button>
      </div>

      {d?.tableMissing && (
        <div style={{ background: 'rgba(184,149,42,0.08)', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 16px', marginBottom: 18, fontSize: 12.5, color: INK }}>
          The <strong>booking_refunds</strong> table isn&apos;t present yet. Run <code>migration_marketplace_integrity.sql</code> in Supabase — this view populates automatically once refunds start flowing.
        </div>
      )}

      {/* KPIs */}
      <div className="qmg-rf-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {loading ? [...Array(4)].map((_, i) => <Skel key={i} h={96} />) : <>
          <Kpi icon={DollarSign} label="Total Refunded" value={money(t.total)} accent sub={`${t.count} refunds`} />
          <Kpi icon={CalendarClock} label="This Month" value={money(t.thisMonth)} sub="Refunded this calendar month" />
          <Kpi icon={GraduationCap} label="Teacher Declines" value={String(t.teachers)} sub="Paid bookings declined by teachers" />
          <Kpi icon={Users} label="Student Cancellations" value={String(t.students)} sub="Paid bookings cancelled by students" />
        </>}
      </div>

      {/* Trend + initiator split */}
      <div className="qmg-rf-2" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, marginBottom: 18 }}>
        <Panel title="Refunds (12 months)" icon={RotateCcw}>
          {loading ? <Skel h={260} /> : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="rfArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={RED} stopOpacity={0.25} /><stop offset="100%" stopColor={RED} stopOpacity={0.02} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => '$' + (v >= 1000 ? (v / 1000) + 'k' : v)} />
                <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                <Area type="monotone" dataKey="amount" name="Refunded" stroke={RED} strokeWidth={2.5} fill="url(#rfArea)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel title="Who Initiated" icon={Users}>
          {loading ? <Skel h={260} /> : (byInitiator.length === 0 ? <p style={{ fontSize: 12.5, color: MUTED }}>No refunds yet.</p> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
              {byInitiator.map((x: any) => {
                const meta = INITIATOR[x.name] || INITIATOR.system
                const pct = t.total > 0 ? Math.round((x.amount / t.total) * 100) : 0
                return (
                  <div key={x.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                      <span style={{ color: INK, fontWeight: 600 }}>{meta.label} <span style={{ color: MUTED, fontWeight: 400 }}>· {x.count}</span></span>
                      <span style={{ color: meta.color, fontWeight: 700 }}>{money(x.amount)}</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 99, background: CREAM, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: meta.color, borderRadius: 99 }} /></div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Top reasons */}
      <div style={{ marginBottom: 18 }}>
        <Panel title="Top Cancellation Reasons" icon={MessageSquareWarning}>
          {loading ? <Skel h={160} /> : (topReasons.length === 0 ? <p style={{ fontSize: 12.5, color: MUTED }}>No data.</p> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topReasons.map((r: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ flex: '0 0 200px', fontSize: 12.5, color: INK, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.reason}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 99, background: CREAM, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.round((r.count / maxReason) * 100)}%`, background: 'linear-gradient(90deg,#C8A24A,#D4AF37)', borderRadius: 99 }} /></div>
                  <span style={{ flex: '0 0 32px', textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: GOLD }}>{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Recent refunds */}
      <Panel title="Recent Refunds" icon={RotateCcw} right={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 12, color: INK, background: '#fff', fontWeight: 600 }}>
            {['all', 'student', 'teacher', 'admin'].map(s => <option key={s} value={s}>{s === 'all' ? 'All sources' : s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
          <div style={{ position: 'relative' }}><Search size={14} style={{ position: 'absolute', left: 10, top: 8, color: MUTED }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ padding: '6px 10px 6px 30px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 12, color: INK, width: 160 }} /></div>
        </div>
      }>
        {loading ? <Skel h={200} /> : recent.length === 0 ? <p style={{ fontSize: 12.5, color: MUTED, padding: 16, textAlign: 'center' }}>No refunds match.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead><tr style={{ textAlign: 'left', color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', background: '#FBF8F1' }}>
                <th style={{ padding: '10px 14px' }}>Date</th><th style={{ padding: '10px 14px' }}>Student → Teacher</th><th style={{ padding: '10px 14px' }}>Course</th><th style={{ padding: '10px 14px' }}>Source</th><th style={{ padding: '10px 14px' }}>Reason</th><th style={{ padding: '10px 14px', textAlign: 'right' }}>Amount</th>
              </tr></thead>
              <tbody>
                {recent.map((p: any) => { const s = INITIATOR[p.initiatedBy] || INITIATOR.system; return (
                  <tr key={p.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '10px 14px', color: '#555', whiteSpace: 'nowrap' }}>{fmtDate(p.createdAt)}</td>
                    <td style={{ padding: '10px 14px', color: INK }}>{p.student} <span style={{ color: MUTED }}>→</span> {p.teacher}</td>
                    <td style={{ padding: '10px 14px', color: MUTED }}>{p.course}</td>
                    <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 7, textTransform: 'uppercase', background: s.bg, color: s.color }}>{p.initiatedBy}</span></td>
                    <td style={{ padding: '10px 14px', color: '#555', maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.reason}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: RED }}>{full(p.amount)}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <style>{`
        .qmg-skel{background:linear-gradient(90deg,#F1ECE2 25%,#E8E2D6 50%,#F1ECE2 75%);background-size:200% 100%;animation:qmgsh 1.4s infinite;border-radius:14px}
        @keyframes qmgsh{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @media(max-width:1000px){ .qmg-rf-kpi{grid-template-columns:repeat(2,1fr)!important} .qmg-rf-2{grid-template-columns:1fr!important} }
        @media(max-width:520px){ .qmg-rf-kpi{grid-template-columns:1fr!important} }
      `}</style>
    </AdminLayout>
  )
}
