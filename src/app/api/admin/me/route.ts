// ============================================================
// FOR qmg-admin REPO → src/app/api/admin/me/route.ts
// Returns the calling admin's identity + role + finance permissions, read with
// the SERVICE ROLE via getCaller(). The browser can't read profiles' admin
// columns (locked down by PII hardening), so client pages must NOT query
// profiles directly to decide what actions to show — they call this instead.
// Behind admin middleware; getCaller() uses the middleware-forwarded x-admin-id,
// so it can't be spoofed.
// ============================================================
import { NextResponse } from 'next/server'
import { getCaller } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const me = await getCaller()
  if (!me.userId) {
    return NextResponse.json(
      { userId: null, name: 'Admin', role: null, adminRole: null, isSuper: false, permissions: [], status: 'active' },
      { status: 200 }
    )
  }
  const isSuper = me.adminRole !== 'sub' // super-admins have adminRole null/'super'; only 'sub' is restricted
  return NextResponse.json({
    userId: me.userId,
    name: me.name,
    role: me.role,
    adminRole: me.adminRole,
    isSuper,
    permissions: me.permissions,
    status: me.status,
  })
}
