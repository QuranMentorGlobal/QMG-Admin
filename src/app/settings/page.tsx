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
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { fetchSettings() }, [])

  async function fetchSettings() {
    const supabase = createClient()
    const { data } = await supabase
      .from('platform_settings')
      .select('*')
      .single() as any
    if (data) {
      setSettings({
        commission_rate: data.commission_rate ?? 15,
        platform_name: data.platform_name ?? 'QuranMentorGlobal',
        contact_email: data.contact_email ?? 'info@quranmentorglobal.com',
        support_whatsapp: data.support_whatsapp ?? '',
        trial_enabled: data.trial_enabled ?? true,
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

  if (loading) return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />)}
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Platform Settings</h1>
          <p className="text-sm text-ink-light mt-1">Configure global platform settings</p>
        </div>

        {toast && (
          <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-semibold"
            style={{ background: '#1B5E37' }}>{toast}</div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">

          {/* Commission Rate */}
          <div className="p-6">
            <label className="block text-sm font-bold text-ink mb-1">Commission Rate (%)</label>
            <p className="text-xs text-ink-light mb-3">Percentage taken from each lesson payment</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="50"
                value={settings.commission_rate}
                onChange={e => setSettings({ ...settings, commission_rate: Number(e.target.value) })}
                className="w-32 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:border-green-DEFAULT text-center"
              />
              <span className="text-sm text-ink-light">% per lesson</span>
            </div>
          </div>

          {/* Platform Name */}
          <div className="p-6">
            <label className="block text-sm font-bold text-ink mb-1">Platform Name</label>
            <p className="text-xs text-ink-light mb-3">Used in emails and notifications</p>
            <input
              type="text"
              value={settings.platform_name}
              onChange={e => setSettings({ ...settings, platform_name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-DEFAULT"
            />
          </div>

          {/* Contact Email */}
          <div className="p-6">
            <label className="block text-sm font-bold text-ink mb-1">Contact Email</label>
            <p className="text-xs text-ink-light mb-3">Public contact email shown on the platform</p>
            <input
              type="email"
              value={settings.contact_email}
              onChange={e => setSettings({ ...settings, contact_email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-DEFAULT"
            />
          </div>

          {/* WhatsApp */}
          <div className="p-6">
            <label className="block text-sm font-bold text-ink mb-1">Support WhatsApp</label>
            <p className="text-xs text-ink-light mb-3">WhatsApp number for student/teacher support</p>
            <input
              type="text"
              value={settings.support_whatsapp}
              onChange={e => setSettings({ ...settings, support_whatsapp: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-DEFAULT"
              placeholder="+92-300-0000000"
            />
          </div>

          {/* Trial Lessons Toggle */}
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-ink">Trial Lessons</p>
                <p className="text-xs text-ink-light mt-0.5">Allow students to book trial lessons with teachers</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, trial_enabled: !settings.trial_enabled })}
                className="relative w-12 h-6 rounded-full transition-all flex-shrink-0"
                style={{ background: settings.trial_enabled ? '#1B5E37' : '#D1D5DB' }}>
                <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm"
                  style={{ left: settings.trial_enabled ? '28px' : '4px' }} />
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #1B5E37, #0D3D20)' }}>
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>

        <div className="mt-4 p-4 rounded-xl text-xs text-ink-light"
          style={{ background: '#F0E4B8' }}>
          💡 <strong>Note:</strong> The Settings page requires a <code>platform_settings</code> table in Supabase.
          Create it with columns: <code>id, commission_rate, platform_name, contact_email, support_whatsapp, trial_enabled</code>.
        </div>
      </div>
    </AdminLayout>
  )
}
