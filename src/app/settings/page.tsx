// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/settings/page.tsx
// ------------------------------------------------------------
// Settings Center — professional, SaaS-style.
// 12 categories: General, Platform, Commission, Teacher, Student, Parent,
// Payment, Email, Notification, Security, Branding, Role & Permission.
//
// Backward compatible by design:
//  • Loads from `platform_settings` and merges over DEFAULTS (unknown/missing
//    columns just fall back to a default — never an error).
//  • Saves via /api/platform-settings, which already strips any column that
//    doesn't exist in the DB, so new fields are safe to add WITHOUT a migration.
//  • Existing keys (commission_rate, platform_name, etc.) are unchanged, so
//    nothing that already reads platform_settings breaks.
//
// Foundation (Phase 4): Teacher / Student / Parent categories ship with a few
// working controls plus a "foundation" flag, so more role settings can be added
// later by simply appending fields — no restructuring required.
// ============================================================
'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import {
  Save, Search, ChevronLeft, ChevronRight, AlertTriangle, X,
  Settings as SettingsIcon, SlidersHorizontal, Percent, GraduationCap, Users,
  Baby, CreditCard, Mail, Bell, Shield, Palette, KeyRound, ExternalLink,
} from 'lucide-react'

const GOLD = '#C9A227', INK = '#111111', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F8F5EE'

type FieldType = 'text' | 'number' | 'toggle' | 'color' | 'select' | 'textarea'
type Field = {
  k: string; label: string; type: FieldType; hint?: string; options?: string[]
  critical?: boolean        // requires confirmation before saving a change
  suffix?: string
}
type Category = {
  id: string; label: string; icon: any; description: string
  foundation?: boolean      // Phase 4 scaffold — expandable later
  note?: string
  fields: Field[]
}

