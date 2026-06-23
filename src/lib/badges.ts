// src/lib/badges.ts
// ════════════════════════════════════════════════════════════════════════════
// QURAN MENTOR GLOBAL — UNIFIED BADGE SYSTEM (SINGLE SOURCE OF TRUTH)
//
// This file is the ONE place that defines every badge on the platform: its key,
// name, category, icon, display group, and the rule that earns it. BOTH repos
// (qmg-frontend and qmg-admin) import this exact file, so a teacher's profile,
// the public listing, the student dashboard, and the admin panel can never show
// different badge names, icons, or rules.
//
// • Definitions (name/icon/category/rule) live here, in code — versioned + typed.
// • Awarded badges live in the `user_badges` table — who has what.
// • Thresholds default here but can be overridden by admin via `badge_config`
//   (passed into the evaluator as `cfg`), so admins tune numbers without a deploy.
//
// Drop this identical file at src/lib/badges.ts in BOTH repositories.
// ════════════════════════════════════════════════════════════════════════════

export type BadgeAudience = 'teacher' | 'student'
export type BadgeCategory =
  | 'trust' | 'performance' | 'specialization'   // teacher groups
  | 'progress' | 'attendance' | 'achievement'    // student groups
export type Assignment = 'auto' | 'manual' | 'auto_or_manual'

export interface BadgeDef {
  key: string
  audience: BadgeAudience
  category: BadgeCategory
  name: string
  description: string
  icon: BadgeIconKey       // premium SVG key (see BADGE_ICONS)
  tier: number             // weight: higher = more prestigious (sort + "highest badge")
  assignment: Assignment
  /** Default thresholds. Admin overrides merge over these at eval time. */
  criteria: Record<string, number>
}

// ── Signals fed to the evaluator (computed once per user from the DB) ──────────
export interface TeacherSignals {
  status: string                  // teacher_profiles.status
  is_active: boolean
  identity_verified: boolean
  quran_mentor_verified: boolean
  ijazah_verified: boolean
  email_verified: boolean
  phone_verified: boolean
  avg_rating: number
  total_reviews: number
  total_lessons: number
  completion_rate: number         // 0..100  (completed / (completed+cancelled))
  years_experience: number
  distinct_student_countries: number
  teaches_kids: boolean           // any course with age_group kids/children
  specializations: string[]       // course_type[] e.g. ['Tajweed','Hifz']
  suspended_recently: boolean     // standing flag
  median_response_hours: number   // median first-reply time to students
  response_samples: number        // number of measured replies
}

export interface StudentSignals {
  lessons_completed: number
  attendance_total: number        // graded lessons in lesson_attendance
  attendance_present: number
  attendance_late: number
  courses_completed: number       // enrollments at 100%
  completed_course_types: string[]// course_type[] of 100% courses
}

