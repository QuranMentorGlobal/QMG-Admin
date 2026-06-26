// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/lib/ga.ts
// Google Analytics (GA4) Data API reader for Platform Health.
// Reads "active users today" (runReport) and "currently online" (runRealtime)
// using a service account — no extra npm dependency: we mint the Google access
// token by signing a JWT with Node crypto, then call the Data API over HTTPS.
// Returns null whenever GA isn't configured, so the tiles stay on "Connect".
//
// Required env vars (admin Vercel project):
//   GA4_PROPERTY_ID   numeric GA4 property id, e.g. 123456789
//   GA_CLIENT_EMAIL   service-account email (…@…iam.gserviceaccount.com)
//   GA_PRIVATE_KEY    the service-account private key (keep the \n escapes)
// ============================================================
import * as crypto from 'crypto'

let cachedToken: { token: string; exp: number } | null = null

function getCreds() {
  const propertyId = process.env.GA4_PROPERTY_ID
  const clientEmail = process.env.GA_CLIENT_EMAIL
  let privateKey = process.env.GA_PRIVATE_KEY
  if (!propertyId || !clientEmail || !privateKey) return null
  privateKey = privateKey.replace(/\\n/g, '\n')   // Vercel stores newlines escaped
  return { propertyId, clientEmail, privateKey }
}

export function gaConfigured(): boolean { return !!getCreds() }

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getAccessToken(clientEmail: string, privateKey: string): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.token

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }))
  const unsigned = `${header}.${claim}`
  let signature: Buffer
  try { signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey) }
  catch { return null }
  const assertion = `${unsigned}.${b64url(signature)}`

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    })
    const d: any = await res.json()
    if (!res.ok || !d.access_token) return null
    cachedToken = { token: d.access_token, exp: now + (d.expires_in || 3600) }
    return d.access_token
  } catch { return null }
}

async function callData(token: string, propertyId: string, method: string, body: any): Promise<number | null> {
  try {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:${method}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d: any = await res.json()
    if (!res.ok) return null
    const v = d?.rows?.[0]?.metricValues?.[0]?.value
    return v != null ? Number(v) : 0
  } catch { return null }
}

export async function gaActiveUsers(): Promise<{ activeToday: number | null; online: number | null } | null> {
  const creds = getCreds()
  if (!creds) return null
  const token = await getAccessToken(creds.clientEmail, creds.privateKey)
  if (!token) return null
  const [activeToday, online] = await Promise.all([
    callData(token, creds.propertyId, 'runReport', { dateRanges: [{ startDate: 'today', endDate: 'today' }], metrics: [{ name: 'activeUsers' }] }),
    callData(token, creds.propertyId, 'runRealtimeReport', { metrics: [{ name: 'activeUsers' }] }),
  ])
  return { activeToday, online }
}