// ── 12 professional categories ───────────────────────────────────────────────
const CATEGORIES: Category[] = [
  {
    id: 'general', label: 'General Settings', icon: SettingsIcon,
    description: 'Core identity and global defaults for the platform.',
    fields: [
      { k: 'platform_name', label: 'Platform name', type: 'text' },
      { k: 'tagline', label: 'Tagline', type: 'text', hint: 'Short line shown across the brand.' },
      { k: 'contact_email', label: 'Contact email', type: 'text' },
      { k: 'default_language', label: 'Default language', type: 'select', options: ['English', 'Arabic', 'Urdu'] },
      { k: 'timezone', label: 'Timezone', type: 'text', hint: 'e.g. UTC, Asia/Karachi' },
      { k: 'maintenance_mode', label: 'Maintenance mode', type: 'toggle', critical: true, hint: 'Temporarily disables public access to the platform.' },
    ],
  },
  {
    id: 'platform', label: 'Platform Settings', icon: SlidersHorizontal,
    description: 'Sign-ups, trials and platform-wide operational controls.',
    fields: [
      { k: 'support_email', label: 'Support email', type: 'text' },
      { k: 'support_whatsapp', label: 'Support WhatsApp', type: 'text' },
      { k: 'allow_signups', label: 'Allow new sign-ups', type: 'toggle', critical: true, hint: 'Turning this off blocks all new student/teacher/parent registrations.' },
      { k: 'trial_enabled', label: 'Trial lessons enabled', type: 'toggle' },
      { k: 'max_trials_per_student', label: 'Max trials per student', type: 'number' },
    ],
  },
  {
    id: 'commission', label: 'Commission Settings', icon: Percent,
    description: 'Platform commission and teacher payout rules.',
    fields: [
      { k: 'commission_rate', label: 'Platform commission', type: 'number', suffix: '%', critical: true, hint: 'Percentage the platform takes from each lesson. Changing this affects all new payouts.' },
      { k: 'min_payout_usd', label: 'Minimum payout', type: 'number', suffix: 'USD' },
      { k: 'payout_schedule', label: 'Payout schedule', type: 'select', options: ['weekly', 'biweekly', 'monthly'] },
    ],
  },
  {
    id: 'teacher', label: 'Teacher Settings', icon: GraduationCap,
    description: 'Onboarding, verification and default rules for teachers.',
    foundation: true,
    note: 'Foundation — more teacher controls can be added here later without restructuring.',
    fields: [
      { k: 'auto_approve_teachers', label: 'Auto-approve new teachers', type: 'toggle', critical: true, hint: 'When on, applications skip manual verification. Use with caution.' },
      { k: 'teacher_default_hourly_usd', label: 'Default hourly rate', type: 'number', suffix: 'USD' },
      { k: 'require_ijazah_document', label: 'Require Ijazah document', type: 'toggle', hint: 'Require an uploaded Ijazah certificate before approval.' },
    ],
  },
  {
    id: 'student', label: 'Student Settings', icon: Users,
    description: 'Booking limits and defaults for students.',
    foundation: true,
    note: 'Foundation — more student controls can be added here later without restructuring.',
    fields: [
      { k: 'student_free_trial_enabled', label: 'Free trial for students', type: 'toggle' },
      { k: 'student_max_active_bookings', label: 'Max active bookings', type: 'number' },
    ],
  },
  {
    id: 'parent', label: 'Parent Settings', icon: Baby,
    description: 'Family accounts and child management defaults.',
    foundation: true,
    note: 'Foundation — more parent controls can be added here later without restructuring.',
    fields: [
      { k: 'parent_max_children', label: 'Max children per parent', type: 'number' },
      { k: 'parent_booking_approval', label: 'Parent must approve bookings', type: 'toggle' },
    ],
  },
  {
    id: 'payment', label: 'Payment Settings', icon: CreditCard,
    description: 'Currencies and the payment providers you accept.',
    fields: [
      { k: 'default_currency', label: 'Default currency', type: 'select', options: ['USD', 'GBP', 'EUR', 'PKR', 'AED', 'SAR'] },
      { k: 'stripe_enabled', label: 'Stripe (cards)', type: 'toggle' },
      { k: 'jazzcash_enabled', label: 'JazzCash wallet', type: 'toggle' },
      { k: 'easypaisa_enabled', label: 'Easypaisa wallet', type: 'toggle' },
    ],
  },
  {
    id: 'email', label: 'Email Settings', icon: Mail,
    description: 'Sender identity used for transactional email.',
    fields: [
      { k: 'email_from_name', label: 'From name', type: 'text' },
      { k: 'email_from_address', label: 'From address', type: 'text' },
      { k: 'email_signature', label: 'Email signature', type: 'textarea' },
    ],
  },
  {
    id: 'notifications', label: 'Notification Settings', icon: Bell,
    description: 'Which admin alerts are generated for key events.',
    fields: [
      { k: 'notify_new_teacher', label: 'New teacher applications', type: 'toggle' },
      { k: 'notify_new_ticket', label: 'New support tickets', type: 'toggle' },
      { k: 'notify_new_booking', label: 'New bookings', type: 'toggle' },
      { k: 'notify_failed_payment', label: 'Failed payments', type: 'toggle' },
    ],
  },
  {
    id: 'security', label: 'Security Settings', icon: Shield,
    description: 'Authentication, sessions and account protection.',
    fields: [
      { k: 'require_2fa', label: 'Require 2FA for admins', type: 'toggle', critical: true, hint: 'All admins must set up two-factor authentication on next sign-in.' },
      { k: 'session_timeout_mins', label: 'Session timeout', type: 'number', suffix: 'mins' },
      { k: 'password_min_length', label: 'Minimum password length', type: 'number' },
    ],
  },
  {
    id: 'branding', label: 'Branding Settings', icon: Palette,
    description: 'Colours and logo used across the platform.',
    fields: [
      { k: 'brand_primary_color', label: 'Primary colour', type: 'color' },
      { k: 'brand_accent_color', label: 'Accent colour', type: 'color' },
      { k: 'brand_logo_url', label: 'Logo URL', type: 'text' },
    ],
  },
  {
    id: 'roles', label: 'Role & Permission Settings', icon: KeyRound,
    description: 'How admin roles and granular permissions are governed.',
    note: 'Individual sub-admin roles and permissions are managed in Admin Management.',
    fields: [
      { k: 'enforce_permission_audit', label: 'Log all permission changes', type: 'toggle', hint: 'Record every role/permission change in the audit log.' },
      { k: 'sub_admin_self_signup', label: 'Allow sub-admin self sign-up', type: 'toggle', critical: true, hint: 'When off (recommended), only super admins can create sub-admins.' },
    ],
  },
]

