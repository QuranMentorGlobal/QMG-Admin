// qmg-admin: src/app/api/ai/insights/route.ts
// ────────────────────────────────────────────────────────────────────────────
// AI Business Insights (Workflow #4). Reuses the aggregates already computed by
// /api/analytics/deep — the client POSTs them here, we ask the model for concise,
// decision-ready insights, and return the SAME { tone, text, rec }[] shape the
// "AI Insights" tab already renders. No new analytics queries, no DB writes.
//
// Cost control: lazy (called only when the admin opens the AI Insights tab) +
// a 6-hour in-memory cache per range → roughly one model call per range per
// window. Fails soft: if AI is unavailable, returns { insights: [] } and the
// page falls back to its existing heuristic insights.
// ────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { aiComplete, parseAIJson, AI_MODEL_QUALITY, AI_ENABLED } from '@/lib/ai/client'

type Insight = { tone: 'up' | 'down' | 'flag'; text: string; rec?: string }

const CACHE = new Map<string, { at: number; insights: Insight[] }>()
const TTL_MS = 1000 * 60 * 60 * 6 // 6 hours

export async function POST(req: Request) {
  let body: any = {}
  try { body = await req.json() } catch {}
  const deep = body?.deep || {}
  const range = String(body?.range || '30')

  if (!AI_ENABLED) {
    return NextResponse.json({ insights: [], aiEnabled: false })
  }

  const cached = CACHE.get(range)
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json({ insights: cached.insights, aiEnabled: true, cached: true })
  }

  // Compact, structured slice of the data — keeps token usage (and cost) tiny.
  const payload = {
    metrics: deep.insights || {},
    funnel: deep.funnel || [],
    topCourses: (deep.courses || []).slice(0, 6),
    topCountries: (deep.geography || []).slice(0, 6),
    support: deep.support
      ? { open: deep.support.open, resolved: deep.support.resolved, avgResponseHrs: deep.support.avgResponseHrs }
      : null,
    monthlyRevenue: (deep.monthly || []).slice(-6),
  }

  const system =
    'You are a business analyst for QuranMentorGlobal, a two-sided Quran tutoring marketplace ' +
    '(students/parents on one side, verified Quran teachers on the other; the platform earns a ' +
    'commission per lesson). You write concise, decision-ready insights for the Super Admin. ' +
    'Where the data supports it, cover booking trends, teacher performance, student retention, ' +
    'course popularity, and verification. Never invent numbers that are not in the data. ' +
    'If the data is too sparse for a claim, omit it. Output STRICT JSON only.'

  const user =
    `Latest analytics for the selected range (${range === 'all' ? 'all time' : range + ' days'}). ` +
    `Generate 4-6 insights.\n\nDATA:\n${JSON.stringify(payload)}\n\n` +
    `Return JSON exactly in this shape:\n` +
    `{"insights":[{"tone":"up","text":"...","rec":"..."}]}\n` +
    `Rules: tone is "up" (positive trend), "down" (negative trend), or "flag" (needs attention). ` +
    `"rec" is a short, concrete next step (optional but preferred). Each "text" must be grounded in ` +
    `the numbers above and stay under 24 words.`

  const raw = await aiComplete({
    system, user,
    model: AI_MODEL_QUALITY,
    json: true,
    temperature: 0.3,
    maxTokens: 900,
    timeoutMs: 22000,
  })

  const parsed = parseAIJson<{ insights: Insight[] }>(raw)
  const insights: Insight[] = Array.isArray(parsed?.insights)
    ? parsed!.insights
        .filter((x) => x && typeof x.text === 'string' && x.text.trim())
        .map((x) => ({
          tone: (x.tone === 'down' ? 'down' : x.tone === 'flag' ? 'flag' : 'up') as 'up' | 'down' | 'flag',
          text: String(x.text).trim(),
          rec: x.rec ? String(x.rec).trim() : undefined,
        }))
        .slice(0, 6)
    : []

  if (insights.length) CACHE.set(range, { at: Date.now(), insights })
  return NextResponse.json({ insights, aiEnabled: true })
}