// ── THE CATALOG ───────────────────────────────────────────────────────────────
export const TEACHER_BADGES: BadgeDef[] = [
  // TRUST
  { key: 'verified_teacher', audience: 'teacher', category: 'trust', tier: 10,
    name: 'Verified Teacher', description: 'Identity verified and approved by QuranMentorGlobal.',
    icon: 'shield_check', assignment: 'auto', criteria: {} },
  { key: 'trusted_teacher', audience: 'teacher', category: 'trust', tier: 20,
    name: 'Trusted Teacher', description: 'Verified, in good standing, with a strong track record.',
    icon: 'shield_star', assignment: 'auto', criteria: { min_lessons: 50, min_rating: 4.0 } },
  { key: 'top_rated_teacher', audience: 'teacher', category: 'trust', tier: 30,
    name: 'Top Rated Teacher', description: 'Consistently excellent ratings from many students.',
    icon: 'rosette', assignment: 'auto', criteria: { min_rating: 4.8, min_reviews: 20 } },
  { key: 'elite_teacher', audience: 'teacher', category: 'trust', tier: 40,
    name: 'Elite Teacher', description: 'Top-rated, Ijazah-certified, with an exceptional volume of lessons.',
    icon: 'crown', assignment: 'auto', criteria: { min_rating: 4.8, min_reviews: 30, min_lessons: 500 } },

  // PERFORMANCE
  { key: 'reliable_teacher', audience: 'teacher', category: 'performance', tier: 15,
    name: 'Reliable Teacher', description: 'Rarely cancels — very high lesson completion rate.',
    icon: 'calendar_check', assignment: 'auto', criteria: { min_completion: 95, min_lessons: 30 } },
  { key: 'fast_response_teacher', audience: 'teacher', category: 'performance', tier: 12,
    name: 'Fast Response Teacher', description: 'Replies to student messages quickly.',
    icon: 'bolt', assignment: 'auto', criteria: { max_response_hours: 4, min_samples: 5 } },
  { key: 'global_teacher', audience: 'teacher', category: 'performance', tier: 14,
    name: 'Global Teacher', description: 'Teaches students across multiple countries.',
    icon: 'globe', assignment: 'auto', criteria: { min_countries: 3 } },
  { key: 'expert_teacher', audience: 'teacher', category: 'performance', tier: 18,
    name: 'Expert Teacher', description: 'Deep experience and a large body of completed lessons.',
    icon: 'medal', assignment: 'auto', criteria: { min_lessons: 1000, min_years: 10 } }, // either condition

  // SPECIALIZATION
  { key: 'tajweed_specialist', audience: 'teacher', category: 'specialization', tier: 5,
    name: 'Tajweed Specialist', description: 'Specialises in the rules of Tajweed.',
    icon: 'waveform', assignment: 'auto', criteria: {} },
  { key: 'hifz_specialist', audience: 'teacher', category: 'specialization', tier: 5,
    name: 'Hifz Specialist', description: 'Specialises in Quran memorisation (Hifz).',
    icon: 'book_heart', assignment: 'auto', criteria: {} },
  { key: 'tafseer_specialist', audience: 'teacher', category: 'specialization', tier: 5,
    name: 'Tafseer Specialist', description: 'Specialises in Quranic exegesis (Tafseer).',
    icon: 'scroll', assignment: 'auto', criteria: {} },
  { key: 'kids_specialist', audience: 'teacher', category: 'specialization', tier: 5,
    name: 'Kids Specialist', description: 'Experienced in teaching children.',
    icon: 'sparkle_face', assignment: 'auto_or_manual', criteria: {} },
]

export const STUDENT_BADGES: BadgeDef[] = [
  // PROGRESS
  { key: 'first_lesson_award', audience: 'student', category: 'progress', tier: 10,
    name: 'First Lesson Award', description: 'Completed your very first lesson.',
    icon: 'flag', assignment: 'auto', criteria: { min_lessons: 1 } },
  { key: 'active_learning_award', audience: 'student', category: 'progress', tier: 20,
    name: 'Active Learning Award', description: 'Completed 10 lessons.',
    icon: 'spark', assignment: 'auto', criteria: { min_lessons: 10 } },
  { key: 'dedicated_learning_award', audience: 'student', category: 'progress', tier: 30,
    name: 'Dedicated Learning Award', description: 'Completed 25 lessons.',
    icon: 'flame', assignment: 'auto', criteria: { min_lessons: 25 } },
  { key: 'quran_journey_award', audience: 'student', category: 'progress', tier: 40,
    name: 'Quran Journey Award', description: 'Completed 50 lessons.',
    icon: 'path', assignment: 'auto', criteria: { min_lessons: 50 } },

  // ATTENDANCE
  { key: 'perfect_attendance', audience: 'student', category: 'attendance', tier: 30,
    name: 'Perfect Attendance', description: 'Attended every lesson, with none missed.',
    icon: 'target', assignment: 'auto', criteria: { min_graded: 10, min_present_pct: 100 } },
  { key: 'consistent_attendance', audience: 'student', category: 'attendance', tier: 20,
    name: 'Consistent Attendance', description: 'Attended at least 90% of your lessons.',
    icon: 'calendar_check', assignment: 'auto', criteria: { min_graded: 10, min_present_pct: 90 } },
  { key: 'punctual_learner', audience: 'student', category: 'attendance', tier: 15,
    name: 'Punctual Learner', description: 'Always on time — no late arrivals.',
    icon: 'clock', assignment: 'auto', criteria: { min_graded: 10, max_late: 0 } },
  { key: 'attendance_champion', audience: 'student', category: 'attendance', tier: 25,
    name: 'Attendance Champion', description: 'Showed up for 30+ lessons.',
    icon: 'trophy', assignment: 'auto', criteria: { min_present: 30 } },

  // ACHIEVEMENT
  { key: 'tajweed_achievement', audience: 'student', category: 'achievement', tier: 20,
    name: 'Tajweed Achievement', description: 'Completed a Tajweed course.',
    icon: 'waveform', assignment: 'auto', criteria: {} },
  { key: 'hifz_achievement', audience: 'student', category: 'achievement', tier: 20,
    name: 'Hifz Achievement', description: 'Completed a Hifz course.',
    icon: 'book_heart', assignment: 'auto', criteria: {} },
  { key: 'course_achievement', audience: 'student', category: 'achievement', tier: 15,
    name: 'Course Achievement', description: 'Completed your first full course.',
    icon: 'certificate', assignment: 'auto', criteria: { min_courses: 1 } },
  { key: 'quran_achievement', audience: 'student', category: 'achievement', tier: 30,
    name: 'Quran Achievement', description: 'Completed three or more courses.',
    icon: 'star_burst', assignment: 'auto', criteria: { min_courses: 3 } },
]

