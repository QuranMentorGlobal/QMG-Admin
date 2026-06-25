// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/courses-hub/page.tsx
// Courses Hub — comprehensive oversight of every course on the platform.
// 5 tabs (Trial · Recorded · Live · Long · Completed). Each tab lists all
// teachers' courses with the teacher name. "Completed" = courses the teacher
// has closed (status='completed'); shows per-teacher completion counts.
// Reads the service-role /api/courses-hub feed. Deep-linkable via ?tab=.
// ============================================================
'use client'
import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import {
  Search, BookOpen, Video, Target, GraduationCap, Award, Library, Users as UsersIcon,
} from 'lucide-react'
import RangeTabs, { withinRange } from '@/components/RangeTabs'

const GOLD = '#C9A227', INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F8F5EE', GREEN = '#16A34A', FOREST = '#166534'

type TabKey = 'trial' | 'recorded' | 'live' | 'long' | 'completed'

type Course = {
  id: string; title: string; tab: 'trial' | 'recorded' | 'live' | 'long'
  productType: string; closed: boolean; status: string; isActive: boolean
  teacherId: string; teacherName: string; level: string | null; category: string | null
  price: number; enrollments: number; createdAt: string | null; closedAt: string | null
}
type Counts = { trial: number; recorded: number; live: number; long: number; completed: number; total: number }
type TeacherCompletion = { teacherId: string; teacherName: string; completed: number }

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'trial',     label: 'Trial Classes',    icon: Target        },
  { key: 'recorded',  label: 'Recorded Courses', icon: BookOpen      },
  { key: 'live',      label: 'Live Classes',     icon: Video         },
  { key: 'long',      label: 'Long Courses',     icon: GraduationCap },
  { key: 'completed', label: 'Completed',        icon: Award         },
]

