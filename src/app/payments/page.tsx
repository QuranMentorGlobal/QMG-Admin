// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/payments/page.tsx
// Payments & Revenue — finance dashboard: revenue/commission/payout breakdown,
// monthly comparison + financial trends, payment-type & provider breakdown,
// top teacher payouts, revenue forecast, recent transactions.
// Reads /api/payments-finance (aggregates ALL payments, server-side).
// ============================================================
'use client'
import { useEffect, useMemo, useState } from 'react'
import PageHead from '@/components/PageHead'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import RangeTabs, { withinRange } from '@/components/RangeTabs'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  DollarSign, Wallet, Landmark, TrendingUp, TrendingDown, Search, Download,
  Sparkles, CreditCard, Users, BarChart3,
} from 'lucide-react'

const GOLD = '#C9A227', GOLD_L = '#E3C04A', INK = '#111111', INK_MID = '#3D3D3D'
const GRID = '#EDE6D6', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F8F5EE', GREEN = '#16A34A', RED = '#DC2626'

function money(n: number) { return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function full(n: number) { return '$' + (Number(n) || 0).toFixed(2) }
function monthLabel(m: string) { const [y, mo] = m.split('-'); return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(undefined, { month: 'short' }) }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }

const STATUS: Record<string, { bg: string; color: string }> = {
  succeeded: { bg: 'rgba(22,163,74,0.1)', color: GREEN }, pending: { bg: CREAM, color: GOLD },
  failed: { bg: 'rgba(239,68,68,0.1)', color: RED }, refunded: { bg: 'rgba(99,102,241,0.1)', color: '#6366F1' },
}