// ── Defaults (commission default is now 20%) ─────────────────────────────────
const DEFAULTS: Record<string, any> = {
  // general
  platform_name: 'Muddarris', tagline: 'Learn · Connect · Grow',
  contact_email: 'contact@muddarris.com', default_language: 'English',
  timezone: 'UTC', maintenance_mode: false,
  // platform
  support_email: '', support_whatsapp: '', allow_signups: true,
  trial_enabled: true, max_trials_per_student: 1,
  // commission
  commission_rate: 20, min_payout_usd: 50, payout_schedule: 'monthly',
  // teacher
  auto_approve_teachers: false, teacher_default_hourly_usd: 15, require_ijazah_document: false,
  // student
  student_free_trial_enabled: true, student_max_active_bookings: 5,
  // parent
  parent_max_children: 5, parent_booking_approval: true,
  // payment
  default_currency: 'USD', stripe_enabled: true, jazzcash_enabled: false, easypaisa_enabled: false,
  // email
  email_from_name: 'Muddarris', email_from_address: '', email_signature: '',
  // notifications
  notify_new_teacher: true, notify_new_ticket: true, notify_new_booking: true, notify_failed_payment: true,
  // security
  require_2fa: false, session_timeout_mins: 60, password_min_length: 8,
  // branding
  brand_primary_color: '#C9A227', brand_accent_color: '#1B5E37', brand_logo_url: '',
  // roles
  enforce_permission_audit: true, sub_admin_self_signup: false,
}

const ALL_FIELDS: Field[] = CATEGORIES.flatMap(c => c.fields)
const fieldLabel = (k: string) => ALL_FIELDS.find(f => f.k === k)?.label || k
const fmtVal = (v: any) => v === true ? 'On' : v === false ? 'Off' : String(v)

