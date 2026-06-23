// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/analytics/page.tsx
// Advanced Analytics (Phase 3) — Funnel · Geography · Courses · Financials ·
// Support · Marketing · AI Insights. Reads /api/analytics + /api/analytics/deep.
// ============================================================
'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { Download, FileText, Sparkles, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'

const GOLD = '#C9A227', GOLD_L = '#E3C04A', INK = '#111111', INK_MID = '#3D3D3D'
const GRID = '#EDE6D6', BORDER = '#E8E4DA', MUTED = '#9A9A8A', RED = '#DC2626'

const RANGES = [
  { key: '7', label: '7D' }, { key: '30', label: '30D' }, { key: '90', label: '90D' },
  { key: '365', label: '1Y' }, { key: 'all', label: 'All' },
]
const TABS = ['Funnel', 'Geography', 'Courses', 'Financials', 'Support', 'Marketing', 'AI Insights']

const KEY_MARKETS = [
  { name: 'USA', flag: '🇺🇸', match: ['united states', 'usa', 'us'] },
  { name: 'UK', flag: '🇬🇧', match: ['united kingdom', 'uk', 'england', 'britain'] },
  { name: 'Canada', flag: '🇨🇦', match: ['canada'] },
  { name: 'Australia', flag: '🇦🇺', match: ['australia'] },
  { name: 'Saudi Arabia', flag: '🇸🇦', match: ['saudi arabia', 'saudi', 'ksa'] },
  { name: 'UAE', flag: '🇦🇪', match: ['uae', 'united arab emirates', 'emirates', 'dubai'] },
  { name: 'Pakistan', flag: '🇵🇰', match: ['pakistan'] },
]

const fmtMoney = (n: number) => Math.abs(n) >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : '$' + Math.round(n)
const fmtNum = (n: number) => Math.round(n).toLocaleString()

function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: INK, margin: 0, fontFamily: "'Fraunces',serif" }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  )
}
function Empty({ msg }: { msg: string }) {
  return <div style={{ padding: '36px 12px', textAlign: 'center', color: MUTED, fontSize: 13 }}>{msg}</div>
}

