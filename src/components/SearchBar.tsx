// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/components/SearchBar.tsx
// Unified search input used across every admin list page (identical styling).
// Goes full-width and centers on mobile.
// ============================================================
'use client'
import React from 'react'
import { Search } from 'lucide-react'

const INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A'

export default function SearchBar({
  value, onChange, placeholder = 'Search…', width = 320,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  width?: number | string
}) {
  const flexBasis = typeof width === 'number' ? `${width}px` : width
  return (
    <div className="qmg-searchbar" style={{ position: 'relative', flex: `0 1 ${flexBasis}`, minWidth: 200 }}>
      <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: MUTED }} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 13, background: '#fff', color: INK, outline: 'none' }}
      />
      <style>{`@media (max-width:640px){ .qmg-searchbar{ flex:1 1 100% !important; width:100%; } }`}</style>
    </div>
  )
}