export default function SettingsPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [s, setS] = useState<Record<string, any>>(DEFAULTS)
  const [baseline, setBaseline] = useState<Record<string, any>>(DEFAULTS)
  const [active, setActive] = useState<string | null>(null)   // null = category cards landing
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [confirmList, setConfirmList] = useState<{ k: string; from: any; to: any }[] | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const sb = createClient(); const { data: { user } } = await sb.auth.getUser()
        if (user) { const { data: p } = await sb.from('profiles').select('first_name').eq('id', user.id).single(); setAdminName((p as any)?.first_name || 'Admin') }
      } catch {}
    })()
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/platform-settings')
      const data = res.ok ? await res.json() : null
      const merged = { ...DEFAULTS }
      if (data) Object.keys(DEFAULTS).forEach(k => { if (data[k] !== undefined && data[k] !== null) merged[k] = data[k] })
      setS(merged); setBaseline(merged)
    } catch {}
    setLoading(false)
  }

  const set = (k: string, v: any) => setS(prev => ({ ...prev, [k]: v }))

  // Which critical fields changed vs the last loaded/saved baseline?
  const criticalChanges = useMemo(() => {
    const critKeys = ALL_FIELDS.filter(f => f.critical).map(f => f.k)
    return critKeys
      .filter(k => String(s[k]) !== String(baseline[k]))
      .map(k => ({ k, from: baseline[k], to: s[k] }))
  }, [s, baseline])

  function attemptSave() {
    if (criticalChanges.length > 0) { setConfirmList(criticalChanges); return }
    doSave()
  }

  async function doSave() {
    setConfirmList(null); setSaving(true)
    try {
      const res = await fetch('/api/platform-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: s }) })
      const j = await res.json().catch(() => ({}))
      if (res.ok) { setToast(j.stripped?.length ? `✅ Saved · ${j.stripped.length} field(s) await the DB migration` : '✅ Settings saved!'); setBaseline(s) }
      else setToast('❌ ' + (j.error || 'Action not permitted'))
    } catch { setToast('❌ Could not save settings') }
    setTimeout(() => setToast(''), 3800)
    setSaving(false)
  }

  // Search filters categories by label / description / field labels.
  const q = query.trim().toLowerCase()
  const filtered = !q ? CATEGORIES : CATEGORIES.filter(c =>
    c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) ||
    c.fields.some(f => f.label.toLowerCase().includes(q)))

  const activeCat = active ? CATEGORIES.find(c => c.id === active) || null : null
  const inputStyle: React.CSSProperties = { width: '100%', padding: '11px 14px', borderRadius: 11, border: `1.5px solid ${BORDER}`, fontSize: 14, outline: 'none', fontFamily: "'Inter',sans-serif", color: INK, background: '#fff', boxSizing: 'border-box' }

  if (loading) return (
    <AdminLayout adminName={adminName}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1, 2, 3].map(i => <div key={i} className="qmg-skel" style={{ height: 80 }} />)}</div>
      <style>{`.qmg-skel{background:linear-gradient(90deg,#F1ECE2 25%,#E8E2D6 50%,#F1ECE2 75%);background-size:200% 100%;animation:qmgsh 1.4s infinite;border-radius:14px}@keyframes qmgsh{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </AdminLayout>
  )

  return (
    <AdminLayout adminName={adminName}>
      {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 90, padding: '12px 18px', borderRadius: 12, background: toast.startsWith('✅') ? 'linear-gradient(135deg,#166534,#C9A227)' : '#DC2626', color: toast.startsWith('✅') ? '#111111' : '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>{toast}</div>}

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 800, color: INK, margin: 0 }}>Platform Settings</h1>
          <p style={{ fontSize: 13, color: '#6B6B6B', margin: '5px 0 0' }}>Configure your platform across {CATEGORIES.length} categories.</p>
        </div>
        <button onClick={attemptSave} disabled={saving} className="qmg-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#166534,#C9A227)', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
          <Save size={15} /> {saving ? 'Saving…' : 'Save changes'}
          {criticalChanges.length > 0 && !saving && <span style={{ background: '#111111', color: GOLD, borderRadius: 99, fontSize: 11, fontWeight: 800, padding: '1px 7px' }}>{criticalChanges.length}</span>}
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 18, maxWidth: 460 }}>
        <Search size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: MUTED }} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); if (e.target.value) setActive(null) }}
          placeholder="Search settings…"
          style={{ ...inputStyle, paddingLeft: 38 }}
        />
        {query && <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: MUTED, display: 'flex' }}><X size={15} /></button>}
      </div>

      {/* ── Category cards landing (or search results) ── */}
      {!activeCat && (
        filtered.length === 0 ? (
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 40, textAlign: 'center', color: MUTED, fontSize: 14 }}>
            No settings match “{query}”.
          </div>
        ) : (
          <div className="qmg-cards">
            {filtered.map(c => {
              const dirty = c.fields.some(f => String(s[f.k]) !== String(baseline[f.k]))
              return (
                <button key={c.id} onClick={() => { setActive(c.id); setQuery('') }} className="qmg-card adminx-rise">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="qmg-card-ic"><c.icon size={20} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 800, color: INK }}>{c.label}</span>
                        {c.foundation && <span className="qmg-tag-found">Foundation</span>}
                        {dirty && <span className="qmg-tag-dirty">Unsaved</span>}
                      </div>
                      <p style={{ fontSize: 12.5, color: '#6B6B6B', margin: '3px 0 0', lineHeight: 1.4 }}>{c.description}</p>
                    </div>
                    <ChevronRight size={18} style={{ color: MUTED, flexShrink: 0 }} />
                  </div>
                  <div style={{ marginTop: 12, fontSize: 11.5, fontWeight: 700, color: MUTED, letterSpacing: '.02em' }}>
                    {c.fields.length} {c.fields.length === 1 ? 'option' : 'options'}
                  </div>
                </button>
              )
            })}
          </div>
        )
      )}

      {/* ── Single category form ── */}
      {activeCat && (
        <div className="adminx-rise">
          <button onClick={() => setActive(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#6B6B6B', fontSize: 13, fontWeight: 700, marginBottom: 14, padding: 0 }}>
            <ChevronLeft size={16} /> All settings
          </button>

          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginBottom: 6 }}>
              <span className="qmg-card-ic" style={{ width: 42, height: 42 }}><activeCat.icon size={20} /></span>
              <div style={{ flex: 1 }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 18, fontWeight: 800, color: INK, margin: 0, fontFamily: "'Fraunces',serif" }}>
                  {activeCat.label}
                  {activeCat.foundation && <span className="qmg-tag-found">Foundation</span>}
                </h2>
                <p style={{ fontSize: 13, color: '#6B6B6B', margin: '4px 0 0' }}>{activeCat.description}</p>
              </div>
            </div>

            {activeCat.note && (
              <div style={{ background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px', fontSize: 12.5, color: '#6B5A2A', margin: '14px 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span>{activeCat.note}</span>
                {activeCat.id === 'roles' && <a href="/admin-management" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: GOLD, fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap' }}>Open <ExternalLink size={13} /></a>}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 18 }}>
              {activeCat.fields.map(f => (
                <div key={f.k}>
                  {f.type === 'toggle' ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 700, color: INK, margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                          {f.label}{f.critical && <span className="qmg-tag-crit">Critical</span>}
                        </p>
                        {f.hint && <p style={{ fontSize: 12, color: MUTED, margin: '2px 0 0', lineHeight: 1.4 }}>{f.hint}</p>}
                      </div>
                      <button onClick={() => set(f.k, !s[f.k])} aria-label={f.label} style={{ width: 46, height: 26, borderRadius: 99, border: 'none', cursor: 'pointer', background: s[f.k] ? 'linear-gradient(135deg,#166534,#C9A227)' : '#D8D2C4', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
                        <span style={{ position: 'absolute', top: 3, left: s[f.k] ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: INK, marginBottom: f.hint ? 2 : 6 }}>
                        {f.label}{f.critical && <span className="qmg-tag-crit">Critical</span>}
                      </label>
                      {f.hint && <p style={{ fontSize: 12, color: MUTED, margin: '0 0 8px', lineHeight: 1.4 }}>{f.hint}</p>}
                      {f.type === 'textarea' ? (
                        <textarea value={s[f.k] ?? ''} onChange={e => set(f.k, e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                      ) : f.type === 'select' ? (
                        <select value={s[f.k] ?? ''} onChange={e => set(f.k, e.target.value)} style={inputStyle}>{f.options!.map(o => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}</select>
                      ) : f.type === 'color' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input type="color" value={s[f.k] || '#C9A227'} onChange={e => set(f.k, e.target.value)} style={{ width: 46, height: 40, borderRadius: 10, border: `1px solid ${BORDER}`, cursor: 'pointer', background: '#fff', padding: 2 }} />
                          <input type="text" value={s[f.k] ?? ''} onChange={e => set(f.k, e.target.value)} style={{ ...inputStyle, maxWidth: 160 }} />
                        </div>
                      ) : (
                        <div style={{ position: 'relative', maxWidth: f.type === 'number' ? 220 : '100%' }}>
                          <input type={f.type === 'number' ? 'number' : 'text'} value={s[f.k] ?? ''} onChange={e => set(f.k, f.type === 'number' ? Number(e.target.value) : e.target.value)} style={{ ...inputStyle, paddingRight: f.suffix ? 54 : 14 }} />
                          {f.suffix && <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 12.5, fontWeight: 700, color: MUTED }}>{f.suffix}</span>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation dialog for critical changes ── */}
      {confirmList && (
        <div className="qmg-overlay" onClick={() => setConfirmList(null)}>
          <div className="qmg-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><AlertTriangle size={18} /></span>
              <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 800, color: INK, margin: 0 }}>Confirm critical changes</h3>
            </div>
            <p style={{ fontSize: 13, color: '#6B6B6B', margin: '0 0 14px' }}>These changes affect how the platform operates. Please confirm before saving.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {confirmList.map(c => (
                <div key={c.k} style={{ background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px', fontSize: 13 }}>
                  <span style={{ fontWeight: 800, color: INK }}>{fieldLabel(c.k)}</span>
                  <div style={{ marginTop: 3, color: '#6B6B6B', fontSize: 12.5 }}>
                    <span style={{ textDecoration: 'line-through' }}>{fmtVal(c.from)}</span>
                    <ChevronRight size={12} style={{ verticalAlign: 'middle', margin: '0 3px' }} />
                    <span style={{ fontWeight: 800, color: GOLD }}>{fmtVal(c.to)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmList(null)} style={{ padding: '9px 16px', borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fff', color: '#6B6B6B', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={doSave} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#166534,#C9A227)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Confirm & Save</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .adminx-rise{animation:qmgrise .4s ease both}@keyframes qmgrise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .qmg-cards{display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:14px}
        @media(max-width:1024px){.qmg-cards{grid-template-columns:repeat(2, minmax(0, 1fr))}}
        @media(max-width:600px){.qmg-cards{grid-template-columns:1fr}}
        .qmg-card{text-align:left;background:#fff;border:1px solid ${BORDER};border-radius:16px;padding:18px;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
        .qmg-card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(201,162,39,.14);border-color:rgba(201,162,39,.5)}
        .qmg-card-ic{width:40px;height:40px;border-radius:12px;background:${CREAM};color:${GOLD};display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .qmg-tag-found{font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#1B5E37;background:#E3F0E7;border:1px solid #C5E0CE;border-radius:99px;padding:1px 7px}
        .qmg-tag-dirty{font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#B45309;background:#FEF3C7;border-radius:99px;padding:1px 7px}
        .qmg-tag-crit{font-size:9.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#B91C1C;background:#FEE2E2;border-radius:99px;padding:1px 6px}
        .qmg-overlay{position:fixed;inset:0;background:rgba(15,15,15,.5);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:18px;z-index:95;animation:qmgfade .15s ease both}
        @keyframes qmgfade{from{opacity:0}to{opacity:1}}
        .qmg-modal{width:min(460px,94vw);background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.3);padding:22px 22px 20px;animation:qmgrise .25s ease both}
      `}</style>
    </AdminLayout>
  )
}
