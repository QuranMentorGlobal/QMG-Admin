// ============================================================
// src/lib/admin-auth.ts  (server-only helpers for API routes)
// - getCaller(): who is calling (role, adminRole, permissions, status)
// - guard(perms): 401/403 if the caller lacks any of the perms (super bypasses)
// - service(): service-role client for privileged writes
// - logAudit(): append an entry to admin_audit_log
// ============================================================
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { hasAnyPerm, type AdminCtx } from './permissions'

export function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export interface Caller extends AdminCtx { userId: string | null; name: string }

export async function getCaller(): Promise<Caller> {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
      getAll: () => cookieStore.getAll(),
      // Route handlers CAN write cookies — persist any refreshed token so
      // getUser() succeeds even after the access token rotates. A no-op here
      // was making getUser() return null → guard() 401 → empty admin pages.
      setAll: (toSet) => { try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} },
    } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null, name: 'Unknown', role: null, adminRole: null, permissions: [], status: 'active' }

  const svc = service()
  const { data: p } = await svc.from('profiles')
    .select('role, admin_role, admin_permissions, admin_status, first_name, last_name')
    .eq('id', user.id).single()

  const prof = (p as any) || {}
  return {
    userId: user.id,
    name: `${prof.first_name ?? ''} ${prof.last_name ?? ''}`.trim() || 'Admin',
    role: prof.role ?? null,
    adminRole: prof.admin_role ?? null,
    permissions: Array.isArray(prof.admin_permissions) ? prof.admin_permissions : [],
    status: prof.admin_status ?? 'active',
  }
}

// Returns the Caller if authorized, otherwise a NextResponse to return immediately.
export async function guard(perms: string[]): Promise<{ caller: Caller } | { error: NextResponse }> {
  const caller = await getCaller()
  // Distinct messages so the cause is obvious in the UI toast:
  //  • no session  → cookie/auth wasn't read in this route (sign out & back in)
  //  • wrong role  → the signed-in account's profiles.role isn't 'admin'
  if (!caller.userId) {
    return { error: NextResponse.json({ error: 'Unauthorized — no active admin session. Please sign out and sign in again.' }, { status: 401 }) }
  }
  if (caller.role !== 'admin') {
    return { error: NextResponse.json({ error: `Access denied — this account's role is '${caller.role ?? 'none'}', not 'admin'.` }, { status: 403 }) }
  }
  if (caller.status === 'suspended') {
    return { error: NextResponse.json({ error: 'Account suspended' }, { status: 403 }) }
  }
  if (!hasAnyPerm(caller, perms)) {
    return { error: NextResponse.json({ error: 'Forbidden — your sub-admin role is missing the required permission.' }, { status: 403 }) }
  }
  return { caller }
}

export async function logAudit(
  caller: { userId: string | null; name: string },
  action: string,
  targetType?: string,
  targetId?: string,
  details?: any,
) {
  try {
    await service().from('admin_audit_log').insert({
      actor_id: caller.userId, actor_name: caller.name,
      action, target_type: targetType ?? null, target_id: targetId ?? null, details: details ?? null,
    })
  } catch { /* audit must never break the action */ }
}
