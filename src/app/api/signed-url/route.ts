// qmg-admin: src/app/api/signed-url/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // Only allow verification-documents bucket for security
    if (bucket !== 'verification-documents') {
      return NextResponse.json({ error: 'Unauthorized bucket access' }, { status: 403 })
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
