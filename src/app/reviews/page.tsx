// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/reviews/page.tsx
// Reviews — rating distribution, review trends, teacher reputation indicators,
// plus the moderation queue (publish / reject). Reads /api/reviews-analytics.
// Moderation goes through /api/review-moderate (guarded + audited).
// ============================================================
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Star, CheckCircle2, XCircle, Clock, MessageSquare, Award, AlertTriangle, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'

const GOLD = '#B8952A', INK = '#1A1A1A', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F7F1E2', GREEN = '#16A34A', RED = '#DC2626', GRID = '#EDE6D6'

function Stars({ n, size = 13 }: { n: number; size?: number }) {
  return <span style={{ display: 'inline-flex', gap: 1 }}>{[1, 2, 3, 4, 5].map(i => <Star key={i} size={size} style={{ color: i <= Math.round(n) ? GOLD : '#DDD5C4', fill: i <= Math.round(n) ? GOLD : 'none' }} />)}</span>
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
function Panel({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="adminx-rise" style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: INK, margin: '0 0 14px', fontFamily: "'Fraunces',serif" }}>{Icon && <Icon size={16} style={{ color: GOLD }} />}{title}</h2>
      {children}
    </div>
  )
}
function Skel({ h }: { h: number }) { return <div className="qmg-skel" style={{ width: '100%', height: h }} /> }

