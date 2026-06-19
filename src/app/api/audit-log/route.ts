import { NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'
export async function GET(req: Request) {
  const g = await guard(['admin.create', 'admin.edit', 'admin.delete']); if ('error' in g) return g.error
  const url = new URL(req.url)
  const q = url.searchParams.get('q') || ''
  let query = service().from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(300)
  if (q) query = query.or(`action.ilike.%${q}%,actor_name.ilike.%${q}%,target_type.ilike.%${q}%`)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data ?? [] })
}
