// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/settings/page.tsx
// Settings Center — 7 sections: Platform, Commission, Notifications, Branding,
// Security, User Permissions, Email. Saves via /api/platform-settings (which
// auto-skips any column that doesn't exist yet, so it never errors).
// ============================================================
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { Save, Settings as SettingsIcon, Percent, Bell, Palette, Shield, Users, Mail } from 'lucide-react'

const GOLD = '#B8952A', INK = '#1A1A1A', BORDER = '#E8E4DA', MUTED = '#9A9A8A', CREAM = '#F7F1E2', GREEN = '#16A34A'

type Field = { k: string; label: string; type: 'text' | 'number' | 'toggle' | 'color' | 'select' | 'textarea'; hint?: string; options?: string[] }
type Section = { id: string; label: string; icon: any; note?: string; fields: Field[] }

const SECTIONS: Section[] = [
  { id: 'platform', label: 'Platform', icon: SettingsIcon, fields: [
    { k: 'platform_name', label: 'Platform name', type: 'text' },
    { k: 'contact_email', label: 'Contact email', type: 'text' },
    { k: 'support_email', label: 'Support email', type: 'text' },
    { k: 'support_whatsapp', label: 'Support WhatsApp', type: 'text' },
    { k: 'timezone', label: 'Timezone', type: 'text', hint: 'e.g. UTC, Asia/Karachi' },
    { k: 'maintenance_mode', label: 'Maintenance mode', type: 'toggle', hint: 'Temporarily disable public access' },
  ] },
  { id: 'commission', label: 'Commission', icon: Percent, fields: [
    { k: 'commission_rate', label: 'Platform commission (%)', type: 'number', hint: 'Percentage taken from each lesson' },
    { k: 'min_payout_usd', label: 'Minimum payout (USD)', type: 'number' },
    { k: 'payout_schedule', label: 'Payout schedule', type: 'select', options: ['weekly', 'biweekly', 'monthly'] },
  ] },
  { id: 'notifications', label: 'Notifications', icon: Bell, fields: [
    { k: 'notify_new_teacher', label: 'New teacher applications', type: 'toggle' },
    { k: 'notify_new_ticket', label: 'New support tickets', type: 'toggle' },
    { k: 'notify_new_booking', label: 'New bookings', type: 'toggle' },
    { k: 'notify_failed_payment', label: 'Failed payments', type: 'toggle' },
  ] },
  { id: 'branding', label: 'Branding', icon: Palette, fields: [
    { k: 'brand_primary_color', label: 'Primary color', type: 'color' },
    { k: 'tagline', label: 'Tagline', type: 'text' },
    { k: 'brand_logo_url', label: 'Logo URL', type: 'text' },
  ] },
  { id: 'security', label: 'Security', icon: Shield, fields: [
    { k: 'require_2fa', label: 'Require 2FA for admins', type: 'toggle' },
    { k: 'allow_signups', label: 'Allow new sign-ups', type: 'toggle' },
    { k: 'session_timeout_mins', label: 'Session timeout (minutes)', type: 'number' },
  ] },
  { id: 'permissions', label: 'User Permissions', icon: Users, note: 'Granular admin role permissions are managed in Sub Admin Management.', fields: [
    { k: 'trial_enabled', label: 'Trial lessons enabled', type: 'toggle' },
    { k: 'max_trials_per_student', label: 'Max trials per student', type: 'number' },
    { k: 'auto_approve_teachers', label: 'Auto-approve new teachers', type: 'toggle' },
  ] },
  { id: 'email', label: 'Email', icon: Mail, fields: [
    { k: 'email_from_name', label: 'From name', type: 'text' },
    { k: 'email_from_address', label: 'From address', type: 'text' },
    { k: 'email_signature', label: 'Email signature', type: 'textarea' },
  ] },
]

const DEFAULTS: Record<string, any> = {
  platform_name: 'QuranMentorGlobal', contact_email: 'info@quranmentorglobal.com', support_email: '', support_whatsapp: '', timezone: 'UTC', maintenance_mode: false,
  commission_rate: 15, min_payout_usd: 50, payout_schedule: 'monthly',
  notify_new_teacher: true, notify_new_ticket: true, notify_new_booking: true, notify_failed_payment: true,
  brand_primary_color: '#B8952A', tagline: 'Learn · Connect · Grow', brand_logo_url: '',
  require_2fa: false, allow_signups: true, session_timeout_mins: 60,
  trial_enabled: true, max_trials_per_student: 1, auto_approve_teachers: false,
  email_from_name: 'QuranMentorGlobal', email_from_address: '', email_signature: '',
}

