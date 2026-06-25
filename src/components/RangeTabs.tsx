// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/components/RangeTabs.tsx
// Unified date filter used across every admin list/analytics page.
// Preset pills (7/30/90/365/All) PLUS an optional From → To custom window.
// Matches the Admin Dashboard control. Centers itself on mobile.
// ============================================================
'use client'
import React from 'react'

const INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A'

export const RANGE_OPTIONS = [
  { key: '7', label: '7 Days' },
  { key: '30', label: '30 Days' },
  { key: '90', label: '90 Days' },
  { key: '365', label: '1 Year' },
  { key: 'all', label: 'All Time' },
]

// Epoch-ms cutoff for a preset range key. null = all time (no filtering).
export function rangeCutoff(range: string): number | null {
  if (!range || range === 'all') return null
  const days = Number(range) || 30
  return Date.now() - days * 24 * 60 * 60 * 1000
}

// Client-side filter. If an explicit from/to window is supplied (YYYY-MM-DD),
// it takes precedence over the preset range. If NO row yields a parseable date
// (the field is absent in this dataset), the filter is a no-op so the page is
// never accidentally blanked.
export function withinRange<T>(
  rows: T[],
  range: string,
  getDate: (r: T) => string | number | null | undefined,
  from?: string,
  to?: string,
): T[] {
  const hasCustom = !!((from && from.length) || (to && to.length))

  if (!hasCustom) {
    const cut = rangeCutoff(range)
    if (cut == null) return rows
    let anyValid = false
    const out = rows.filter(r => {
      const v = getDate(r); if (!v) return false
      const t = new Date(v as any).getTime(); if (!Number.isFinite(t)) return false
      anyValid = true; return t >= cut
    })
    return anyValid ? out : rows
  }

  const fromT = from ? new Date(from + 'T00:00:00').getTime() : -Infinity
  const toT = to ? new Date(to + 'T23:59:59').getTime() : Infinity
  let anyValid = false
  const out = rows.filter(r => {
    const v = getDate(r); if (!v) return false
    const t = new Date(v as any).getTime(); if (!Number.isFinite(t)) return false
    anyValid = true; return t >= fromT && t <= toT
  })
  return anyValid ? out : rows
}

const dateInput: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 10, border: `1px solid ${BORDER}`,
  fontSize: 12.5, color: INK, background: '#fff', outline: 'none',
}

export default function RangeTabs({
  value, onChange, options = RANGE_OPTIONS,
  from, to, onFromChange, onToChange,
}: {
  value: string
  onChange: (v: string) => void
  options?: { key: string; label: string }[]
  from?: string
  to?: string
  onFromChange?: (v: string) => void
  onToChange?: (v: string) => void
}) {
  const showCustom = !!(onFromChange || onToChange)
  const customActive = !!((from && from.length) || (to && to.length))

  return (
    <div className="qmg-rangetabs" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div style={{ display: 'inline-flex', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 4, gap: 2, flexWrap: 'wrap' }}>
        {options.map(r => {
          const on = value === r.key && !customActive
          return (
            <button key={r.key} onClick={() => { onChange(r.key); onFromChange?.(''); onToChange?.('') }} style={{
              border: 'none', cursor: 'pointer', padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700,
              fontFamily: "'Inter',sans-serif", background: on ? INK : 'transparent', color: on ? '#fff' : '#6B6B6B', transition: 'all .15s',
            }}>{r.label}</button>
          )
        })}
      </div>

      {showCustom && (
        <div className="qmg-rangetabs-custom" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <input type="date" value={from || ''} onChange={e => onFromChange?.(e.target.value)} title="From date" style={dateInput} />
          <span style={{ color: MUTED, fontSize: 13 }}>→</span>
          <input type="date" value={to || ''} onChange={e => onToChange?.(e.target.value)} title="To date" style={dateInput} />
          {customActive && (
            <button onClick={() => { onFromChange?.(''); onToChange?.('') }} style={{ padding: '7px 10px', borderRadius: 9, border: `1px solid ${BORDER}`, background: '#fff', fontSize: 12, fontWeight: 700, color: '#6B6B6B', cursor: 'pointer' }}>Clear</button>
          )}
        </div>
      )}

      <style>{`@media (max-width:640px){
        .qmg-rangetabs{ width:100%; justify-content:center; }
        .qmg-rangetabs-custom{ width:100%; justify-content:center; }
      }`}</style>
    </div>
  )
}