export default function ReviewsPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [d, setD] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    (async () => { try { const sb = createClient(); const { data: { user } } = await sb.auth.getUser(); if (user) { const { data: p } = await sb.from('profiles').select('first_name').eq('id', user.id).single(); setAdminName((p as any)?.first_name || 'Admin') } } catch {} })()
  }, [])

  async function load() {
    setLoading(true)
    try { const res = await fetch('/api/reviews-analytics'); if (res.ok) setD(await res.json()) } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleReview(id: string, approve: boolean) {
    setActionLoading(id)
    const res = await fetch('/api/review-moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewId: id, publish: approve }) })
    setToast(res.ok ? (approve ? '✅ Review published!' : '🗑️ Review rejected.') : '❌ Action not permitted')
    setTimeout(() => setToast(''), 3000)
    await load(); setActionLoading(null)
  }

  const t = d?.totals || { total: 0, publishedCount: 0, pendingCount: 0, avgRating: 0 }
  const dist = d?.dist || []
  const topRated = d?.topRated || []
  const lowRated = d?.lowRated || []
  const pending = d?.pending || []
  const maxDist = Math.max(1, ...(dist.length ? dist.map((x: any) => x.count) : [1]))
  const trend = (d?.trend || []).map((x: any) => ({ ...x, label: format(new Date(x.m + '-01'), 'MMM') }))

  return (
    <AdminLayout adminName={adminName}>
      {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, padding: '12px 18px', borderRadius: 12, background: GOLD, color: '#1A1400', fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>{toast}</div>}

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 800, color: INK, margin: 0 }}>Reviews</h1>
        <p style={{ fontSize: 13, color: '#6B6B6B', margin: '5px 0 0' }}>Ratings, reputation, and moderation.</p>
      </div>

      {/* KPIs */}
      <div className="qmg-rv-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {loading ? [...Array(4)].map((_, i) => <Skel key={i} h={96} />) : <>
          <Kpi icon={Star} label="Average Rating" value={t.avgRating ? `${t.avgRating}/5` : 'N/A'} accent sub="Across published reviews" />
          <Kpi icon={MessageSquare} label="Total Reviews" value={String(t.total)} />
          <Kpi icon={CheckCircle2} label="Published" value={String(t.publishedCount)} />
          <Kpi icon={Clock} label="Pending Moderation" value={String(t.pendingCount)} />
        </>}
      </div>

      {/* Distribution + trend */}
      <div className="qmg-rv-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 18, marginBottom: 18 }}>
        <Panel title="Rating Distribution" icon={Star}>
          {loading ? <Skel h={210} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {[...dist].reverse().map((x: any) => {
                const pct = t.publishedCount > 0 ? Math.round((x.count / t.publishedCount) * 100) : 0
                return (
                  <div key={x.star} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, width: 40, fontSize: 12.5, fontWeight: 700, color: INK }}>{x.star} <Star size={12} style={{ color: GOLD, fill: GOLD }} /></span>
                    <div style={{ flex: 1, height: 10, borderRadius: 99, background: CREAM, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(x.count / maxDist) * 100}%`, background: 'linear-gradient(90deg,#C8A24A,#D4AF37)', borderRadius: 99, transition: 'width .7s ease' }} /></div>
                    <span style={{ width: 64, textAlign: 'right', fontSize: 12, color: MUTED }}>{x.count} · {pct}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
        <Panel title="Rating Trend (12 months)" icon={TrendingUp}>
          {loading ? <Skel h={210} /> : (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={trend} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }} formatter={(v: any, n: any) => n === 'avg' ? [`${v}/5`, 'Avg rating'] : [v, 'Reviews']} />
                <Line type="monotone" dataKey="avg" name="avg" stroke={GOLD} strokeWidth={2.5} dot={{ r: 3, fill: GOLD }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Reputation */}
      <div className="qmg-rv-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <Panel title="Top-Rated Teachers" icon={Award}>
          {loading ? <Skel h={200} /> : (topRated.length === 0 ? <p style={{ fontSize: 12.5, color: MUTED }}>No published reviews yet.</p> :
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {topRated.map((tr: any, i: number) => (
                <a key={tr.id} href={`/teachers/${tr.id}`} className="adminx-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 10, textDecoration: 'none', borderBottom: i < topRated.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, background: i === 0 ? GOLD : CREAM, color: i === 0 ? '#1A1400' : GOLD, fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr.name}</span>
                  <Stars n={tr.avg} size={12} />
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: GOLD, width: 56, textAlign: 'right' }}>{tr.avg} <span style={{ color: MUTED, fontWeight: 400, fontSize: 11 }}>({tr.count})</span></span>
                </a>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Reputation — Needs Attention" icon={AlertTriangle}>
          {loading ? <Skel h={200} /> : (lowRated.length === 0 ? (
            <div style={{ padding: '24px 8px', textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(22,163,74,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}><CheckCircle2 size={18} style={{ color: GREEN }} /></div>
              <p style={{ fontSize: 12.5, color: MUTED, margin: 0 }}>No teachers below 4.0 — reputation is healthy.</p>
            </div>
          ) :
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {lowRated.map((tr: any, i: number) => (
                <a key={tr.id} href={`/teachers/${tr.id}`} className="adminx-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 10, textDecoration: 'none', borderBottom: i < lowRated.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                  <AlertTriangle size={15} style={{ color: tr.avg < 3 ? RED : GOLD }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr.name}</span>
                  <Stars n={tr.avg} size={12} />
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: tr.avg < 3 ? RED : GOLD, width: 56, textAlign: 'right' }}>{tr.avg} <span style={{ color: MUTED, fontWeight: 400, fontSize: 11 }}>({tr.count})</span></span>
                </a>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Moderation queue */}
      <Panel title={`Moderation Queue${pending.length ? ` · ${pending.length}` : ''}`} icon={MessageSquare}>
        {loading ? <Skel h={160} /> : pending.length === 0 ? (
          <div style={{ padding: '36px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⭐</div>
            <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: 0 }}>All reviews moderated!</p>
            <p style={{ fontSize: 12.5, color: MUTED, margin: '4px 0 0' }}>Nothing pending right now.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.map((r: any) => (
              <div key={r.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 13, padding: 16, background: '#FCFAF5' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Stars n={r.rating} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{r.title || 'Untitled review'}</span>
                  <span style={{ fontSize: 11.5, color: MUTED, marginLeft: 'auto' }}>{r.createdAt ? format(new Date(r.createdAt), 'dd MMM yyyy') : ''}</span>
                </div>
                {r.body && <p style={{ fontSize: 13, color: '#555', lineHeight: 1.55, margin: '0 0 10px' }}>{r.body}</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11.5, color: MUTED }}>👤 {r.student} → 🎓 {r.teacher}</span>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                    <button onClick={() => handleReview(r.id, true)} disabled={actionLoading === r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: GOLD, color: '#1A1400', fontSize: 12.5, fontWeight: 700, opacity: actionLoading === r.id ? 0.6 : 1 }}><CheckCircle2 size={14} /> Publish</button>
                    <button onClick={() => handleReview(r.id, false)} disabled={actionLoading === r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', background: '#FEE2E2', color: RED, border: '1px solid #FECACA', fontSize: 12.5, fontWeight: 700, opacity: actionLoading === r.id ? 0.6 : 1 }}><XCircle size={14} /> Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <style>{`
        .qmg-skel{background:linear-gradient(90deg,#F1ECE2 25%,#E8E2D6 50%,#F1ECE2 75%);background-size:200% 100%;animation:qmgsh 1.4s infinite;border-radius:14px}
        @keyframes qmgsh{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @media(max-width:1000px){ .qmg-rv-kpi{grid-template-columns:repeat(2,1fr)!important} .qmg-rv-2{grid-template-columns:1fr!important} }
        @media(max-width:520px){ .qmg-rv-kpi{grid-template-columns:1fr!important} }
      `}</style>
    </AdminLayout>
  )
}
