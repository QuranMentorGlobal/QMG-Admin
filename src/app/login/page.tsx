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

  // --- 2FA challenge state ---
  // Once password is correct AND the account has a verified TOTP factor,
  // we pause here and ask for the 6-digit code before granting access.
  const [needsMfa, setNeedsMfa] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)

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

    // Authoritative admin check via the service role (RLS-proof). Only accounts
    // with role='admin' and an active admin_status may enter the panel.
    let ok = false
    try { const res = await fetch('/api/auth-check'); const j = await res.json(); ok = !!j.ok } catch {}
    if (!ok) {
      await supabase.auth.signOut()
      setError('Access denied. This panel is for administrators only.')
      setLoading(false)
      return
    }

    // --- 2FA gate ---
    // Password + admin check passed. Now see if this account has a verified
    // TOTP factor enrolled. If so, we must not let them in until they prove
    // possession of the authenticator (AAL2). If not enrolled, let them
    // through as before so no one is locked out before they've set it up.
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const verified = (factors?.totp || []).find((f: any) => f.status === 'verified')
      if (verified) {
        setFactorId(verified.id)
        setNeedsMfa(true)
        setLoading(false)
        return // wait for code entry below
      }
    } catch {
      // If we can't even check, fail safe and continue to dashboard rather
      // than locking out every admin due to a transient API hiccup.
    }

    router.push('/dashboard')
  }

  async function handleVerifyMfa() {
    if (!factorId || mfaCode.trim().length < 6) return
    setError('')
    setMfaBusy(true)
    const supabase = createClient()
    try {
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId })
      if (cErr) throw cErr
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code: mfaCode.trim(),
      })
      if (vErr) throw vErr
      router.push('/dashboard')
    } catch (e: any) {
      setError(e?.message || 'That code was not accepted. Check your authenticator app and try again.')
    }
    setMfaBusy(false)
  }

  async function cancelMfa() {
    // Bail out cleanly: sign the (already-authenticated) session back out
    // so a half-finished MFA challenge can't be left dangling.
    const supabase = createClient()
    try { await supabase.auth.signOut() } catch {}
    setNeedsMfa(false)
    setFactorId(null)
    setMfaCode('')
    setError('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111111] px-4"
      style={{ background: 'linear-gradient(135deg, #111111 0%, #166534 100%)' }}>

      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10"
        style={{ background: 'linear-gradient(135deg,#166534,#C9A227)', transform: 'translate(30%, -30%)' }} />
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10"
        style={{ background: 'linear-gradient(135deg,#166534,#C9A227)', transform: 'translate(-30%, 30%)' }} />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-10">
          {/* Logo / Brand */}
          <div className="text-center mb-8">
            <img src="/logo.png" alt="Muddarris" className="mx-auto mb-4" style={{ width: 72, height: 72, objectFit: 'contain' }} />
            <h1 className="font-display text-2xl font-bold text-[#111111]">Muddarris</h1>
            <div className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase"
              style={{ background: '#F0E4B8', color: '#C9A227' }}>
              Admin Panel
            </div>
          </div>

          {!needsMfa ? (
            <>
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
                    placeholder="admin@muddarris.com"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none transition-all focus:border-[#C9A227] focus:ring-2 focus:ring-[#EFE2B5]"
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
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none transition-all focus:border-[#C9A227] focus:ring-2 focus:ring-[#EFE2B5]"
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  />
                </div>

                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #166534, #111111)', boxShadow: '0 8px 24px rgba(201,162,39,0.35)' }}>
                  {loading ? 'Signing in...' : 'Sign In to Admin Panel'}
                </button>
              </div>

              <p className="text-center text-xs text-ink-light mt-6">
                🔒 Restricted to authorized administrators only
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-ink mb-1">Two-factor verification</h2>
              <p className="text-sm text-ink-light mb-7">Enter the 6-digit code from your authenticator app</p>

              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl text-sm font-medium"
                  style={{ background: '#FEE2E2', color: '#DC2626' }}>
                  ⚠️ {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-ink-mid mb-1.5">Authentication Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    value={mfaCode}
                    onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-lg tracking-widest font-bold outline-none transition-all focus:border-[#C9A227] focus:ring-2 focus:ring-[#EFE2B5]"
                    onKeyDown={e => e.key === 'Enter' && handleVerifyMfa()}
                  />
                </div>

                <button
                  onClick={handleVerifyMfa}
                  disabled={mfaBusy || mfaCode.length < 6}
                  className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #166534, #111111)', boxShadow: '0 8px 24px rgba(201,162,39,0.35)' }}>
                  {mfaBusy ? 'Verifying...' : 'Verify & Continue'}
                </button>

                <button
                  onClick={cancelMfa}
                  disabled={mfaBusy}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-ink-light hover:text-ink-mid transition-all">
                  Back to login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
