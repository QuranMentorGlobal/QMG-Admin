// ============================================================
// PASTE THIS WHOLE FILE INTO (qmg-admin):  src/app/account-security/page.tsx
// ------------------------------------------------------------
// Two-Factor Authentication — ENROLLMENT ONLY (Phase 1).
// Lets an admin turn on TOTP 2FA for their own account. This does NOT change
// login or enforce anything yet, so it can never lock anyone out. A separate,
// staged step adds the login challenge + enforcement once enrollment is proven.
// Uses Supabase native MFA (auth.mfa.enroll / challenge / verify / unenroll).
// Requires TOTP enabled in Supabase -> Authentication -> Multi-Factor.
// ============================================================
'use client'
import { useEffect, useState } from 'react'
import PageHead from '@/components/PageHead'
import AdminLayout from '@/components/AdminLayout'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, KeyRound, Check, AlertTriangle, Loader2, Trash2 } from 'lucide-react'

const INK = '#111111', GOLD = '#8A6A16', FOREST = '#166534', CREAM = '#F8F5EE', BORDER = '#E6E0D2'

export default function AccountSecurityPage() {
  const supabase = createClient()
  const [adminName, setAdminName] = useState('')
  const [loading, setLoading]     = useState(true)
  const [enrolled, setEnrolled]   = useState(false)
  const [factorId, setFactorId]   = useState<string | null>(null)

  const [enrolling, setEnrolling] = useState(false)
  const [qr, setQr]               = useState<string | null>(null)
  const [secret, setSecret]       = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [code, setCode]           = useState('')
  const [busy, setBusy]           = useState(false)
  const [msg, setMsg]             = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      if (u?.user) {
        const { data: p } = await (supabase as any).from('profiles')
          .select('first_name, last_name').eq('id', u.user.id).maybeSingle()
        setAdminName(p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || (u.user.email || 'Admin') : (u.user.email || 'Admin'))
      }
      const { data } = await supabase.auth.mfa.listFactors()
      const verified = (data?.totp || []).find((f: any) => f.status === 'verified')
      setEnrolled(!!verified)
      setFactorId(verified?.id || null)
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.message || 'Could not load 2FA status.' })
    }
    setLoading(false)
  }
  useEffect(() => { refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function startEnroll() {
    setMsg(null); setBusy(true)
    try {
      // clear any stale, unverified factors so enroll doesn't collide
      const { data: list } = await supabase.auth.mfa.listFactors()
      for (const f of ((list?.totp as any[]) || [])) {
        if (f.status !== 'verified') { try { await supabase.auth.mfa.unenroll({ factorId: f.id }) } catch {} }
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Admin ${Date.now()}` })
      if (error) throw error
      setPendingId(data.id)
      setQr((data as any).totp?.qr_code || null)
      setSecret((data as any).totp?.secret || null)
      setEnrolling(true); setCode('')
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.message || 'Could not start enrollment. Confirm TOTP is enabled in Supabase → Authentication → Multi-Factor.' })
    }
    setBusy(false)
  }

  async function confirmEnroll() {
    if (!pendingId || code.trim().length < 6) return
    setMsg(null); setBusy(true)
    try {
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId: pendingId })
      if (cErr) throw cErr
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId: pendingId, challengeId: ch.id, code: code.trim() })
      if (vErr) throw vErr
      setEnrolling(false); setQr(null); setSecret(null); setPendingId(null); setCode('')
      setMsg({ type: 'success', text: '2FA enabled for your account. (You will only be prompted for a code at login once enforcement is turned on.)' })
      await refresh()
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.message || 'That code was not accepted. Check your authenticator and try again.' })
    }
    setBusy(false)
  }

  async function removeFactor() {
    if (!factorId) return
    if (!window.confirm('Remove 2FA from your account? You can re-enable it any time.')) return
    setBusy(true); setMsg(null)
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) throw error
      setMsg({ type: 'success', text: '2FA removed from your account.' })
      await refresh()
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.message || 'Could not remove 2FA.' })
    }
    setBusy(false)
  }

  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, maxWidth: 560 }
  const btn = (bg: string, color = '#fff'): React.CSSProperties => ({ background: bg, color, border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: busy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, opacity: busy ? 0.7 : 1 })

  return (
    <AdminLayout adminName={adminName}>
      <PageHead title="Two-Factor Authentication" subtitle="Add a second layer of security to your admin account" />

      <div style={{ padding: '8px 4px 40px' }}>
        {msg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, maxWidth: 560,
            background: msg.type === 'error' ? '#FEF2F2' : '#ECFDF5', color: msg.type === 'error' ? '#991B1B' : '#065F46',
            border: `1px solid ${msg.type === 'error' ? '#FECACA' : '#A7F3D0'}`, borderRadius: 12, padding: '12px 16px', fontSize: 14, fontWeight: 600 }}>
            {msg.type === 'error' ? <AlertTriangle size={18} /> : <Check size={18} />}{msg.text}
          </div>
        )}

        {loading ? (
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, color: INK }}>
            <Loader2 size={18} className="animate-spin" /> Loading…
          </div>
        ) : enrolled ? (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ECFDF5', display: 'grid', placeItems: 'center' }}>
                <ShieldCheck size={24} color={FOREST} />
              </div>
              <div>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 800, color: INK }}>Two-factor authentication is ON</div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>Your account is protected by an authenticator app.</div>
              </div>
            </div>
            <button onClick={removeFactor} disabled={busy} style={{ ...btn('#fff', '#991B1B'), border: '1px solid #FECACA', marginTop: 8 }}>
              <Trash2 size={16} /> Remove 2FA
            </button>
          </div>
        ) : !enrolling ? (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: CREAM, display: 'grid', placeItems: 'center' }}>
                <KeyRound size={24} color={GOLD} />
              </div>
              <div>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 800, color: INK }}>Protect your admin account</div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>Use an authenticator app (Google Authenticator, Authy, 1Password) for login codes.</div>
              </div>
            </div>
            <button onClick={startEnroll} disabled={busy} style={{ ...btn(`linear-gradient(135deg,${FOREST},${GOLD})`), marginTop: 6 }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Enable 2FA
            </button>
          </div>
        ) : (
          <div style={card}>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 800, color: INK, marginBottom: 6 }}>Scan this QR code</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Open your authenticator app, scan the code, then enter the 6-digit code it shows.</div>
            {qr && (
              <div style={{ display: 'grid', placeItems: 'center', padding: 12, border: `1px solid ${BORDER}`, borderRadius: 12, width: 'fit-content', marginBottom: 14, background: '#fff' }}>
                {/* qr_code is an SVG data URL */}
                <img src={qr} alt="2FA QR code" width={180} height={180} />
              </div>
            )}
            {secret && (
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
                Can’t scan? Enter this key manually:&nbsp;
                <code style={{ background: CREAM, padding: '3px 8px', borderRadius: 6, fontWeight: 700, color: INK, letterSpacing: 1 }}>{secret}</code>
              </div>
            )}
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: INK, marginBottom: 6 }}>6-digit code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" placeholder="000000"
              style={{ width: 160, fontSize: 22, letterSpacing: 6, fontWeight: 800, textAlign: 'center', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, color: INK, marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={confirmEnroll} disabled={busy || code.length < 6} style={{ ...btn(`linear-gradient(135deg,${FOREST},${GOLD})`), opacity: (busy || code.length < 6) ? 0.6 : 1 }}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Verify & enable
              </button>
              <button onClick={() => { setEnrolling(false); setQr(null); setSecret(null); setPendingId(null); setCode('') }} disabled={busy} style={btn('#fff', INK)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <p style={{ fontSize: 12, color: '#9CA3AF', maxWidth: 560, marginTop: 18 }}>
          This only enrolls a 2FA device. Login is not yet changed, so enabling this cannot lock you out.
          Enforcing 2FA at login is a separate step that will be turned on once enrollment is confirmed working.
        </p>
      </div>
    </AdminLayout>
  )
}