export const ALL_BADGES: BadgeDef[] = [...TEACHER_BADGES, ...STUDENT_BADGES]
export const BADGE_BY_KEY: Record<string, BadgeDef> =
  Object.fromEntries(ALL_BADGES.map(b => [b.key, b]))

// Display groups (Phase 6 — professional grouping, never random)
export const TEACHER_GROUPS: { category: BadgeCategory; label: string }[] = [
  { category: 'trust', label: 'Verification & Trust' },
  { category: 'specialization', label: 'Specializations' },
  { category: 'performance', label: 'Performance' },
]
export const STUDENT_GROUPS: { category: BadgeCategory; label: string }[] = [
  { category: 'progress', label: 'Learning Progress' },
  { category: 'attendance', label: 'Attendance' },
  { category: 'achievement', label: 'Achievements' },
]

// ── EVALUATORS — pure functions, no I/O. Same logic everywhere. ────────────────
function thr(b: BadgeDef, cfg?: Record<string, Record<string, number>>): Record<string, number> {
  return { ...b.criteria, ...(cfg?.[b.key] || {}) }
}

/** Returns the badge keys a teacher currently QUALIFIES for (auto rules only). */
export function evaluateTeacherBadges(
  s: TeacherSignals,
  cfg?: Record<string, Record<string, number>>
): string[] {
  const approved = s.status === 'approved' && s.is_active
  const out: string[] = []
  const has = (k: string) => { const b = BADGE_BY_KEY[k]; if (b) out.push(k) }
  const c = (k: string) => thr(BADGE_BY_KEY[k], cfg)

  // Trust
  if (approved && s.identity_verified) has('verified_teacher')
  if (approved && s.identity_verified && !s.suspended_recently &&
      s.total_lessons >= c('trusted_teacher').min_lessons &&
      s.avg_rating >= c('trusted_teacher').min_rating) has('trusted_teacher')
  if (approved && s.avg_rating >= c('top_rated_teacher').min_rating &&
      s.total_reviews >= c('top_rated_teacher').min_reviews) has('top_rated_teacher')
  if (approved && s.ijazah_verified &&
      s.avg_rating >= c('elite_teacher').min_rating &&
      s.total_reviews >= c('elite_teacher').min_reviews &&
      s.total_lessons >= c('elite_teacher').min_lessons) has('elite_teacher')

  // Performance
  if (approved && s.total_lessons >= c('reliable_teacher').min_lessons &&
      s.completion_rate >= c('reliable_teacher').min_completion) has('reliable_teacher')
  if (approved && s.distinct_student_countries >= c('global_teacher').min_countries) has('global_teacher')
  if (approved && (s.total_lessons >= c('expert_teacher').min_lessons ||
      s.years_experience >= c('expert_teacher').min_years)) has('expert_teacher')
  if (approved && s.response_samples >= c('fast_response_teacher').min_samples &&
      s.median_response_hours <= c('fast_response_teacher').max_response_hours) has('fast_response_teacher')

  // Specialization
  const sp = (s.specializations || []).map(x => String(x).toLowerCase())
  if (approved && sp.includes('tajweed')) has('tajweed_specialist')
  if (approved && sp.includes('hifz')) has('hifz_specialist')
  if (approved && sp.includes('tafseer')) has('tafseer_specialist')
  if (approved && s.teaches_kids) has('kids_specialist')

  return out
}

