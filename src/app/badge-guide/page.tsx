// PASTE THIS WHOLE FILE INTO:  src/app/badge-guide/page.tsx
// ════════════════════════════════════════════════════════════════════════════
// BADGE GUIDE — read-only reference of every badge: name, icon, category, how
// it's earned, and whether it's automatic or admin-assigned. Same source of
// truth (src/lib/badges.ts) as the live badges, so it can never drift. Intended
// to be mirrored into the public Help Center / Knowledge Base later.
// ════════════════════════════════════════════════════════════════════════════
'use client'
import AdminLayout from '@/components/AdminLayout'
import { BookOpen } from 'lucide-react'
import {
  TEACHER_GROUPS, STUDENT_GROUPS, PARENT_GROUPS, TEACHER_BADGES, STUDENT_BADGES, PARENT_BADGES,
  BADGE_ICON_PATHS, criteriaText, assignmentLabel,
  type BadgeDef, type BadgeIconKey,
} from '@/lib/badges'

const INK = '#1A1A1A', BORDER = '#E8E4DA', MUTED = '#9A9A8A', GOLD = '#B8952A'
const ACCENT: Record<string, string> = {
  trust: '#1B5E37', performance: '#B8952A', specialization: '#0F766E',
  progress: '#B8952A', attendance: '#1B5E37', achievement: '#B8952A',
}

function Icon({ icon, color, size = 20 }: { icon: BadgeIconKey; color: string; size?: number }) {
  const d = BADGE_ICON_PATHS[icon] || ''
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {d.split(' M').map((seg, i) => <path key={i} d={i === 0 ? seg : 'M' + seg} />)}
    </svg>
  )
}

function BadgeRow({ def }: { def: BadgeDef }) {
  const accent = ACCENT[def.category] || GOLD
  const auto = def.assignment === 'auto'
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 16px', border: `1px solid ${BORDER}`, borderRadius: 14, background: '#fff' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accent}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon icon={def.icon} color={accent} size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: INK }}>{def.name}</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', padding: '2px 8px', borderRadius: 20, background: auto ? 'rgba(22,163,74,0.1)' : 'rgba(99,102,241,0.1)', color: auto ? '#16A34A' : '#6366F1' }}>
            {assignmentLabel(def)}
          </span>
        </div>
        <p style={{ fontSize: 12.5, color: MUTED, margin: '4px 0 0', lineHeight: 1.45 }}>{def.description}</p>
        <p style={{ fontSize: 12.5, color: INK, margin: '6px 0 0', lineHeight: 1.45 }}>
          <span style={{ fontWeight: 700, color: accent }}>How it's earned: </span>{criteriaText(def)}
        </p>
      </div>
    </div>
  )
}

function Section({ title, groups, badges }: { title: string; groups: { category: string; label: string }[]; badges: BadgeDef[] }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: INK, margin: '0 0 14px', fontFamily: "'Fraunces',serif" }}>{title}</h2>
      {groups.map(g => {
        const inGroup = badges.filter(b => b.category === g.category)
        if (!inGroup.length) return null
        return (
          <div key={g.category} style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: GOLD, margin: '0 0 10px' }}>{g.label}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 12 }}>
              {inGroup.map(b => <BadgeRow key={b.key} def={b} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function BadgeGuidePage() {
  return (
    <AdminLayout>
      <div style={{ maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <BookOpen size={22} style={{ color: GOLD }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: INK, margin: 0, fontFamily: "'Fraunces',serif" }}>Badge Guide</h1>
        </div>
        <p style={{ color: MUTED, fontSize: 13, margin: '0 0 24px' }}>
          Every badge on the platform, how it's earned, and whether it's awarded automatically or assigned by an admin.
          Automatic badges update whenever a teacher is verified or a student completes lessons, attendance, or courses.
        </p>
        <Section title="Teacher Badges" groups={TEACHER_GROUPS} badges={TEACHER_BADGES} />
        <Section title="Student Badges" groups={STUDENT_GROUPS} badges={STUDENT_BADGES} />
        <Section title="Parent Badges" groups={PARENT_GROUPS} badges={PARENT_BADGES} />
      </div>
    </AdminLayout>
  )
}
