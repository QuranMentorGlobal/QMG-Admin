// ============================================================
// PASTE THIS WHOLE FILE INTO:  middleware.ts  (repo root)
// Auth + role/permission gate. Super bypasses everything; suspended is blocked;
// sub-admins are limited to routes their permissions allow.
// ============================================================
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { canAccessRoute, requiredForApi, hasAnyPerm } from '@/lib/permissions'

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  // Never trust an inbound spoofed identity header.
  requestHeaders.delete('x-admin-id')
  let response = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Login page is always allowed
  if (pathname === '/login') return response

  // Not logged in → login
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  // Admin role + permission context from profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, admin_role, admin_permissions, admin_status')
    .eq('id', user.id)
    .single()

  if (!profile || (profile as any).role !== 'admin') {
    return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
  }

  const ctx = {
    role: (profile as any).role,
    adminRole: (profile as any).admin_role ?? null,
    permissions: Array.isArray((profile as any).admin_permissions) ? (profile as any).admin_permissions : [],
    status: (profile as any).admin_status ?? 'active',
  }

  // Suspended admins cannot use the panel
  if (ctx.status === 'suspended') {
    return NextResponse.redirect(new URL('/login?error=suspended', request.url))
  }

  // Permission gate. Super/legacy admins bypass (hasAnyPerm/canAccessRoute return true for non-sub).
  const isApi = pathname.startsWith('/api/')
  if (isApi) {
    // API routes get a 403 JSON (a redirect would hand a fetch() an HTML login page).
    const required = requiredForApi(pathname)
    if (required && !hasAnyPerm(ctx, required)) {
      return NextResponse.json({ error: 'Forbidden', code: 'insufficient_permissions' }, { status: 403 })
    }
  } else if (!canAccessRoute(pathname, ctx)) {
    // Send sub-admins to their (adaptive) dashboard instead of a hard error.
    return NextResponse.redirect(new URL('/dashboard?denied=1', request.url))
  }

  // Forward the verified admin id to route handlers so getCaller() never has to
  // re-read the auth cookie (which fails after token rotation → empty pages).
  requestHeaders.set('x-admin-id', user.id)
  const out = NextResponse.next({ request: { headers: requestHeaders } })
  for (const c of response.cookies.getAll()) out.cookies.set(c)
  return out
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
