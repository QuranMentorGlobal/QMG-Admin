// ============================================================
// src/app/api/sub-admins/[id]/route.ts
// PATCH  → edit permissions / role label / status  (needs admin.edit)
// DELETE → delete sub-admin                          (needs admin.delete)
// Only operates on admin_role = 'sub' (a Super Admin can never be edited/deleted here).
// ============================================================
import { NextResponse } from 'next/server'
import { guard, service, logAudit } from '@/lib/admin-auth'
import { ALL_PERMISSIONS } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

async function assertSub(svc: ReturnType<typeof service>, id: string) {
  const { data } = await svc.from('profiles').select('admin_role, email').eq('id', id).single()
  return (data as any)?.admin_role === 'sub' ? (data as any) : null
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await guard(['admin.edit'])
  if ('error' in g) return g.error
  const svc = service()
  const target = await assertSub(svc, params.id)
  if (!target) return NextResponse.json({ error: 'Not a sub-admin account.' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const patch: any = {}
  if (Array.isArray(body.permissions)) patch.admin_permissions = body.permissions.filter((p: string) => ALL_PERMISSIONS.includes(p))
  if (typeof body.roleLabel === 'string') patch.admin_role_label = body.roleLabel
  if (body.status === 'active' || body.status === 'suspended') patch.admin_status = body.status
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })

  const { error } = await svc.from('profiles').update(patch).eq('id', params.id).eq('admin_role', 'sub')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const action = body.status ? `sub_admin.${body.status === 'suspended' ? 'suspend' : 'activate'}` : 'sub_admin.update'
  await logAudit(g.caller, action, 'sub_admin', params.id, { email: target.email, patch })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await guard(['admin.delete'])
  if ('error' in g) return g.error
  const svc = service()
  const target = await assertSub(svc, params.id)
  if (!target) return NextResponse.json({ error: 'Not a sub-admin account.' }, { status: 404 })

  const { error } = await svc.auth.admin.deleteUser(params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await svc.from('profiles').delete().eq('id', params.id).eq('admin_role', 'sub')

  await logAudit(g.caller, 'sub_admin.delete', 'sub_admin', params.id, { email: target.email })
  return NextResponse.json({ ok: true })
}
