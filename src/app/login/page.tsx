// ============================================================
// PASTE THIS WHOLE FILE INTO (qmg-admin):  src/app/login/page.tsx
// ------------------------------------------------------------
// Admin login WITH 2FA challenge (Phase 2 enforcement).
//   Step 1 (password): signInWithPassword → check assurance level.
//   Step 2 (code):     ONLY if the account has a verified TOTP factor and the
//                      session is still aal1 → prompt for the 6-digit code,
//                      challenge + verify → session upgrades to aal2.
// Admins WITHOUT a factor never see step 2 and are never blocked.
// If you lose your authenticator, see BREAK-GLASS in the delivery notes.
// ============================================================
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminLoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<'password' | 'mfa'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [booting, setBooting] = useState(true)

  // If the admin already has a session that is stuck at aal1 with a verified
  // factor (e.g. they were redirected here by the middleware mfa gate, or closed
  // the tab mid-login), jump straight to the code step instead of asking for the
  // password again. If they're already aal2, send them in.
  useEffect(() => {
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession()
        if (s?.session?.user) {
          const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
          if (aal?.currentLevel === 'aal2') { router.replace('/dashboard'); return }
          if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
            const { data: f } = await supabase.auth.mfa.listFactors()
            const totp = (f?.totp || []).find((x: any) => x.status === 'verified')
            if (totp) { setFactorId(totp.id); setStep('mfa') }
          }
        }
      } catch { /* fall through to the password form */ }
      setBooting(false)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function finishLogin() {
    // Authoritative admin check via the service role (RLS-proof).
    let ok = false
    try { const res = await fetch('/api/auth-check'); const j = await res.json(); ok = !!j.ok } catch {}
    if (!ok) {
      await supabase.auth.signOut()
      setError('Access denied. This panel is for administrators only.')
      setStep('password'); setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  async function handleLogin() {
    setError(''); setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError || !data.user) {
      setError('Invalid email or password.'); setLoading(false); return
    }

    // Does this account require a second factor?
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
        const { data: f } = await supabase.auth.mfa.listFactors()
        const totp = (f?.totp || []).find((x: any) => x.status === 'verified')
        if (totp) { setFactorId(totp.id); setStep('mfa'); setCode(''); setLoading(false); return }
      }
    } catch { /* no MFA / call failed → continue as a normal (aal1) login */ }

    await finishLogin()
  }

  async function handleVerifyCode() {
    if (!factorId || code.trim().length < 6) return
    setError(''); setLoading(true)
    try {
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId })
      if (cErr) throw cErr
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() })
      if (vErr) throw vErr
      await finishLogin()
    } catch (e: any) {
      setError(e?.message || 'That code was not accepted. Check your authenticator and try again.')
      setLoading(false)
    }
  }

  async function cancelMfa() {
    try { await supabase.auth.signOut() } catch {}
    setStep('password'); setCode(''); setFactorId(null); setPassword(''); setError('')
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

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm font-medium"
              style={{ background: '#FEE2E2', color: '#DC2626' }}>
              ⚠️ {error}
            </div>
          )}

          {booting ? (
            <p className="text-center text-sm text-ink-light py-6">Loading…</p>
          ) : step === 'password' ? (
            <>
              <h2 className="text-xl font-bold text-ink mb-1">Welcome back</h2>
              <p className="text-sm text-ink-light mb-7">Sign in to manage the platform</p>

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
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-ink mb-1">Two-factor verification</h2>
              <p className="text-sm text-ink-light mb-7">Enter the 6-digit code from your authenticator app.</p>

              <div className="space-y-4">
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  placeholder="000000"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none transition-all focus:border-[#C9A227] focus:ring-2 focus:ring-[#EFE2B5] text-center font-bold"
                  style={{ fontSize: 24, letterSpacing: 8 }}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
                />

                <button
                  onClick={handleVerifyCode}
                  disabled={loading || code.length < 6}
                  className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #166534, #111111)', boxShadow: '0 8px 24px rgba(201,162,39,0.35)' }}>
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </button>

                <button
                  onClick={cancelMfa}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm text-ink-mid hover:bg-gray-50 transition-all disabled:opacity-60">
                  Use a different account
                </button>
              </div>
            </>
          )}

          <p className="text-center text-xs text-ink-light mt-6">
            🔒 Restricted to authorized administrators only
          </p>
        </div>
      </div>
    </div>
  )
}
