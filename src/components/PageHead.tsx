// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/components/PageHead.tsx
// Unified page header used across admin pages: title + subtitle on the left,
// search box + actions on the right, and the date RangeTabs below. Full-width,
// and on mobile everything stacks and centers. This is the single source of
// truth for page-header layout so every page reads the same.
// ============================================================
'use client'
import RangeTabs from '@/components/RangeTabs'
import { Search } from 'lucide-react'

const INK = '#111111', MUTED = '#9A9A8A', BORDER = '#E8E4DA'

interface SearchCfg { value: string; onChange: (v: string) => void; placeholder?: string }
interface RangeCfg {
  value: string; onChange: (v: string) => void
  from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void
}

export default function PageHead({
  title, subtitle, search, range, actions,
}: {
  title: string
  subtitle?: React.ReactNode
  search?: SearchCfg
  range?: RangeCfg
  actions?: React.ReactNode
}) {
  return (
    <div className="admin-head">
      <style>{`
        .admin-head { width: 100%; margin-bottom: 16px; }
        .admin-head-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
        .admin-head-tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .admin-head-search { position: relative; }
        .admin-head-search input {
          padding: 10px 14px 10px 36px; border-radius: 11px; border: 1px solid ${BORDER};
          font-size: 13px; color: ${INK}; background: #fff; outline: none; width: 256px; max-width: 100%;
        }
        .admin-head-search input:focus { border-color: #C9A227; }
        .admin-head-range { margin-top: 12px; }
        @media (max-width: 640px) {
          .admin-head-top { flex-direction: column; align-items: center; text-align: center; }
          .admin-head-titles { width: 100%; }
          .admin-head-tools { width: 100%; justify-content: center; }
          .admin-head-search { flex: 1 1 100%; }
          .admin-head-search input { width: 100%; }
          .admin-head-range { display: flex; justify-content: center; flex-wrap: wrap; }
        }
      `}</style>

      <div className="admin-head-top">
        <div className="admin-head-titles">
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 800, color: INK, margin: 0 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 13, color: MUTED, margin: '3px 0 0' }}>{subtitle}</p>}
        </div>

        {(search || actions) && (
          <div className="admin-head-tools">
            {search && (
              <div className="admin-head-search">
                <Search size={16} color={MUTED} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  value={search.value}
                  onChange={e => search.onChange(e.target.value)}
                  placeholder={search.placeholder || 'Search…'}
                />
              </div>
            )}
            {actions}
          </div>
        )}
      </div>

      {range && (
        <div className="admin-head-range">
          <RangeTabs
            value={range.value} onChange={range.onChange}
            from={range.from} to={range.to}
            onFromChange={range.onFrom} onToChange={range.onTo}
          />
        </div>
      )}
    </div>
  )
}
