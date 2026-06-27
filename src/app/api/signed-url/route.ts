// qmg-admin: src/app/api/signed-url/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCaller } from '@/lib/admin-auth'
import { hasAnyPerm } from '@/lib/permissions'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const bucket = searchParams.get('bucket')
    const path = searchParams.get('path')

    if (!bucket || !path) {
      return NextResponse.json({ error: 'Missing bucket or path' }, { status: 400 })
    }

    // Only allow known private buckets for security
    const ALLOWED_BUCKETS = ['verification-documents', 'payout-proofs']
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json({ error: 'Unauthorized bucket access' }, { status: 403 })
    }

    // A2: require the sub-role permission that matches the bucket (super/legacy bypass).
    const caller = await getCaller()
    if (!caller.userId || caller.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (caller.status === 'suspended') {
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
    }
    const need = bucket === 'verification-documents'
      ? ['verification.access', 'verification.approve', 'verification.reject']
      : ['finance.view', 'finance.review', 'finance.process', 'payments.view']
    if (!hasAnyPerm(caller as any, need)) {
      return NextResponse.json({ error: 'Forbidden — missing permission for this document type' }, { status: 403 })
    }

    // Scope: reject path traversal / absolute paths.
    if (path.includes('..') || path.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const supabase = getAdmin()

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 300) // 5 minute expiry

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ signedUrl: data.signedUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
