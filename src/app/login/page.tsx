'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setError('')
    setLoading(true)
    const supabase = createClient()

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      await supabase.auth.signOut()
      setError('Access denied. Admin accounts only.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0B0B] px-4"
      style={{ background: 'linear-gradient(135deg, #0B0B0B 0%, #B8952A 100%)' }}>
      
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10"
        style={{ background: '#B8952A', transform: 'translate(30%, -30%)' }} />
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10"
        style={{ background: '#B8952A', transform: 'translate(-30%, 30%)' }} />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-10">
          {/* Logo / Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: 'linear-gradient(135deg, #B8952A, #0B0B0B)' }}>
              <span className="text-2xl">🕌</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-[#141414]">QuranMentor<span style={{ color: '#B8952A' }}>Global</span></h1>
            <div className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase"
              style={{ background: '#F0E4B8', color: '#B8952A' }}>
              Admin Panel
            </div>
          </div>

          <h2 className="text-xl font-bold text-ink mb-1">Welcome back</h2>
          <p className="text-sm text-ink-light mb-7">Sign in to manage the platform</p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm font-medium"
              style={{ background: '#FEE2E2', color: '#DC2626' }}>
              ⚠️ {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-ink-mid mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@quranmentorglobal.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none transition-all focus:border-[#C8A24A] focus:ring-2 focus:ring-[#EFE2B5]"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-ink-mid mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none transition-all focus:border-[#C8A24A] focus:ring-2 focus:ring-[#EFE2B5]"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #B8952A, #0B0B0B)', boxShadow: '0 8px 24px rgba(184,149,42,0.35)' }}>
              {loading ? 'Signing in...' : 'Sign In to Admin Panel'}
            </button>
          </div>

          <p className="text-center text-xs text-ink-light mt-6">
            🔒 Restricted to authorized administrators only
          </p>
        </div>
      </div>
    </div>
  )
}