export default function AnalyticsPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [range, setRange] = useState('30')
  const [tab, setTab] = useState('Funnel')
  const [deep, setDeep] = useState<any>(null)
  const [base, setBase] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [geoMetric, setGeoMetric] = useState<'students' | 'teachers' | 'revenue'>('students')
  const [aiInsights, setAiInsights] = useState<{ tone: 'up' | 'down' | 'flag'; text: string; rec?: string }[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiFetchedRange, setAiFetchedRange] = useState<string | null>(null)
  const [aiActive, setAiActive] = useState(false)   // true once AI returned at least one insight

  useEffect(() => {
    (async () => {
      try {
        const sb = createClient(); const { data: { user } } = await sb.auth.getUser()
        if (user) { const { data: p } = await sb.from('profiles').select('first_name').eq('id', user.id).single(); setAdminName((p as any)?.first_name || 'Admin') }
      } catch {}
    })()
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/analytics?range=${range}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/analytics/deep?range=${range}`).then(r => r.ok ? r.json() : null),
    ]).then(([b, d]) => { setBase(b); setDeep(d); setLoading(false) }).catch(() => setLoading(false))
  }, [range])

  const forecast = useMemo(() => {
    const m = deep?.monthly || []
    if (m.length < 2) return []
    const xs = m.map((_: any, i: number) => i), ys = m.map((r: any) => r.revenue)
    const n = xs.length, sx = xs.reduce((a: number, b: number) => a + b, 0), sy = ys.reduce((a: number, b: number) => a + b, 0)
    const sxy = xs.reduce((a: number, b: number, i: number) => a + b * ys[i], 0), sxx = xs.reduce((a: number, b: number) => a + b * b, 0)
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1), intercept = (sy - slope * sx) / n
    const hist = m.map((r: any) => ({ m: r.m, revenue: r.revenue, forecast: null as any }))
    const last = m[m.length - 1]
    const [yy, mm] = last.m.split('-').map(Number)
    const out: any[] = [...hist]
    out[out.length - 1].forecast = last.revenue
    for (let i = 1; i <= 3; i++) {
      const d = new Date(yy, mm - 1 + i, 1)
      const proj = Math.max(0, Math.round(slope * (n - 1 + i) + intercept))
      out.push({ m: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, revenue: null, forecast: proj })
    }
    return out
  }, [deep])

  const insights = useMemo(() => {
    if (!deep?.insights) return []
    const i = deep.insights, out: { tone: 'up' | 'down' | 'flag'; text: string; rec?: string }[] = []
    if (i.revenueGrowth >= 0) out.push({ tone: 'up', text: `Revenue is up ${i.revenueGrowth}% versus the previous period.` })
    else out.push({ tone: 'down', text: `Revenue is down ${Math.abs(i.revenueGrowth)}% versus the previous period.`, rec: 'Review trial→paid conversion and re-engage churned students.' })
    if (i.topStudentCountry) out.push({ tone: 'up', text: `${i.topStudentCountry} is your largest student market.`, rec: `Localize landing pages and run targeted campaigns in ${i.topStudentCountry}.` })
    if (i.topCourse) out.push({ tone: 'up', text: `"${i.topCourse}" is your highest-revenue course.`, rec: 'Feature it on the homepage and recruit more teachers for it.' })
    if (i.conversionRate < 25 && i.trialBooked > 0) out.push({ tone: 'flag', text: `Trial→paid conversion is ${i.conversionRate}% — below a healthy 25–35% band.`, rec: 'Add automated trial follow-ups and a first-paid-lesson discount.' })
    else if (i.trialBooked > 0) out.push({ tone: 'up', text: `Trial→paid conversion is ${i.conversionRate}%.` })
    if (i.openTickets > 0) out.push({ tone: 'flag', text: `${i.openTickets} support tickets are open.`, rec: 'Clear the open queue to protect satisfaction and retention.' })
    if (i.avgResponseHrs != null && i.avgResponseHrs > 24) out.push({ tone: 'down', text: `Average support response is ${i.avgResponseHrs}h.`, rec: 'Target under 12h; consider canned replies for common issues.' })
    return out
  }, [deep])

  // Reset AI insights whenever the date range changes (they'll re-fetch on demand).
  useEffect(() => { setAiInsights([]); setAiActive(false); setAiFetchedRange(null) }, [range])

  // Lazy: fetch AI insights only when the admin actually opens the AI Insights tab.
  // Reuses the aggregates already in `deep` — no extra analytics queries.
  useEffect(() => {
    if (tab !== 'AI Insights' || !deep || aiLoading || aiFetchedRange === range) return
    setAiLoading(true)
    setAiFetchedRange(range)
    fetch('/api/ai/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deep, range }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const list = Array.isArray(d?.insights) ? d.insights : []
        setAiInsights(list)
        setAiActive(list.length > 0)
      })
      .catch(() => {})
      .finally(() => setAiLoading(false))
  }, [tab, deep, range, aiLoading, aiFetchedRange])

  // Show AI insights when available; otherwise fall back to the heuristic set.
  const displayInsights = aiActive ? aiInsights : insights

  const geo = deep?.geography || []
  const geoSorted = useMemo(() => [...geo].sort((a, b) => (b[geoMetric] || 0) - (a[geoMetric] || 0)), [geo, geoMetric])
  const geoMax = geoSorted[0]?.[geoMetric] || 1
  const fmtGeo = (v: number) => geoMetric === 'revenue' ? fmtMoney(v) : fmtNum(v)
  function marketValue(km: typeof KEY_MARKETS[0]) {
    const row = geo.find((g: any) => km.match.includes(String(g.country || '').toLowerCase()))
    return row ? (row[geoMetric] || 0) : 0
  }

  function exportCSV() {
    if (!deep) return
    const L: string[] = ['Funnel Stage,Count']; (deep.funnel || []).forEach((f: any) => L.push(`${f.stage},${f.value}`))
    L.push('', 'Country,Students,Teachers,Revenue'); (deep.geography || []).forEach((g: any) => L.push(`"${g.country}",${g.students},${g.teachers},${g.revenue}`))
    L.push('', 'Course,Enrollments,Revenue,Completion %,Rating'); (deep.courses || []).forEach((c: any) => L.push(`"${c.course}",${c.enrollments},${c.revenue},${c.completionRate},${c.rating ?? ''}`))
    const blob = new Blob([L.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `qmg-analytics-deep-${range}.csv`; a.click()
  }

  const funnelMax = (deep?.funnel?.[0]?.value) || 1

  return (
    <AdminLayout adminName={adminName}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 800, color: INK, margin: 0 }}>Analytics</h1>
          <p style={{ fontSize: 13, color: '#6B6B6B', margin: '5px 0 0' }}>Deep-dive intelligence across the marketplace.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 3 }}>
            {RANGES.map(r => (
              <button key={r.key} onClick={() => setRange(r.key)} style={{ border: 'none', cursor: 'pointer', padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, fontFamily: "'Inter',sans-serif", background: range === r.key ? INK : 'transparent', color: range === r.key ? '#fff' : '#6B6B6B' }}>{r.label}</button>
            ))}
          </div>
          <button onClick={exportCSV} className="qmg-noprint" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 13px', borderRadius: 11, border: `1px solid ${BORDER}`, cursor: 'pointer', background: '#fff', color: INK, fontSize: 12.5, fontWeight: 700 }}><Download size={14} /> CSV</button>
          <button onClick={() => window.print()} className="qmg-noprint" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 13px', borderRadius: 11, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#166534,#C9A227)', color: '#fff', fontSize: 12.5, fontWeight: 700 }}><FileText size={14} /> PDF</button>
        </div>
      </div>

      <div className="qmg-noprint" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18, borderBottom: `1px solid ${BORDER}`, paddingBottom: 2 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            border: 'none', cursor: 'pointer', padding: '9px 14px', borderRadius: '10px 10px 0 0', fontSize: 13, fontWeight: 700,
            fontFamily: "'Inter',sans-serif", background: 'transparent', color: tab === t ? GOLD : MUTED,
            borderBottom: tab === t ? `2px solid ${GOLD}` : '2px solid transparent', marginBottom: -2,
          }}>{t}</button>
        ))}
      </div>

      {loading ? <Panel title="Loading…"><Empty msg="Crunching the numbers…" /></Panel> : (
        <div id="qmg-analytics-print">
          {tab === 'Funnel' && (
            <Panel title="Conversion Funnel">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(deep?.funnel || []).map((f: any, idx: number) => {
                  const pct = funnelMax ? (f.value / funnelMax) * 100 : 0
                  const prev = idx > 0 ? deep.funnel[idx - 1].value : null
                  const stepConv = prev ? Math.round((f.value / Math.max(1, prev)) * 100) : null
                  return (
                    <div key={f.stage}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: INK }}>{f.stage}</span>
                        <span style={{ color: MUTED }}>{fmtNum(f.value)}{stepConv != null && <span style={{ color: GOLD, fontWeight: 700 }}> · {stepConv}%</span>}</span>
                      </div>
                      <div style={{ height: 26, background: '#F3EEE3', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(4, pct)}%`, height: '100%', background: `linear-gradient(90deg, #166534, #C9A227)`, borderRadius: 8 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <p style={{ fontSize: 11, color: MUTED, marginTop: 14 }}>Visitor stage requires web analytics (not yet connected) — funnel starts at Signups.</p>
            </Panel>
          )}

          {tab === 'Geography' && (
            <>
              <Panel title="Geographic Distribution" right={
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['students', 'teachers', 'revenue'] as const).map(m => (
                    <button key={m} onClick={() => setGeoMetric(m)} style={{ border: 'none', cursor: 'pointer', padding: '5px 11px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, textTransform: 'capitalize', background: geoMetric === m ? '#F8F5EE' : 'transparent', color: geoMetric === m ? GOLD : MUTED }}>{m}</button>
                  ))}
                </div>
              }>
                {geoSorted.length === 0 ? <Empty msg="No country data yet." /> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {geoSorted.slice(0, 12).map((g: any) => (
                      <div key={g.country} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 110, fontSize: 12.5, fontWeight: 600, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.country}</span>
                        <div style={{ flex: 1, height: 18, background: '#F3EEE3', borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(3, ((g[geoMetric] || 0) / geoMax) * 100)}%`, height: '100%', background: 'linear-gradient(135deg,#166534,#C9A227)' }} />
                        </div>
                        <span style={{ width: 70, textAlign: 'right', fontSize: 12, fontWeight: 700, color: INK }}>{fmtGeo(g[geoMetric] || 0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
              <Panel title="Key Markets">
                <div className="qmg-markets" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10 }}>
                  {KEY_MARKETS.map(km => (
                    <div key={km.name} style={{ textAlign: 'center', padding: '14px 6px', borderRadius: 12, background: '#F9F5EC', border: `1px solid ${BORDER}` }}>
                      <div style={{ fontSize: 26 }}>{km.flag}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: GOLD, fontFamily: "'Fraunces',serif", marginTop: 4 }}>{fmtGeo(marketValue(km))}</div>
                      <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{km.name}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}

          {tab === 'Courses' && (
            <Panel title="Course Intelligence">
              {(deep?.courses || []).length === 0 ? <Empty msg="No course bookings in this range." /> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <th style={{ padding: '8px 10px' }}>Course</th><th style={{ padding: '8px 10px', textAlign: 'right' }}>Enrollments</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Revenue</th><th style={{ padding: '8px 10px', textAlign: 'right' }}>Completion</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deep.courses.map((c: any, i: number) => (
                        <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                          <td style={{ padding: '10px', fontWeight: 600, color: INK }}>{c.course}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{fmtNum(c.enrollments)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: GOLD }}>{fmtMoney(c.revenue)}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{c.completionRate}%</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{c.rating != null ? `★ ${c.rating}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {tab === 'Financials' && (
            <Panel title="Revenue Forecast" right={<span style={{ fontSize: 11, color: MUTED }}>Linear projection · next 3 months</span>}>
              {forecast.length < 2 ? <Empty msg="Need at least 2 months of revenue to forecast." /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={forecast} margin={{ top: 6, right: 10, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                    <XAxis dataKey="m" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => '$' + (v >= 1000 ? (v / 1000) + 'k' : v)} />
                    <Tooltip formatter={(v: any) => v == null ? '—' : fmtMoney(Number(v))} contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="revenue" name="Actual" stroke={GOLD} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                    <Line type="monotone" dataKey="forecast" name="Forecast" stroke={INK_MID} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              )}
              <p style={{ fontSize: 11, color: MUTED, marginTop: 12 }}>Forecast uses a least-squares trend on monthly succeeded revenue. Treat as directional, not a guarantee.</p>
            </Panel>
          )}

          {tab === 'Support' && (
            <>
              <div className="qmg-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Open Tickets', value: fmtNum(deep?.support?.open ?? 0) },
                  { label: 'Resolved Tickets', value: fmtNum(deep?.support?.resolved ?? 0) },
                  { label: 'Avg Response', value: deep?.support?.avgResponseHrs != null ? `${deep.support.avgResponseHrs}h` : '—' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: `1px solid ${BORDER}` }}>
                    <p style={{ fontSize: 24, fontWeight: 800, color: INK, margin: 0, fontFamily: "'Fraunces',serif" }}>{s.value}</p>
                    <p style={{ fontSize: 12, color: MUTED, margin: '5px 0 0' }}>{s.label}</p>
                  </div>
                ))}
              </div>
              <Panel title="Ticket Volume Trend">
                {(deep?.support?.trend || []).length === 0 ? <Empty msg={deep?.support?.hasData ? 'No tickets in this range.' : 'Support tickets table not detected.'} /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={deep.support.trend} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                      <XAxis dataKey="d" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} minTickGap={20} />
                      <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                      <Bar dataKey="opened" name="Opened" fill={GOLD} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Panel>
            </>
          )}

          {tab === 'Marketing' && (
            <Panel title="Marketing Analytics">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px', borderRadius: 12, background: '#FFF8E8', border: '1px solid #FDE68A', marginBottom: 16 }}>
                <AlertTriangle size={18} style={{ color: '#C9A227', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12.5, color: '#92400E', margin: 0 }}>Visitor, traffic-source and landing-page conversion data needs a web-analytics integration (e.g. GA4 or Plausible). Once connected, these widgets populate automatically. The conversions below are computed from real platform data.</p>
              </div>
              <div className="qmg-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                {[
                  { label: 'Trial Bookings', value: fmtNum(deep?.insights?.trialBooked ?? 0), sub: 'in selected range' },
                  { label: 'Trial → Paid', value: `${deep?.insights?.conversionRate ?? 0}%`, sub: `${fmtNum(deep?.insights?.paidEnroll ?? 0)} paid` },
                  { label: 'Paid → Active', value: deep?.insights ? `${deep.insights.paidEnroll ? Math.round((deep.insights.activeStudents / Math.max(1, deep.insights.paidEnroll)) * 100) : 0}%` : '—', sub: `${fmtNum(deep?.insights?.activeStudents ?? 0)} active` },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: `1px solid ${BORDER}` }}>
                    <p style={{ fontSize: 24, fontWeight: 800, color: GOLD, margin: 0, fontFamily: "'Fraunces',serif" }}>{s.value}</p>
                    <p style={{ fontSize: 12, color: INK, margin: '5px 0 0', fontWeight: 600 }}>{s.label}</p>
                    <p style={{ fontSize: 11, color: MUTED, margin: '2px 0 0' }}>{s.sub}</p>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {tab === 'AI Insights' && (
            <Panel title="AI Business Insights" right={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: GOLD, fontWeight: 700 }}><Sparkles size={13} /> {aiLoading ? 'Generating…' : aiActive ? 'AI-generated' : 'Auto-generated'}</span>}>
              {aiLoading && displayInsights.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1, 2, 3].map(i => <div key={i} style={{ height: 64, borderRadius: 12, background: '#F1ECE1', animation: 'pulse 1.4s ease-in-out infinite' }} />)}
                </div>
              ) : displayInsights.length === 0 ? <Empty msg="Not enough data to generate insights yet." /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {displayInsights.map((ins, i) => {
                    const c = ins.tone === 'up' ? GOLD : ins.tone === 'down' ? RED : '#B8860B'
                    const Icon = ins.tone === 'up' ? TrendingUp : ins.tone === 'down' ? TrendingDown : AlertTriangle
                    return (
                      <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderRadius: 12, background: '#F9F5EC', border: `1px solid ${BORDER}` }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${BORDER}` }}><Icon size={17} style={{ color: c }} /></div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: INK, margin: 0 }}>{ins.text}</p>
                          {ins.rec && <p style={{ fontSize: 12, color: MUTED, margin: '4px 0 0' }}><strong style={{ color: GOLD }}>Recommended:</strong> {ins.rec}</p>}
                        </div>
                      </div>
                    )
                  })}
                  <p style={{ fontSize: 11, color: MUTED, margin: '4px 2px 0' }}>
                    {aiActive ? 'Generated by AI from your live analytics · refreshes every few hours.' : 'Showing rule-based insights. Add an AI key to enable AI-generated analysis.'}
                  </p>
                </div>
              )}
            </Panel>
          )}
        </div>
      )}

      <style>{`
        @media(max-width:1000px){ .qmg-markets{grid-template-columns:repeat(4, minmax(0, 1fr))!important} .qmg-3{grid-template-columns:minmax(0,1fr)!important} }
        @media(max-width:560px){ .qmg-markets{grid-template-columns:repeat(2, minmax(0, 1fr))!important} }
        @media print { .qmg-noprint{display:none!important} body{background:#fff!important} }
      `}</style>
    </AdminLayout>
  )
}
