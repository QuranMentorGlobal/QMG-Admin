// ============================================================
// PASTE THIS WHOLE FILE INTO:  middleware.ts  (repo root)
// Auth + role/permission gate. Super bypasses everything; suspended is blocked;
// sub-admins are limited to routes their permissions allow.
// ============================================================
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { canAccessRoute } from '@/lib/permissions'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
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

  // Page routes (not API/static) are gated by permission. Super bypasses inside canAccessRoute.
  const isApi = pathname.startsWith('/api/')
  if (!isApi && !canAccessRoute(pathname, ctx)) {
    // Send sub-admins to their (adaptive) dashboard instead of a hard error.
    return NextResponse.redirect(new URL('/dashboard?denied=1', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
