// ============================================================
// src/app/teachers/pending/page.tsx
// MERGED: pending applications now live inside the Verification Queue
// (its "Pending" filter). This route just redirects there.
// ============================================================
import { redirect } from 'next/navigation'

export default function PendingTeachersPage() {
  redirect('/verification-queue')
}
