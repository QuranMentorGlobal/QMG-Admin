// ============================================================
// src/lib/permissions.ts
// Single source of truth for the Super/Sub-Admin permission model.
// Shared by middleware, API guards, sidebar rendering and dashboard widgets.
// ============================================================

export type AdminRole = 'super' | 'sub' | null

export interface PermItem { key: string; label: string }
export interface PermGroup { key: string; label: string; perms: PermItem[] }

// ── The full permission matrix ──────────────────────────────────────────────
export const PERMISSION_GROUPS: PermGroup[] = [
  {
    key: 'teachers', label: 'Teacher Management', perms: [
      { key: 'teachers.view', label: 'View Teachers' },
      { key: 'teachers.approve', label: 'Approve Teachers' },
      { key: 'teachers.reject', label: 'Reject Teachers' },
      { key: 'teachers.suspend', label: 'Suspend Teachers' },
    ],
  },
  {
    key: 'students', label: 'Student Management', perms: [
      { key: 'students.view', label: 'View Students' },
      { key: 'students.toggle', label: 'Activate / Deactivate Students' },
    ],
  },
  {
    key: 'bookings', label: 'Bookings', perms: [
      { key: 'bookings.view', label: 'View Bookings' },
      { key: 'bookings.manage', label: 'Manage Bookings' },
    ],
  },
  {
    key: 'reviews', label: 'Reviews', perms: [
      { key: 'reviews.view', label: 'View Reviews' },
      { key: 'reviews.publish', label: 'Publish Reviews' },
      { key: 'reviews.unpublish', label: 'Unpublish Reviews' },
    ],
  },
  {
    key: 'support', label: 'Support', perms: [
      { key: 'support.view', label: 'View Tickets' },
      { key: 'support.manage', label: 'Manage Tickets' },
    ],
  },
  {
    key: 'payments', label: 'Payments', perms: [
      { key: 'payments.view', label: 'View Payments' },
      { key: 'payments.manage', label: 'Manage Payments' },
    ],
  },
  {
    key: 'analytics', label: 'Analytics', perms: [
      { key: 'analytics.dashboard', label: 'View Dashboard' },
      { key: 'analytics.deep', label: 'View Deep Analytics' },
      { key: 'analytics.export', label: 'Export Reports' },
    ],
  },
  {
    key: 'verification', label: 'Verification', perms: [
      { key: 'verification.access', label: 'Access Verification Queue' },
      { key: 'verification.approve', label: 'Approve Verification' },
      { key: 'verification.reject', label: 'Reject Verification' },
    ],
  },
  {
    key: 'badges', label: 'Badges', perms: [
      { key: 'badges.view', label: 'View Badges' },
      { key: 'badges.manage', label: 'Assign / Remove Badges' },
    ],
  },
  {
    key: 'settings', label: 'Platform Settings', perms: [
      { key: 'settings.view', label: 'View Settings' },
      { key: 'settings.edit', label: 'Edit Settings' },
    ],
  },
  {
    key: 'admin', label: 'Admin Management', perms: [
      { key: 'admin.create', label: 'Create Sub Admin' },
      { key: 'admin.edit', label: 'Edit Sub Admin' },
      { key: 'admin.delete', label: 'Delete Sub Admin' },
    ],
  },
]

export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.key))

// ── Route → permission(s) required (any-of). Missing route = always allowed.
// /dashboard and / are intentionally absent: every admin gets an (adaptive) home.
export const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/analytics': ['analytics.deep'],
  '/attendance': ['analytics.deep'],
  '/teachers': ['teachers.view'],
  '/courses-hub': ['teachers.view'],
  '/verification-queue': ['verification.access'],
  '/re-verification': ['verification.access'],
  '/badges': ['badges.view', 'badges.manage'],
  '/badge-guide': ['badges.view', 'badges.manage'],
  '/moderation': ['support.view'],
  '/students': ['students.view'],
  '/bookings': ['bookings.view'],
  '/reviews': ['reviews.view'],
  '/payments': ['payments.view'],
  '/refunds': ['payments.view'],
  '/support': ['support.view'],
  '/settings': ['settings.view'],
  '/admin-management': ['admin.create', 'admin.edit', 'admin.delete'],
  '/audit-log': ['admin.create', 'admin.edit', 'admin.delete'],
}

