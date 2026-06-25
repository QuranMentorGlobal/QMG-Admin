// ============================================================
// src/lib/permissions.ts
// Single source of truth for the Super/Sub-Admin permission model.
// Shared by middleware, API guards, sidebar rendering and dashboard widgets.
// ============================================================

export type AdminRole = 'super' | 'sub' | null

export interface PermItem { key: string; label: string; desc?: string }
export interface PermGroup { key: string; label: string; desc?: string; perms: PermItem[] }

// ── The full permission matrix ──────────────────────────────────────────────
export const PERMISSION_GROUPS: PermGroup[] = [
  {
    key: 'teachers', label: 'Teacher Management', desc: 'View, approve, reject and suspend teacher accounts.', perms: [
      { key: 'teachers.view', label: 'View Teachers' },
      { key: 'teachers.approve', label: 'Approve Teachers' },
      { key: 'teachers.reject', label: 'Reject Teachers' },
      { key: 'teachers.suspend', label: 'Suspend Teachers' },
    ],
  },
  {
    key: 'students', label: 'Student Management', desc: 'View students and toggle their account access.', perms: [
      { key: 'students.view', label: 'View Students' },
      { key: 'students.toggle', label: 'Activate / Deactivate Students' },
    ],
  },
  {
    key: 'courses', label: 'Courses Hub', desc: 'Oversee every course across the platform.', perms: [
      { key: 'courses.view', label: 'View Courses Hub' },
    ],
  },
  {
    key: 'bookings', label: 'Bookings', desc: 'View and manage all lesson bookings.', perms: [
      { key: 'bookings.view', label: 'View Bookings' },
      { key: 'bookings.manage', label: 'Manage Bookings' },
    ],
  },
  {
    key: 'attendance', label: 'Attendance Center', desc: 'View attendance analytics and absence anomalies.', perms: [
      { key: 'attendance.view', label: 'View Attendance Center' },
    ],
  },
  {
    key: 'reviews', label: 'Reviews', desc: 'View, publish and unpublish teacher reviews.', perms: [
      { key: 'reviews.view', label: 'View Reviews' },
      { key: 'reviews.publish', label: 'Publish Reviews' },
      { key: 'reviews.unpublish', label: 'Unpublish Reviews' },
    ],
  },
  {
    key: 'moderation', label: 'Trust & Safety', desc: 'Review flagged conversations and resolve safety reports.', perms: [
      { key: 'moderation.view', label: 'View Trust & Safety' },
      { key: 'moderation.action', label: 'Resolve / Dismiss Flags' },
    ],
  },
  {
    key: 'support', label: 'Support', desc: 'Respond to, prioritise and resolve support tickets.', perms: [
      { key: 'support.view', label: 'View Tickets' },
      { key: 'support.manage', label: 'Manage Tickets' },
    ],
  },
  {
    key: 'payments', label: 'Payments & Refunds', desc: 'View payments and revenue; process refunds.', perms: [
      { key: 'payments.view', label: 'View Payments & Refunds' },
      { key: 'payments.manage', label: 'Manage Payments' },
    ],
  },
  {
    key: 'finance', label: 'Finance Management', desc: 'Payout review, manual payment processing and financial reports. Scoped to money only — no access to teachers, students, settings or verification.', perms: [
      { key: 'finance.view', label: 'View Finance / Payouts' },
      { key: 'finance.review', label: 'Approve / Reject Payout Requests' },
      { key: 'finance.process', label: 'Process Payments & Upload Proof' },
    ],
  },
  {
    key: 'analytics', label: 'Analytics', desc: 'Dashboards, deep analytics and report exports.', perms: [
      { key: 'analytics.dashboard', label: 'View Dashboard' },
      { key: 'analytics.deep', label: 'View Deep Analytics' },
      { key: 'analytics.export', label: 'Export Reports' },
    ],
  },
  {
    key: 'verification', label: 'Verification', desc: 'Review and decide teacher verification applications.', perms: [
      { key: 'verification.access', label: 'Access Verification Queue' },
      { key: 'verification.approve', label: 'Approve Verification' },
      { key: 'verification.reject', label: 'Reject Verification' },
    ],
  },
  {
    key: 'badges', label: 'Badges', desc: 'View, assign and remove teacher badges.', perms: [
      { key: 'badges.view', label: 'View Badges' },
      { key: 'badges.manage', label: 'Assign / Remove Badges' },
    ],
  },
  {
    key: 'settings', label: 'Platform Settings', desc: 'View and edit platform configuration.', perms: [
      { key: 'settings.view', label: 'View Settings' },
      { key: 'settings.edit', label: 'Edit Settings' },
    ],
  },
  {
    key: 'audit', label: 'Audit Logs', desc: 'View the admin activity audit trail.', perms: [
      { key: 'audit.view', label: 'View Audit Logs' },
    ],
  },
  {
    key: 'admin', label: 'Admin Management', desc: 'Create, edit and remove sub-admin accounts.', perms: [
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
  '/attendance': ['attendance.view', 'analytics.deep'],
  '/teachers': ['teachers.view'],
  '/courses-hub': ['courses.view', 'teachers.view', 'analytics.dashboard'],
  '/verification-queue': ['verification.access'],
  '/re-verification': ['verification.access'],
  '/badges': ['badges.view', 'badges.manage'],
  '/badge-guide': ['badges.view', 'badges.manage'],
  '/moderation': ['moderation.view', 'support.view'],
  '/students': ['students.view'],
  '/bookings': ['bookings.view'],
  '/reviews': ['reviews.view'],
  '/payments': ['payments.view'],
  '/refunds': ['payments.view'],
  '/payouts': ['finance.view', 'payments.view'],
  '/finance-reports': ['finance.view', 'analytics.dashboard'],
  '/support': ['support.view'],
  '/settings': ['settings.view'],
  '/admin-management': ['admin.create', 'admin.edit', 'admin.delete'],
  '/audit-log': ['audit.view', 'admin.create', 'admin.edit', 'admin.delete'],
  '/email-logs': ['analytics.deep'],
  '/announcements': ['settings.view'],
}

// ── API path → permission(s) required (any-of). ──────────────────────────────
export const API_PERMISSIONS: { match: string; perms: string[] }[] = [
  { match: '/api/sub-admins', perms: ['admin.create', 'admin.edit', 'admin.delete'] },
  { match: '/api/admin-payouts', perms: ['finance.review', 'finance.process', 'payments.manage'] },
  { match: '/api/finance', perms: ['finance.view', 'finance.review', 'finance.process'] },
  { match: '/api/review-teacher', perms: ['teachers.approve', 'teachers.reject', 'verification.approve', 'verification.reject'] },
  { match: '/api/verification-action', perms: ['verification.approve', 'verification.reject'] },
  { match: '/api/verification-queue', perms: ['verification.access'] },
  { match: '/api/pending-teachers', perms: ['verification.access', 'teachers.view'] },
  { match: '/api/analytics/deep', perms: ['analytics.deep'] },
  { match: '/api/analytics', perms: ['analytics.dashboard'] },
  { match: '/api/stats', perms: ['analytics.dashboard'] },
  { match: '/api/courses-hub', perms: ['courses.view', 'teachers.view', 'analytics.dashboard'] },
  { match: '/api/attendance-analytics', perms: ['attendance.view', 'analytics.deep'] },
  { match: '/api/moderation-action', perms: ['moderation.action', 'support.manage'] },
  { match: '/api/moderation', perms: ['moderation.view', 'support.view'] },
  { match: '/api/audit-log', perms: ['audit.view', 'admin.create', 'admin.edit', 'admin.delete'] },
]

// ── Default Sub-Admin role presets ───────────────────────────────────────────
export const ROLE_PRESETS: { key: string; label: string; description: string; perms: string[] }[] = [
  {
    key: 'verification', label: 'Verification Manager', description: 'Teacher verification only.',
    perms: ['verification.access', 'verification.approve', 'verification.reject', 'teachers.view'],
  },
  {
    key: 'support', label: 'Support Manager', description: 'Support tickets, reviews and Trust & Safety.',
    perms: ['support.view', 'support.manage', 'reviews.view', 'reviews.publish', 'reviews.unpublish', 'moderation.view', 'moderation.action'],
  },
  {
    key: 'operations', label: 'Operations Manager', description: 'Teachers, students, courses, bookings and attendance.',
    perms: ['teachers.view', 'teachers.approve', 'teachers.reject', 'teachers.suspend', 'students.view', 'students.toggle', 'courses.view', 'bookings.view', 'bookings.manage', 'attendance.view'],
  },
  {
    key: 'finance_reviewer', label: 'Finance — Payout Reviewer', description: 'Review, approve and reject payout requests.',
    perms: ['finance.view', 'finance.review', 'analytics.export'],
  },
  {
    key: 'finance_processor', label: 'Finance — Payment Processor', description: 'Process payouts, upload proof, mark paid / failed.',
    perms: ['finance.view', 'finance.process', 'analytics.export'],
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
