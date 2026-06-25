// qmg-admin: src/app/api/finance/upload-proof/route.ts
// ────────────────────────────────────────────────────────────────────────────
// Finance uploads a payment proof (image or PDF) for a payout. Requires the
// finance.process permission (super bypasses). Stores in the private
// `payout-proofs` bucket and returns the storage path; the path is then saved on
// the payout when finance marks it completed. (Phase F3)
// ────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { guard, service } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
const MAX_BYTES = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  const g = await guard(['finance.process'])
  if ('error' in g) return g.error

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 }) }

  const file = form.get('file') as File | null
  const payoutId = String(form.get('payoutId') || '')
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!payoutId) return NextResponse.json({ error: 'payoutId is required' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Only PNG, JPG, WEBP or PDF files are allowed.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 10MB).' }, { status: 400 })

  const ext = file.type === 'application/pdf' ? 'pdf' : (file.name.split('.').pop() || 'png').toLowerCase()
  const safeName = `${Date.now()}.${ext}`
  const path = `${payoutId}/${safeName}`

  const svc = service()
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await svc.storage.from('payout-proofs').upload(path, buffer, {
    contentType: file.type, upsert: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, path })
}