// ── API path → permission(s) required (any-of). ──────────────────────────────
export const API_PERMISSIONS: { match: string; perms: string[] }[] = [
  { match: '/api/sub-admins', perms: ['admin.create', 'admin.edit', 'admin.delete'] },
  { match: '/api/review-teacher', perms: ['teachers.approve', 'teachers.reject', 'verification.approve', 'verification.reject'] },
  { match: '/api/verification-action', perms: ['verification.approve', 'verification.reject'] },
  { match: '/api/verification-queue', perms: ['verification.access'] },
  { match: '/api/pending-teachers', perms: ['verification.access', 'teachers.view'] },
  { match: '/api/analytics/deep', perms: ['analytics.deep'] },
  { match: '/api/analytics', perms: ['analytics.dashboard'] },
  { match: '/api/stats', perms: ['analytics.dashboard'] },
  { match: '/api/courses-hub', perms: ['teachers.view', 'analytics.dashboard'] },
]

// ── Default Sub-Admin role presets ───────────────────────────────────────────
export const ROLE_PRESETS: { key: string; label: string; description: string; perms: string[] }[] = [
  {
    key: 'verification', label: 'Verification Manager', description: 'Teacher verification only.',
    perms: ['verification.access', 'verification.approve', 'verification.reject', 'teachers.view'],
  },
  {
    key: 'support', label: 'Support Manager', description: 'Support tickets and reviews.',
    perms: ['support.view', 'support.manage', 'reviews.view', 'reviews.publish', 'reviews.unpublish'],
  },
  {
    key: 'operations', label: 'Operations Manager', description: 'Teachers, students and bookings.',
    perms: ['teachers.view', 'teachers.approve', 'teachers.reject', 'teachers.suspend', 'students.view', 'students.toggle', 'bookings.view', 'bookings.manage'],
  },
  {
    key: 'finance', label: 'Finance Manager', description: 'Payments, commissions and revenue.',
    perms: ['payments.view', 'payments.manage', 'analytics.dashboard', 'analytics.export'],
  },
  {
    key: 'marketing', label: 'Marketing Manager', description: 'Analytics and reports.',
    perms: ['analytics.dashboard', 'analytics.deep', 'analytics.export'],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
export interface AdminCtx { role: string | null; adminRole: AdminRole; permissions: string[]; status: string }

export function isSuper(ctx?: Partial<AdminCtx> | null) {
  // Any admin who is NOT explicitly a sub-admin is full-access (Super).
  // This keeps pre-existing / unmigrated admins fully working (fail-open for the owner).
  return !!ctx && ctx.adminRole !== 'sub'
}

export function hasPerm(ctx: Partial<AdminCtx> | null | undefined, perm: string): boolean {
  if (!ctx) return false
  if (ctx.adminRole !== 'sub') return true
  return Array.isArray(ctx.permissions) && ctx.permissions.includes(perm)
}

export function hasAnyPerm(ctx: Partial<AdminCtx> | null | undefined, perms: string[]): boolean {
  if (!ctx) return false
  if (ctx.adminRole !== 'sub') return true
  return perms.some(p => hasPerm(ctx, p))
}

// Longest-prefix match of a path against a permission map.
function matchRoute(pathname: string, map: Record<string, string[]>): string[] | null {
  let best: string | null = null
  for (const key of Object.keys(map)) {
    if (pathname === key || pathname.startsWith(key + '/')) {
      if (!best || key.length > best.length) best = key
    }
  }
  return best ? map[best] : null
}

export function canAccessRoute(pathname: string, ctx: Partial<AdminCtx> | null | undefined): boolean {
  if (!ctx) return false
  if (ctx.status === 'suspended') return false
  if (ctx.adminRole !== 'sub') return true
  const required = matchRoute(pathname, ROUTE_PERMISSIONS)
  if (!required) return true // unguarded route (e.g. /dashboard) — every admin may see it
  return required.some(p => (ctx.permissions || []).includes(p))
}

export function requiredForApi(pathname: string): string[] | null {
  for (const { match, perms } of API_PERMISSIONS) {
    if (pathname === match || pathname.startsWith(match + '/')) return perms
  }
  return null
}
