/** @type {import('next').NextConfig} */

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://avatars.githubusercontent.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.muddarris.com",
  "media-src 'self' blob: https://*.supabase.co",
  "frame-src 'self'",
  "worker-src 'self' blob:",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'accelerometer=(), gyroscope=(), magnetometer=(), midi=(), usb=(), serial=(), bluetooth=(), hid=(), camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: CSP },
]

const nextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com', 'avatars.githubusercontent.com'],
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      // Force Vercel's Edge CDN (and any CDN) to NEVER cache API responses.
      // force-dynamic + Cache-Control alone don't stop Vercel's edge; it honors
      // Vercel-CDN-Cache-Control / CDN-Cache-Control specifically. Without this,
      // dynamic JSON (payouts, stats, finance) can be served stale for hours.
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
          { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
