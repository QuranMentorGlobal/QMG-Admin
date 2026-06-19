import { NextResponse } from 'next/server'
import { getCaller } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'

// Authoritative admin check (service role → RLS can't cause false positives/negatives)
export async function GET() {
  const c = await getCaller()
  const ok = !!c.userId && c.role === 'admin' && c.status !== 'suspended'
  return NextResponse.json({ ok, role: c.role, status: c.status })
}
