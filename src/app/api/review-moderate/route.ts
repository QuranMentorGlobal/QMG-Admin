import { NextResponse } from 'next/server'
import { guard, service, logAudit } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'
export async function POST(req: Request) {
  const { reviewId, publish } = await req.json().catch(() => ({}))
  const g = await guard([publish ? 'reviews.publish' : 'reviews.unpublish']); if ('error' in g) return g.error
  if (!reviewId || typeof publish !== 'boolean') return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  const { error } = await service().from('reviews').update({ is_published: publish }).eq('id', reviewId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit(g.caller, publish ? 'review.publish' : 'review.unpublish', 'review', reviewId, { publish })
  return NextResponse.json({ ok: true })
}