export default function SettingsPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [s, setS] = useState<Record<string, any>>(DEFAULTS)
  const [active, setActive] = useState('platform')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    (async () => { try { const sb = createClient(); const { data: { user } } = await sb.auth.getUser(); if (user) { const { data: p } = await sb.from('profiles').select('first_name').eq('id', user.id).single(); setAdminName((p as any)?.first_name || 'Admin') } } catch {} })()
    fetchSettings()
  }, [])

  async function fetchSettings() {
    const supabase = createClient()
    const { data } = await supabase.from('platform_settings').select('*').single() as any
    if (data) {
      const merged = { ...DEFAULTS }
      Object.keys(DEFAULTS).forEach(k => { if (data[k] !== undefined && data[k] !== null) merged[k] = data[k] })
      setS(merged)
    }
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/platform-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: s }) })
    const j = await res.json().catch(() => ({}))
    if (res.ok) setToast(j.stripped?.length ? `✅ Saved · ${j.stripped.length} field(s) need the DB migration` : '✅ Settings saved!')
    else setToast('❌ ' + (j.error || 'Action not permitted'))
    setTimeout(() => setToast(''), 3500)
    setSaving(false)
  }

  const set = (k: string, v: any) => setS(prev => ({ ...prev, [k]: v }))
  const section = SECTIONS.find(x => x.id === active)!

  const inputStyle: React.CSSProperties = { width: '100%', padding: '11px 14px', borderRadius: 11, border: `1.5px solid ${BORDER}`, fontSize: 14, outline: 'none', fontFamily: "'Inter',sans-serif", color: INK, background: '#fff', boxSizing: 'border-box' }

  if (loading) return (
    <AdminLayout adminName={adminName}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1, 2, 3].map(i => <div key={i} className="qmg-skel" style={{ height: 80 }} />)}</div>
      <style>{`.qmg-skel{background:linear-gradient(90deg,#F1ECE2 25%,#E8E2D6 50%,#F1ECE2 75%);background-size:200% 100%;animation:qmgsh 1.4s infinite;border-radius:14px}@keyframes qmgsh{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </AdminLayout>
  )

  return (
    <AdminLayout adminName={adminName}>
      {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, padding: '12px 18px', borderRadius: 12, background: toast.startsWith('✅') ? GOLD : '#DC2626', color: toast.startsWith('✅') ? '#1A1400' : '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>{toast}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 800, color: INK, margin: 0 }}>Settings</h1>
          <p style={{ fontSize: 13, color: '#6B6B6B', margin: '5px 0 0' }}>Configure your platform.</p>
        </div>
        <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer', background: GOLD, color: '#1A1400', fontSize: 13, fontWeight: 700, opacity: saving ? 0.6 : 1 }}><Save size={15} /> {saving ? 'Saving…' : 'Save changes'}</button>
      </div>

      <div className="qmg-set" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 18 }}>
        {/* Section nav */}
        <div className="qmg-set-nav" style={{ display: 'flex', flexDirection: 'column', gap: 4, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 8, alignSelf: 'flex-start' }}>
          {SECTIONS.map(sec => {
            const on = active === sec.id
            return (
              <button key={sec.id} onClick={() => setActive(sec.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', background: on ? CREAM : 'transparent', color: on ? INK : '#6B6B6B', fontSize: 13, fontWeight: on ? 700 : 600, fontFamily: "'Inter',sans-serif", transition: 'background .15s' }}>
                <sec.icon size={16} style={{ color: on ? GOLD : MUTED }} /> {sec.label}
              </button>
            )
          })}
        </div>

        {/* Section form */}
        <div className="adminx-rise" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: '22px 24px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 17, fontWeight: 800, color: INK, margin: '0 0 4px', fontFamily: "'Fraunces',serif" }}><section.icon size={18} style={{ color: GOLD }} /> {section.label}</h2>
          {section.note && <p style={{ fontSize: 12.5, color: MUTED, margin: '0 0 18px' }}>{section.note}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: section.note ? 0 : 14 }}>
            {section.fields.map(f => (
              <div key={f.k}>
                {f.type === 'toggle' ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                    <div>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: INK, margin: 0 }}>{f.label}</p>
                      {f.hint && <p style={{ fontSize: 12, color: MUTED, margin: '2px 0 0' }}>{f.hint}</p>}
                    </div>
                    <button onClick={() => set(f.k, !s[f.k])} aria-label={f.label} style={{ width: 46, height: 26, borderRadius: 99, border: 'none', cursor: 'pointer', background: s[f.k] ? GOLD : '#D8D2C4', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
                      <span style={{ position: 'absolute', top: 3, left: s[f.k] ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </button>
                  </div>
                ) : (
                  <>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: INK, marginBottom: f.hint ? 2 : 6 }}>{f.label}</label>
                    {f.hint && <p style={{ fontSize: 12, color: MUTED, margin: '0 0 8px' }}>{f.hint}</p>}
                    {f.type === 'textarea' ? (
                      <textarea value={s[f.k] ?? ''} onChange={e => set(f.k, e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                    ) : f.type === 'select' ? (
                      <select value={s[f.k] ?? ''} onChange={e => set(f.k, e.target.value)} style={inputStyle}>{f.options!.map(o => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}</select>
                    ) : f.type === 'color' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="color" value={s[f.k] || '#B8952A'} onChange={e => set(f.k, e.target.value)} style={{ width: 46, height: 40, borderRadius: 10, border: `1px solid ${BORDER}`, cursor: 'pointer', background: '#fff', padding: 2 }} />
                        <input type="text" value={s[f.k] ?? ''} onChange={e => set(f.k, e.target.value)} style={{ ...inputStyle, maxWidth: 160 }} />
                      </div>
                    ) : (
                      <input type={f.type === 'number' ? 'number' : 'text'} value={s[f.k] ?? ''} onChange={e => set(f.k, f.type === 'number' ? Number(e.target.value) : e.target.value)} style={inputStyle} />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .adminx-rise{animation:qmgrise .45s ease both}@keyframes qmgrise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @media(max-width:760px){ .qmg-set{grid-template-columns:1fr!important} .qmg-set-nav{flex-direction:row!important;overflow-x:auto;flex-wrap:nowrap} .qmg-set-nav button{white-space:nowrap} }
      `}</style>
    </AdminLayout>
  )
}
