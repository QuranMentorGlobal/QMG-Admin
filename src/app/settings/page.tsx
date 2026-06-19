'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { Save } from 'lucide-react'

type Settings = {
  commission_rate: number
  platform_name: string
  contact_email: string
  support_whatsapp: string
  trial_enabled: boolean
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    commission_rate: 15,
    platform_name: 'QuranMentorGlobal',
    contact_email: 'info@quranmentorglobal.com',
    support_whatsapp: '+92-300-0000000',
    trial_enabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState('')

  useEffect(() => { fetchSettings() }, [])

  async function fetchSettings() {
    const supabase = createClient()
    const { data } = await supabase.from('platform_settings').select('*').single() as any
    if (data) {
      setSettings({
        commission_rate:  data.commission_rate  ?? 15,
        platform_name:    data.platform_name    ?? 'QuranMentorGlobal',
        contact_email:    data.contact_email    ?? 'info@quranmentorglobal.com',
        support_whatsapp: data.support_whatsapp ?? '',
        trial_enabled:    data.trial_enabled    ?? true,
      })
    }
    setLoading(false)
  }

  async function saveSettings() {
    setSaving(true)
    const supabase = createClient()
    const { data: existing } = await supabase.from('platform_settings').select('id').single() as any
    if (existing?.id) {
      await (supabase.from('platform_settings') as any).update(settings).eq('id', existing.id)
    } else {
      await (supabase.from('platform_settings') as any).insert(settings)
    }
    setToast('✅ Settings saved!')
    setTimeout(() => setToast(''), 3000)
    setSaving(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 16px', borderRadius: 12,
    border: '1.5px solid #E8E4DA', fontSize: 14, outline: 'none',
    fontFamily: "'Inter', sans-serif", color: '#1A1A1A', background: '#fff',
    transition: 'border-color 0.15s',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 700,
    color: '#1A1A1A', marginBottom: 4, fontFamily: "'Inter', sans-serif",
  }

  const hintStyle: React.CSSProperties = {
    fontSize: 12, color: '#9A9A8A', marginBottom: 10,
    fontFamily: "'Inter', sans-serif",
  }

  if (loading) return (
    <AdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1,2,3].map(i => <div key={i} style={{ background: '#fff', borderRadius: 16, height: 80, border: '1px solid #E8E4DA', animation: 'pulse 1.5s infinite' }} />)}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, padding: '12px 20px', borderRadius: 12, background: '#B8952A', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
          {toast}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>Platform Settings</h1>
        <p style={{ fontSize: 13, color: '#6B6B6B', marginTop: 4 }}>Configure global platform settings</p>
      </div>

      {/* Two-column layout on wide screens, single column on mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}
        className="settings-grid">

        {/* Commission Rate */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', border: '1px solid #E8E4DA', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <label style={labelStyle}>Commission Rate (%)</label>
          <p style={hintStyle}>Percentage taken from each lesson payment</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="number" min="0" max="50"
              value={settings.commission_rate}
              onChange={e => setSettings({ ...settings, commission_rate: Number(e.target.value) })}
              style={{ ...inputStyle, width: 120, textAlign: 'center', fontWeight: 800, fontSize: 20, color: '#B8952A' }}
            />
            <span style={{ fontSize: 14, color: '#6B6B6B', fontWeight: 600 }}>% per lesson</span>
          </div>
        </div>

        {/* Platform Name */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', border: '1px solid #E8E4DA', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <label style={labelStyle}>Platform Name</label>
          <p style={hintStyle}>Used in emails and notifications</p>
          <input
            type="text"
            value={settings.platform_name}
            onChange={e => setSettings({ ...settings, platform_name: e.target.value })}
            style={inputStyle}
            onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#B8952A'}
            onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#E8E4DA'}
          />
        </div>

        {/* Contact Email */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', border: '1px solid #E8E4DA', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <label style={labelStyle}>Contact Email</label>
          <p style={hintStyle}>Public contact email shown on the platform</p>
          <input
            type="email"
            value={settings.contact_email}
            onChange={e => setSettings({ ...settings, contact_email: e.target.value })}
            style={inputStyle}
            onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#B8952A'}
            onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#E8E4DA'}
          />
        </div>

        {/* WhatsApp */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', border: '1px solid #E8E4DA', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <label style={labelStyle}>Support WhatsApp</label>
          <p style={hintStyle}>WhatsApp number for student/teacher support</p>
          <input
            type="text"
            value={settings.support_whatsapp}
            onChange={e => setSettings({ ...settings, support_whatsapp: e.target.value })}
            style={inputStyle}
            placeholder="+92-300-0000000"
            onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#B8952A'}
            onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#E8E4DA'}
          />
        </div>
      </div>

      {/* Trial toggle — full width */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', border: '1px solid #E8E4DA', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: 0, fontFamily: "'Inter',sans-serif" }}>Trial Lessons</p>
            <p style={{ fontSize: 12, color: '#9A9A8A', margin: '4px 0 0' }}>Allow students to book free trial lessons with teachers</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, trial_enabled: !settings.trial_enabled })}
            style={{
              width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
              background: settings.trial_enabled ? '#B8952A' : '#D1D5DB',
              position: 'relative', flexShrink: 0, transition: 'background 0.2s',
            }}>
            <div style={{
              position: 'absolute', top: 3, width: 22, height: 22,
              background: '#fff', borderRadius: '50%', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              transition: 'left 0.2s',
              left: settings.trial_enabled ? 27 : 3,
            }} />
          </button>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={saveSettings}
        disabled={saving}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '14px', borderRadius: 14, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
          background: 'linear-gradient(135deg, rgb(184,149,42), rgb(212,175,80))',
          color: '#ffffff', fontWeight: 800, fontSize: 15, fontFamily: "'Inter',sans-serif",
          opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s', marginBottom: 14,
        }}>
        <Save size={17} />
        {saving ? 'Saving…' : 'Save Settings'}
      </button>

      {/* Note */}
      <div style={{ padding: '14px 18px', borderRadius: 12, background: '#F0E4B8', fontSize: 12, color: '#6B5A1E', fontFamily: "'Inter',sans-serif", lineHeight: 1.6 }}>
        💡 <strong>Note:</strong> The Settings page requires a <code>platform_settings</code> table in Supabase with columns:{' '}
        <code>id, commission_rate, platform_name, contact_email, support_whatsapp, trial_enabled</code>.
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @media(max-width:700px){ .settings-grid{ grid-template-columns: 1fr !important; } }
      `}</style>
    </AdminLayout>
  )
}
