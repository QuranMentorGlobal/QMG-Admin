// ============================================================
// src/app/api/sub-admins/route.ts
// GET  → list sub-admins   (needs admin.create | admin.edit | admin.delete)
// POST → create sub-admin  (needs admin.create)
// ============================================================
import { NextResponse } from 'next/server'
import { guard, service, logAudit } from '@/lib/admin-auth'
import { ALL_PERMISSIONS } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guard(['admin.create', 'admin.edit', 'admin.delete'])
  if ('error' in g) return g.error
  const { data, error } = await service()
    .from('profiles')
    .select('id, email, first_name, last_name, admin_role, admin_permissions, admin_status, admin_role_label, created_at')
    .eq('role', 'admin').eq('admin_role', 'sub')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ subAdmins: data ?? [] })
}

export async function POST(req: Request) {
  const g = await guard(['admin.create'])
  if ('error' in g) return g.error
  const body = await req.json().catch(() => ({}))
  const { email, password, firstName, lastName, roleLabel } = body
  const permissions: string[] = Array.isArray(body.permissions) ? body.permissions.filter((p: string) => ALL_PERMISSIONS.includes(p)) : []

  if (!email || !password || String(password).length < 8) {
    return NextResponse.json({ error: 'Email and a password of at least 8 characters are required.' }, { status: 400 })
  }

  const svc = service()
  const { data: created, error: cErr } = await svc.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (cErr || !created?.user) return NextResponse.json({ error: cErr?.message || 'Could not create user.' }, { status: 400 })

  const uid = created.user.id
  const { error: pErr } = await svc.from('profiles').upsert({
    id: uid, email,
    first_name: firstName || 'Sub', last_name: lastName || 'Admin',
    role: 'admin', is_active: true,
    admin_role: 'sub', admin_permissions: permissions, admin_status: 'active',
    admin_role_label: roleLabel || 'Sub Admin',
  } as any, { onConflict: 'id' })
  if (pErr) {
    // roll back the auth user so we don't leave an orphan
    await svc.auth.admin.deleteUser(uid).catch(() => {})
    return NextResponse.json({ error: pErr.message }, { status: 500 })
  }

  await logAudit(g.caller, 'sub_admin.create', 'sub_admin', uid, { email, roleLabel, permissions })
  return NextResponse.json({ ok: true, id: uid })
}
