// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/components/RangeTabs.tsx
// Unified date-range filter used across every admin list/analytics page.
// Matches the Admin Dashboard control exactly (charcoal active pill, gold-free
// neutral rail). Also exports helpers to filter any list by a date field.
// ============================================================
'use client'
import React from 'react'

const INK = '#111111', BORDER = '#E8E4DA'

export const RANGE_OPTIONS = [
  { key: '7', label: '7 Days' },
  { key: '30', label: '30 Days' },
  { key: '90', label: '90 Days' },
  { key: '365', label: '1 Year' },
  { key: 'all', label: 'All Time' },
]

// Epoch-ms cutoff for a range key. null = all time (no filtering).
export function rangeCutoff(range: string): number | null {
  if (!range || range === 'all') return null
  const days = Number(range) || 30
  return Date.now() - days * 24 * 60 * 60 * 1000
}

// Client-side helper: keep rows whose date field is within the selected range.
// If NO row yields a parseable date (the field is absent in this dataset), the
// range is treated as a no-op so the page is never accidentally blanked.
export function withinRange<T>(rows: T[], range: string, getDate: (r: T) => string | number | null | undefined): T[] {
  const cut = rangeCutoff(range)
  if (cut == null) return rows
  let anyValid = false
  const out = rows.filter(r => {
    const v = getDate(r)
    if (!v) return false
    const t = new Date(v as any).getTime()
    if (!Number.isFinite(t)) return false
    anyValid = true
    return t >= cut
  })
  return anyValid ? out : rows
}

export default function RangeTabs({
  value, onChange, options = RANGE_OPTIONS,
}: {
  value: string
  onChange: (v: string) => void
  options?: { key: string; label: string }[]
}) {
  return (
    <div style={{ display: 'inline-flex', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 4, gap: 2, flexWrap: 'wrap' }}>
      {options.map(r => {
        const on = value === r.key
        return (
          <button key={r.key} onClick={() => onChange(r.key)} style={{
            border: 'none', cursor: 'pointer', padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700,
            fontFamily: "'Inter',sans-serif", background: on ? INK : 'transparent', color: on ? '#fff' : '#6B6B6B', transition: 'all .15s',
          }}>{r.label}</button>
        )
      })}
    </div>
  )
}