function Kpi({ icon: Icon, label, value, accent, chip, sub }: { icon: any; label: string; value: string; accent?: boolean; chip?: number; sub?: string }) {
  return (
    <div className="adminx-stat" style={{ background: '#fff', borderRadius: 16, padding: '16px 18px', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={15} style={{ color: GOLD }} /></div>
          <p style={{ fontSize: 11.5, color: MUTED, margin: 0, fontWeight: 600 }}>{label}</p>
        </div>
        {chip !== undefined && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: chip === 0 ? MUTED : chip > 0 ? GOLD : RED }}>
            {chip >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{chip > 0 ? '+' : ''}{chip}%
          </span>
        )}
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

export default function AdminPaymentsPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [d, setD] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [range, setRange] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    (async () => {
      try { const sb = createClient(); const { data: { user } } = await sb.auth.getUser(); if (user) { const { data: p } = await sb.from('profiles').select('first_name').eq('id', user.id).single(); setAdminName((p as any)?.first_name || 'Admin') } } catch {}
    })()
    fetch('/api/payments-finance').then(r => r.ok ? r.json() : null).then(j => { setD(j); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const t = d?.totals || { gross: 0, commission: 0, payout: 0, aov: 0, succeeded: 0, failed: 0, refunded: 0, pending: 0, total: 0 }
  const monthly = d?.monthly || { thisMonth: 0, lastMonth: 0, growth: 0 }
  const forecast = d?.forecast || 0
  const topPayouts = d?.topPayouts || []
  const typeBreakdown = d?.typeBreakdown || []
  const trend = (d?.byMonth || []).map((x: any) => ({ ...x, label: monthLabel(x.m) }))
  const splitData = d ? [{ name: 'Platform Commission', value: t.commission }, { name: 'Teacher Payout', value: t.payout }] : []

  const recent = useMemo(() => {
    const q = search.toLowerCase()
    return withinRange((d?.recent || []), range, (p: any) => p.createdAt, from, to).filter((p: any) => {
      if (filter !== 'all' && p.status !== filter) return false
      if (q && !`${p.student} ${p.teacher} ${p.provider} ${p.type}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [d, filter, search, range, from, to])

  function exportCSV() {
    if (!d) return
    const lines = ['Date,Student,Teacher,Type,Provider,Status,Gross,Commission,Payout']
    d.recent.forEach((p: any) => lines.push(`${fmtDate(p.createdAt)},"${p.student}","${p.teacher}",${p.type},${p.provider},${p.status},${p.gross},${p.commission},${p.payout}`))
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' }); const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `qmg-payments-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  return (
    <AdminLayout adminName={adminName}>
      <PageHead
        title="Payments & Revenue"
        subtitle="Financial overview across the platform."
        range={{ value: range, onChange: setRange, from, to, onFrom: setFrom, onTo: setTo }}
        actions={<button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 11, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#166534,#C9A227)', color: '#fff', fontSize: 12.5, fontWeight: 700 }}><Download size={14} /> Export CSV</button>}
      />

      {/* KPIs */}
      <div className="qmg-fin-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
        {loading ? [...Array(4)].map((_, i) => <Skel key={i} h={96} />) : <>
          <Kpi icon={DollarSign} label="Total Revenue (GTV)" value={money(t.gross)} accent sub={`${t.succeeded} successful payments`} />
          <Kpi icon={Landmark} label="Platform Commission" value={money(t.commission)} accent sub="Net to platform" />
          <Kpi icon={Wallet} label="Teacher Payouts" value={money(t.payout)} sub="Total disbursed" />
          <Kpi icon={CreditCard} label="This Month" value={money(monthly.thisMonth)} chip={monthly.growth} sub={`Avg order ${money(t.aov)}`} />
        </>}
      </div>

      {/* Financial trends */}
      <div style={{ marginBottom: 18 }}>
        <Panel title="Financial Trends (12 months)" icon={BarChart3}>
          {loading ? <Skel h={300} /> : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trend} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="fGross" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD} stopOpacity={0.32} /><stop offset="100%" stopColor={GOLD} stopOpacity={0.02} /></linearGradient>
                  <linearGradient id="fCom" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={INK} stopOpacity={0.2} /><stop offset="100%" stopColor={INK} stopOpacity={0.02} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => '$' + (v >= 1000 ? (v / 1000) + 'k' : v)} />
                <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="gross" name="Gross Revenue" stroke={GOLD} strokeWidth={2.5} fill="url(#fGross)" />
                <Area type="monotone" dataKey="commission" name="Commission" stroke={INK} strokeWidth={2} fill="url(#fCom)" />
                <Area type="monotone" dataKey="payout" name="Payout" stroke={GOLD_L} strokeWidth={2} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Split + forecast + type */}
      <div className="qmg-fin-3" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: 18, marginBottom: 18 }}>
        <Panel title="Commission vs Payout" icon={Landmark}>
          {loading ? <Skel h={230} /> : (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart><Pie data={splitData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={84} paddingAngle={3}><Cell fill={GOLD} /><Cell fill={INK_MID} /></Pie>
                <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel title="Revenue Forecast" icon={Sparkles}>
          {loading ? <Skel h={230} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: 230, textAlign: 'center', gap: 8 }}>
              <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Projected next month</p>
              <p style={{ fontSize: 40, fontWeight: 800, color: GOLD, margin: 0, fontFamily: "'Fraunces',serif" }}>{money(forecast)}</p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'center', fontSize: 12, color: monthly.growth >= 0 ? GREEN : RED, fontWeight: 700 }}>
                {monthly.growth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {monthly.growth > 0 ? '+' : ''}{monthly.growth}% vs last month
              </div>
              <p style={{ fontSize: 10.5, color: MUTED, margin: '6px 0 0' }}>Linear projection over the last 12 months</p>
            </div>
          )}
        </Panel>
        <Panel title="By Payment Type" icon={CreditCard}>
          {loading ? <Skel h={230} /> : (typeBreakdown.length === 0 ? <p style={{ fontSize: 12.5, color: MUTED }}>No data.</p> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {typeBreakdown.map((x: any) => { const pct = t.gross > 0 ? Math.round((x.gross / t.gross) * 100) : 0; return (
                <div key={x.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                    <span style={{ color: INK, fontWeight: 600, textTransform: 'capitalize' }}>{x.name} <span style={{ color: MUTED, fontWeight: 400 }}>· {x.count}</span></span>
                    <span style={{ color: GOLD, fontWeight: 700 }}>{money(x.gross)}</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 99, background: CREAM, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#166534,#C9A227)', borderRadius: 99 }} /></div>
                </div>
              )})}
            </div>
          )}
        </Panel>
      </div>

      {/* Top payouts + monthly bars */}
      <div className="qmg-fin-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: 18, marginBottom: 18 }}>
        <Panel title="Top Teacher Payouts" icon={Users}>
          {loading ? <Skel h={240} /> : (topPayouts.length === 0 ? <p style={{ fontSize: 12.5, color: MUTED }}>No payouts yet.</p> :
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {topPayouts.map((tp: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < topPayouts.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, background: i === 0 ? 'linear-gradient(135deg,#166534,#C9A227)' : CREAM, color: i === 0 ? '#111111' : GOLD, fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tp.name}</span>
                  <span style={{ fontSize: 11, color: MUTED }}>{tp.count}×</span>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: GOLD, fontFamily: "'Fraunces',serif" }}>{money(tp.payout)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Monthly Revenue" icon={BarChart3}>
          {loading ? <Skel h={240} /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trend} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} width={42} tickFormatter={(v) => '$' + (v >= 1000 ? (v / 1000) + 'k' : v)} />
                <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                <Bar dataKey="gross" name="Gross" fill={GOLD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Recent transactions */}
      <Panel title="Recent Transactions" icon={DollarSign} right={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 12, color: INK, background: '#fff', fontWeight: 600 }}>
            {['all', 'succeeded', 'pending', 'failed', 'refunded'].map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
          <div style={{ position: 'relative' }}><Search size={14} style={{ position: 'absolute', left: 10, top: 8, color: MUTED }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ padding: '6px 10px 6px 30px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 12, color: INK, width: 160 }} /></div>
        </div>
      }>
        {loading ? <Skel h={200} /> : recent.length === 0 ? <p style={{ fontSize: 12.5, color: MUTED, padding: 16, textAlign: 'center' }}>No transactions match.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead><tr style={{ textAlign: 'left', color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', background: '#FBF8F1' }}>
                <th style={{ padding: '10px 14px' }}>Date</th><th style={{ padding: '10px 14px' }}>Student → Teacher</th><th style={{ padding: '10px 14px' }}>Type</th><th style={{ padding: '10px 14px' }}>Status</th><th style={{ padding: '10px 14px', textAlign: 'right' }}>Gross</th><th style={{ padding: '10px 14px', textAlign: 'right' }}>Commission</th>
              </tr></thead>
              <tbody>
                {recent.map((p: any) => { const s = STATUS[p.status] || { bg: '#F3F4F6', color: MUTED }; return (
                  <tr key={p.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '10px 14px', color: '#555', whiteSpace: 'nowrap' }}>{fmtDate(p.createdAt)}</td>
                    <td style={{ padding: '10px 14px', color: INK }}>{p.student} <span style={{ color: MUTED }}>→</span> {p.teacher}</td>
                    <td style={{ padding: '10px 14px', color: MUTED, textTransform: 'capitalize' }}>{p.type || '—'}</td>
                    <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 7, textTransform: 'uppercase', background: s.bg, color: s.color }}>{p.status}</span></td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: INK }}>{full(p.gross)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: GOLD, fontWeight: 700 }}>{full(p.commission)}</td>
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
        @media(max-width:1000px){ .qmg-fin-kpi{grid-template-columns:repeat(2, minmax(0, 1fr))!important} .qmg-fin-3{grid-template-columns:minmax(0,1fr)!important} .qmg-fin-2{grid-template-columns:minmax(0,1fr)!important} }
        @media(max-width:520px){ .qmg-fin-kpi{grid-template-columns:minmax(0,1fr)!important} }
      `}</style>
    </AdminLayout>
  )
}
