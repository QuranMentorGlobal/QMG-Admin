// qmg-admin: src/lib/ai/client.ts
// ────────────────────────────────────────────────────────────────────────────
// Shared, provider-agnostic AI client — the single foundation every AI feature
// builds on. Defaults to Groq (fast, low-cost, OpenAI-compatible). Because the
// request shape is OpenAI-compatible, you can swap providers later by changing
// the AI_BASE_URL / AI_API_KEY / model envs — no code changes, no lock-in.
//
// Design rules:
//   • Server-side only (never import in a client component — the key must stay secret).
//   • Fails soft: any error / missing key returns null so the caller degrades
//     gracefully and the platform behaves exactly as it does today.
//   • No SDK dependency (plain fetch) so it drops into the paste-to-GitHub workflow.
// ────────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1'
const API_KEY  = process.env.AI_API_KEY || process.env.GROQ_API_KEY || ''

// Is any AI provider configured? Features check this and no-op cleanly when false.
export const AI_ENABLED = !!API_KEY

// Model tiers. FAST = cheap/high-volume (classification, support); QUALITY =
// better writing/reasoning (insights, profile polish, recommendation re-rank).
export const AI_MODEL_FAST    = process.env.AI_MODEL_FAST    || 'llama-3.1-8b-instant'
export const AI_MODEL_QUALITY = process.env.AI_MODEL_QUALITY || 'llama-3.3-70b-versatile'

export interface AICompleteOpts {
  system: string
  user: string
  model?: string
  json?: boolean          // request strict JSON output (response_format json_object)
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
}

// Returns the model's text output, or null on ANY failure (missing key, timeout,
// non-200, network error). Callers must treat null as "AI unavailable".
export async function aiComplete(opts: AICompleteOpts): Promise<string | null> {
  if (!API_KEY) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000)
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: opts.model || AI_MODEL_QUALITY,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 1024,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      console.warn('[ai] HTTP', res.status, (await res.text().catch(() => '')).slice(0, 300))
      return null
    }
    const data = await res.json()
    return data?.choices?.[0]?.message?.content ?? null
  } catch (e: any) {
    console.warn('[ai] request failed:', e?.message || e)
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Parse a JSON object from a model response, tolerating ```json fences/whitespace.
export function parseAIJson<T = any>(text: string | null): T | null {
  if (!text) return null
  try {
    const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim()
    return JSON.parse(clean) as T
  } catch {
    return null
  }
}