/** Returns the badge keys a student currently QUALIFIES for (auto rules only). */
export function evaluateStudentBadges(
  s: StudentSignals,
  cfg?: Record<string, Record<string, number>>
): string[] {
  const out: string[] = []
  const has = (k: string) => out.push(k)
  const c = (k: string) => thr(BADGE_BY_KEY[k], cfg)
  const presentPct = s.attendance_total > 0 ? (s.attendance_present / s.attendance_total) * 100 : 0
  const types = (s.completed_course_types || []).map(x => String(x).toLowerCase())

  // Progress
  if (s.lessons_completed >= c('first_lesson_award').min_lessons) has('first_lesson_award')
  if (s.lessons_completed >= c('active_learning_award').min_lessons) has('active_learning_award')
  if (s.lessons_completed >= c('dedicated_learning_award').min_lessons) has('dedicated_learning_award')
  if (s.lessons_completed >= c('quran_journey_award').min_lessons) has('quran_journey_award')

  // Attendance
  if (s.attendance_total >= c('perfect_attendance').min_graded && presentPct >= c('perfect_attendance').min_present_pct) has('perfect_attendance')
  if (s.attendance_total >= c('consistent_attendance').min_graded && presentPct >= c('consistent_attendance').min_present_pct) has('consistent_attendance')
  if (s.attendance_total >= c('punctual_learner').min_graded && s.attendance_late <= c('punctual_learner').max_late) has('punctual_learner')
  if (s.attendance_present >= c('attendance_champion').min_present) has('attendance_champion')

  // Achievement
  if (types.includes('tajweed')) has('tajweed_achievement')
  if (types.includes('hifz')) has('hifz_achievement')
  if (s.courses_completed >= c('course_achievement').min_courses) has('course_achievement')
  if (s.courses_completed >= c('quran_achievement').min_courses) has('quran_achievement')

  return out
}

// ── PREMIUM SVG ICONS — equal 24×24 viewBox, single-stroke, theme via `color` ──
export type BadgeIconKey =
  | 'shield_check' | 'shield_star' | 'rosette' | 'crown' | 'calendar_check'
  | 'bolt' | 'globe' | 'medal' | 'waveform' | 'book_heart' | 'scroll'
  | 'sparkle_face' | 'flag' | 'spark' | 'flame' | 'path' | 'target' | 'clock'
  | 'trophy' | 'certificate' | 'star_burst'

// Path data only — the component wraps these in a themed <svg>. Keeps icons
// identical everywhere and the same visual weight.
export const BADGE_ICON_PATHS: Record<BadgeIconKey, string> = {
  shield_check:  'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
  shield_star:   'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M12 7.5l1.3 2.6 2.9.4-2.1 2 .5 2.8-2.6-1.3-2.6 1.3.5-2.8-2.1-2 2.9-.4z',
  rosette:       'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M8.5 13.5 7 22l5-3 5 3-1.5-8.5',
  crown:         'M3 8l4 3 5-6 5 6 4-3-2 11H5z M5 19h14',
  calendar_check:'M3 5h18v16H3z M3 9h18 M8 3v4 M16 3v4 M9 15l2 2 4-4',
  bolt:          'M13 2 4 14h6l-1 8 9-12h-6z',
  globe:         'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2a15 15 0 0 1 0 20 M12 2a15 15 0 0 0 0 20',
  medal:         'M8 2h8l-2 7H10z M12 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M12 13.5l1.2 2.4 2.6.3-1.9 1.8.5 2.5-2.4-1.2-2.4 1.2.5-2.5-1.9-1.8 2.6-.3z',
  waveform:      'M3 12h2l2-6 3 14 3-18 3 14 2-4h3',
  book_heart:    'M4 4h13a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z M11.5 9.2c-.9-1-2.6-.4-2.6 1 0 1.4 2.6 3 2.6 3s2.6-1.6 2.6-3c0-1.4-1.7-2-2.6-1z',
  scroll:        'M6 3h11a2 2 0 0 1 2 2v12a3 3 0 0 0 3 3H8a2 2 0 0 1-2-2z M6 3a2 2 0 0 0-2 2v2h2 M9 8h7 M9 12h7',
  sparkle_face:  'M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5z M6 16a6 6 0 0 0 12 0 M9 19h.01 M15 19h.01',
  flag:          'M5 3v18 M5 4h11l-2 4 2 4H5',
  spark:         'M12 2v6 M12 16v6 M2 12h6 M16 12h6 M5 5l4 4 M15 15l4 4 M19 5l-4 4 M9 15l-4 4',
  flame:         'M12 2c2 4 6 5 6 10a6 6 0 0 1-12 0c0-3 2-4 3-6 1 1 1 2 1 3 1-1 2-4 2-7z',
  path:          'M6 20c0-6 12-6 12-12a3 3 0 0 0-6 0c0 4 8 4 8 10 M6 20h.01',
  target:        'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  clock:         'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 7v5l3 2',
  trophy:        'M7 4h10v4a5 5 0 0 1-10 0z M5 4H3v2a3 3 0 0 0 3 3 M19 4h2v2a3 3 0 0 1-3 3 M9 14h6 M10 14l-1 6h6l-1-6 M8 20h8',
  certificate:   'M5 3h14v12H5z M8 18l-1 3 5-2 5 2-1-3 M9 7h6 M9 10h4',
  star_burst:    'M12 2l1.8 4.2L18 4l-1.2 4.4L21 11l-4.2 1.2L18 16l-4.4-1.2L12 20l-1.6-5.2L6 16l1.2-3.8L3 11l4.2-2.6L6 4l4.2 2.2z',
}

