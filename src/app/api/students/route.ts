import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
}

// Admin student list — SERVICE ROLE (bypasses RLS on profiles).
export async function GET() {
  const { data, error } = await svc().from('profiles')
    .select('*').eq('role', 'student')
    .order('created_at', { ascending: false }).limit(100000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