function money(n: number) { return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(s: string | null) { if (!s) return '—'; const d = new Date(s); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }

function StatCard({ icon: Icon, label, value, active, onClick }: { icon: any; label: string; value: number; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className="adminx-stat"
      style={{
        textAlign: 'center', cursor: onClick ? 'pointer' : 'default', width: '100%',
        background: active ? 'linear-gradient(135deg,#166534,#C9A227)' : '#fff',
        borderRadius: 14, padding: '14px 16px', border: `1px solid ${active ? 'transparent' : BORDER}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'all .15s',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: active ? 'rgba(255,255,255,0.18)' : CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} style={{ color: active ? '#fff' : GOLD }} />
        </div>
        <p style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.85)' : MUTED, margin: 0, fontWeight: 600 }}>{label}</p>
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color: active ? '#fff' : INK, margin: 0, lineHeight: 1, fontFamily: "'Fraunces',serif" }}>{value}</p>
    </button>
  )
}

export default function CoursesHubPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [counts, setCounts] = useState<Counts>({ trial: 0, recorded: 0, live: 0, long: 0, completed: 0, total: 0 })
  const [teacherCompletions, setTeacherCompletions] = useState<TeacherCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<TabKey>('trial')
  const [completedType, setCompletedType] = useState<'all' | 'trial' | 'recorded' | 'live' | 'long'>('all')
  const [search, setSearch] = useState('')
  const [range, setRange] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // Deep-link via ?tab=
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab') as TabKey | null
      if (t && TABS.some(x => x.key === t)) setTab(t)
    } catch {}
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/courses-hub')
        const text = await res.text()
        const json = text ? JSON.parse(text) : {}
        if (!res.ok) throw new Error(json.error || `Failed to load (${res.status})`)
        setCourses(json.courses || [])
        setCounts(json.counts || { trial: 0, recorded: 0, live: 0, long: 0, completed: 0, total: 0 })
        setTeacherCompletions(json.teacherCompletions || [])
      } catch (e: any) {
        setErr(e.message || 'Could not load courses.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = tab === 'completed'
      ? courses.filter(c => c.closed && (completedType === 'all' || c.tab === completedType))
      : courses.filter(c => !c.closed && c.tab === tab)
    list = withinRange(list, range, c => c.closed ? c.closedAt : c.createdAt, from, to)
    if (q) list = list.filter(c => c.title.toLowerCase().includes(q) || c.teacherName.toLowerCase().includes(q))
    return list
  }, [courses, tab, completedType, search, range, from, to])

  return (
    <AdminLayout>
      <div style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Library size={22} style={{ color: GOLD }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: INK, margin: 0, fontFamily: "'Fraunces',serif" }}>Courses Hub</h1>
        </div>
        <p style={{ fontSize: 13, color: MUTED, margin: '0 0 18px' }}>
          Every course across the platform, grouped by type. When a teacher closes a course it moves to Completed.
        </p>

        {/* Type stat cards (also act as tab shortcuts) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 18 }}>
          <StatCard icon={Target}        label="Trial Classes"    value={counts.trial}     active={tab === 'trial'}     onClick={() => setTab('trial')} />
          <StatCard icon={BookOpen}      label="Recorded Courses" value={counts.recorded}  active={tab === 'recorded'}  onClick={() => setTab('recorded')} />
          <StatCard icon={Video}         label="Live Classes"     value={counts.live}      active={tab === 'live'}      onClick={() => setTab('live')} />
          <StatCard icon={GraduationCap} label="Long Courses"     value={counts.long}      active={tab === 'long'}      onClick={() => setTab('long')} />
          <StatCard icon={Award}         label="Completed"        value={counts.completed} active={tab === 'completed'} onClick={() => setTab('completed')} />
        </div>

        {/* Tabs + search */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TABS.map(t => {
              const on = tab === t.key
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12,
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                    background: on ? 'linear-gradient(135deg,#166534,#C9A227)' : '#fff',
                    color: on ? '#fff' : FOREST, border: `1px solid ${on ? 'transparent' : BORDER}`,
                  }}>
                  <t.icon size={14} /> {t.label}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: 220, flex: '0 1 280px' }}>
              <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: MUTED }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search course or teacher…"
                style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 13, color: INK, outline: 'none', background: '#fff' }} />
            </div>
            <RangeTabs value={range} onChange={setRange} from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          </div>
        </div>

        {/* Completed sub-filter + completions-by-teacher */}
        {tab === 'completed' && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {(['all', 'trial', 'recorded', 'live', 'long'] as const).map(k => {
                const on = completedType === k
                const n = k === 'all' ? counts.completed : courses.filter(c => c.closed && c.tab === k).length
                return (
                  <button key={k} onClick={() => setCompletedType(k)}
                    style={{ padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: on ? 'rgba(201,162,39,0.12)' : '#fff', color: on ? '#8A6A16' : MUTED,
                      border: `1px solid ${on ? 'rgba(201,162,39,0.3)' : BORDER}` }}>
                    {k === 'all' ? 'All' : k[0].toUpperCase() + k.slice(1)} · {n}
                  </button>
                )
              })}
            </div>
            {teacherCompletions.length > 0 && (
              <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <UsersIcon size={14} style={{ color: GOLD }} />
                  <p style={{ fontSize: 12, fontWeight: 700, color: INK, margin: 0 }}>Completions by teacher</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>
                  {teacherCompletions.map(t => (
                    <div key={t.teacherId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px', borderRadius: 10, background: CREAM }}>
                      <span style={{ fontSize: 12, color: INK, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.teacherName}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: FOREST }}>{t.completed}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ display: 'grid', gap: 10 }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ height: 64, borderRadius: 12, background: '#EEE7D7' }} className="animate-pulse" />)}</div>
        ) : err ? (
          <div style={{ background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5', borderRadius: 12, padding: '14px 16px', fontSize: 13 }}>{err}</div>
        ) : visible.length === 0 ? (
          <div style={{ background: '#fff', border: `1px dashed ${BORDER}`, borderRadius: 16, padding: 48, textAlign: 'center' }}>
            <Library size={36} style={{ color: 'rgba(201,162,39,0.4)', margin: '0 auto 10px' }} />
            <p style={{ fontWeight: 700, color: INK, margin: '0 0 4px' }}>No courses here yet</p>
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{tab === 'completed' ? 'No courses have been marked complete.' : 'No courses in this category.'}</p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
            {/* header row (desktop) */}
            <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.4fr 0.9fr 0.9fr 1fr', gap: 8, padding: '10px 16px', background: CREAM, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em' }} className="hub-head">
              <span>Course</span><span>Teacher</span><span>Price</span><span>Enrolled</span><span>{tab === 'completed' ? 'Closed' : 'Created'}</span>
            </div>
            {visible.map((c, i) => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.4fr 0.9fr 0.9fr 1fr', gap: 8, padding: '12px 16px', borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`, alignItems: 'center' }} className="hub-row">
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: INK, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</p>
                  <p style={{ fontSize: 11, color: MUTED, margin: '2px 0 0' }}>
                    {c.category || c.productType}{c.level ? ` · ${c.level}` : ''}
                    {!c.closed && !c.isActive && <span style={{ color: '#B45309', fontWeight: 700 }}> · inactive</span>}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 999, background: 'linear-gradient(135deg,#166534,#C9A227)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {(c.teacherName[0] || 'T').toUpperCase()}
                  </div>
                  <span style={{ fontSize: 12.5, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.teacherName}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: c.price > 0 ? FOREST : MUTED }} className="hub-cell">{c.price > 0 ? money(c.price) : 'Free'}</span>
                <span style={{ fontSize: 13, color: INK }} className="hub-cell">{c.enrollments}</span>
                <span style={{ fontSize: 12, color: MUTED }} className="hub-cell">{fmtDate(c.closed ? c.closedAt : c.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 720px){
          .hub-head{ display:none !important; }
          .hub-row{ grid-template-columns: 1fr 1fr !important; }
          .hub-row > div:first-child{ grid-column: 1 / -1; }
        }
        @media(max-width:640px){ .qmg-ch-filters{justify-content:center!important} .qmg-ch-filters>div{justify-content:center!important} }
      `}</style>
    </AdminLayout>
  )
}