// ── Human-readable "how it's earned" — used by the Badge Guide / help center ──
export function criteriaText(def: BadgeDef, cfg?: Record<string, Record<string, number>>): string {
  const c = { ...def.criteria, ...(cfg?.[def.key] || {}) }
  switch (def.key) {
    // Teacher — trust
    case 'verified_teacher':    return 'Awarded automatically once the teacher is approved and identity-verified.'
    case 'trusted_teacher':     return `Verified and in good standing, with at least ${c.min_lessons} completed lessons and a ${c.min_rating}★+ rating.`
    case 'top_rated_teacher':   return `Maintains a ${c.min_rating}★+ average rating across ${c.min_reviews}+ reviews.`
    case 'elite_teacher':       return `Ijazah-certified with a ${c.min_rating}★+ rating, ${c.min_reviews}+ reviews, and ${c.min_lessons}+ completed lessons.`
    // Teacher — performance
    case 'reliable_teacher':    return `Keeps a ${c.min_completion}%+ lesson completion rate across ${c.min_lessons}+ lessons (rarely cancels).`
    case 'fast_response_teacher': return `Median reply time under ${c.max_response_hours} hours across at least ${c.min_samples} student messages.`
    case 'global_teacher':      return `Teaches students from at least ${c.min_countries} different countries.`
    case 'expert_teacher':      return `Has ${c.min_lessons}+ completed lessons or ${c.min_years}+ years of teaching experience.`
    // Teacher — specialization
    case 'tajweed_specialist':  return 'Lists Tajweed among their specializations (approved teachers).'
    case 'hifz_specialist':     return 'Lists Hifz among their specializations (approved teachers).'
    case 'tafseer_specialist':  return 'Lists Tafseer among their specializations (approved teachers).'
    case 'kids_specialist':     return 'Teaches courses for children, or granted manually by an admin.'
    // Student — progress
    case 'first_lesson_award':      return 'Complete your first lesson.'
    case 'active_learning_award':   return `Complete ${c.min_lessons} lessons.`
    case 'dedicated_learning_award':return `Complete ${c.min_lessons} lessons.`
    case 'quran_journey_award':     return `Complete ${c.min_lessons} lessons.`
    // Student — attendance
    case 'perfect_attendance':  return `Attend 100% of your lessons (minimum ${c.min_graded} graded lessons).`
    case 'consistent_attendance': return `Attend at least ${c.min_present_pct}% of your lessons (minimum ${c.min_graded}).`
    case 'punctual_learner':    return `No late arrivals across at least ${c.min_graded} lessons.`
    case 'attendance_champion': return `Attend ${c.min_present}+ lessons.`
    // Student — achievement
    case 'tajweed_achievement': return 'Complete a Tajweed course.'
    case 'hifz_achievement':    return 'Complete a Hifz course.'
    case 'course_achievement':  return `Complete ${c.min_courses} full course.`
    case 'quran_achievement':   return `Complete ${c.min_courses}+ courses.`
    default: return def.description
  }
}

// Assignment label for display
export function assignmentLabel(def: BadgeDef): string {
  if (def.assignment === 'manual') return 'Admin-assigned'
  if (def.assignment === 'auto_or_manual') return 'Automatic or admin-assigned'
  return 'Automatic'
}
