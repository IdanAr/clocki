# Clocki Manager Features — Implementation Plan (3 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all manager-facing screens: approval queue, approve/reject timesheet with per-entry notes, team list, team member timesheet + absence views, and a basic reports hub.

**Architecture:** Manager routes live under `app/(manager)/` with a shared layout that enforces role ≥ manager. Server Components fetch data; mutations go through Server Actions in `lib/actions/manager.ts`. The approval detail page contains the only Client Component (editable per-entry notes before approving). All manager routes are also accessible to admins (role check: `role in ('manager', 'admin')`).

**Tech Stack:** Next.js 15 App Router, Supabase (`@supabase/ssr`), next-intl, Tailwind CSS v4, Vitest

---

## Codebase Context (read before implementing)

```
app/(employee)/layout.tsx            ← auth guard + AppShell pattern to follow
lib/supabase/server.ts               ← async createClient()
lib/supabase/middleware-client.ts    ← getRedirectForRole already handles /manager
middleware.ts                        ← already guards /manager routes by role
types/database.ts                    ← all DB types
messages/he.json + en.json          ← Task 1 adds manager i18n keys
components/layout/Sidebar.tsx        ← already shows manager nav links for manager/admin
```

**Key existing RLS policies (already in DB):**
- Managers can SELECT timesheets where `is_my_direct_report(employee_id)` 
- Managers can UPDATE timesheets (approve/reject)
- Managers can UPDATE timesheet_entries (add manager notes)
- `is_my_direct_report(uuid)` = `users.manager_id = auth.uid()`

---

## File Map

```
lib/
  actions/
    manager.ts                       ← approveTimesheet, rejectTimesheet, saveManagerEntryNote
app/
  (manager)/
    layout.tsx                       ← role guard (manager or admin) + AppShell
    approvals/
      page.tsx                       ← Server Component: submitted timesheets queue
      [id]/page.tsx                  ← Client Component: review + approve/reject
    team/
      page.tsx                       ← Server Component: team member list
      [userId]/
        timesheet/page.tsx           ← Server Component: team member timesheet list
        absences/page.tsx            ← Server Component: team member absences
    reports/
      page.tsx                       ← Server Component: report hub with summary cards
      hours-by-project/page.tsx      ← Server Component: hours grouped by project
      absences/page.tsx              ← Server Component: absence list for all team members
messages/
  he.json                            ← add manager section keys
  en.json                            ← add manager section keys
```

---

## Task 1: Manager i18n keys

**Files:**
- Modify: `messages/he.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add manager keys to `messages/en.json`**

Open `messages/en.json`. After the `"profile"` object, add:

```json
"manager": {
  "approvals": "Approvals",
  "approvalsEmpty": "No timesheets awaiting approval.",
  "approveBtn": "Approve",
  "rejectBtn": "Reject",
  "approveConfirm": "Approve this timesheet?",
  "rejectConfirm": "Reject this timesheet? The employee will need to resubmit.",
  "approved": "Approved",
  "rejected": "Rejected",
  "addManagerNote": "Add note to entry...",
  "team": "My Team",
  "teamEmpty": "No direct reports found.",
  "viewTimesheet": "View timesheets",
  "viewAbsences": "View absences",
  "reports": "Reports",
  "reportHours": "Hours by Project",
  "reportAbsences": "Team Absences",
  "reportEmployeeDetails": "Employee Details",
  "noData": "No data for this period.",
  "employee": "Employee",
  "totalHours": "Total hours",
  "submittedAt": "Submitted",
  "periodLabel": "Period"
}
```

- [ ] **Step 2: Add manager keys to `messages/he.json`**

After the `"profile"` object, add:

```json
"manager": {
  "approvals": "אישורים",
  "approvalsEmpty": "אין גיליונות ממתינים לאישור.",
  "approveBtn": "אשר",
  "rejectBtn": "דחה",
  "approveConfirm": "לאשר גיליון זה?",
  "rejectConfirm": "לדחות גיליון זה? העובד יצטרך לשלוח מחדש.",
  "approved": "אושר",
  "rejected": "נדחה",
  "addManagerNote": "הוסף הערה לרשומה...",
  "team": "הצוות שלי",
  "teamEmpty": "לא נמצאו עובדים תחת ניהולך.",
  "viewTimesheet": "צפה בגיליונות",
  "viewAbsences": "צפה בהיעדרויות",
  "reports": "דוחות",
  "reportHours": "שעות לפי פרויקט",
  "reportAbsences": "היעדרויות צוות",
  "reportEmployeeDetails": "פרטי עובד",
  "noData": "אין נתונים לתקופה זו.",
  "employee": "עובד",
  "totalHours": "סה\"כ שעות",
  "submittedAt": "נשלח",
  "periodLabel": "תקופה"
}
```

- [ ] **Step 3: Run tests (must still pass)**

```bash
npm test
```

Expected: 24 tests pass.

- [ ] **Step 4: Commit**

```bash
git add messages/
git commit -m "feat: add manager i18n keys (he + en)"
```

---

## Task 2: Manager server actions

**Files:**
- Create: `lib/actions/manager.ts`

- [ ] **Step 1: Create `lib/actions/manager.ts`**

```typescript
// lib/actions/manager.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function assertManagerOf(supabase: Awaited<ReturnType<typeof createClient>>, timesheetId: string, userId: string) {
  // Manager must be the direct manager of the timesheet's employee
  const { data: ts } = await supabase
    .from('timesheets')
    .select('employee_id, status')
    .eq('id', timesheetId)
    .single()

  if (!ts) throw new Error('Timesheet not found')

  const { data: emp } = await supabase
    .from('users')
    .select('manager_id')
    .eq('id', ts.employee_id)
    .single()

  if (!emp || emp.manager_id !== userId) throw new Error('Forbidden')
  return ts
}

export async function approveTimesheet(timesheetId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  try {
    const ts = await assertManagerOf(supabase, timesheetId, user.id)
    if (ts.status !== 'submitted') return { success: false, error: 'Timesheet is not in submitted state' }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Forbidden' }
  }

  const { error } = await supabase
    .from('timesheets')
    .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', timesheetId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/manager/approvals')
  return { success: true }
}

export async function rejectTimesheet(timesheetId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  try {
    const ts = await assertManagerOf(supabase, timesheetId, user.id)
    if (ts.status !== 'submitted') return { success: false, error: 'Timesheet is not in submitted state' }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Forbidden' }
  }

  const { error } = await supabase
    .from('timesheets')
    .update({ status: 'rejected', approved_by: null, approved_at: null })
    .eq('id', timesheetId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/manager/approvals')
  return { success: true }
}

export async function saveManagerEntryNote(entryId: string, note: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Verify the entry belongs to a timesheet whose employee reports to this manager
  const { data: entry } = await supabase
    .from('timesheet_entries')
    .select('timesheet_id')
    .eq('id', entryId)
    .single()

  if (!entry) return { success: false, error: 'Entry not found' }

  try {
    await assertManagerOf(supabase, entry.timesheet_id, user.id)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Forbidden' }
  }

  const { error } = await supabase
    .from('timesheet_entries')
    .update({ manager_notes: note || null })
    .eq('id', entryId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 24 tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/manager.ts
git commit -m "feat: add manager server actions (approve, reject, manager entry notes)"
```

---

## Task 3: Manager layout

**Files:**
- Create: `app/(manager)/layout.tsx`

- [ ] **Step 1: Create `app/(manager)/layout.tsx`**

```tsx
// app/(manager)/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'manager' && profile.role !== 'admin')) {
    redirect('/timesheet/daily')
  }

  return <AppShell role={profile.role}>{children}</AppShell>
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 24 tests pass.

- [ ] **Step 3: Commit**

```bash
git add "app/(manager)/layout.tsx"
git commit -m "feat: add manager layout with role guard (manager or admin)"
```

---

## Task 4: Approval queue page

**Files:**
- Create: `app/(manager)/manager/approvals/page.tsx`

- [ ] **Step 1: Create `app/(manager)/manager/approvals/page.tsx`**

```tsx
// app/(manager)/manager/approvals/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function ApprovalsPage() {
  const t = await getTranslations('manager')
  const ts_t = await getTranslations('timesheet')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch submitted timesheets from direct reports
  const { data: timesheets } = await supabase
    .from('timesheets')
    .select('*, users!timesheets_employee_id_fkey(full_name_he, full_name_en, employee_number)')
    .eq('status', 'submitted')
    .order('created_at', { ascending: true })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-800">{t('approvals')}</h1>

      {!timesheets || timesheets.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-16">
          <p className="text-gray-400">{t('approvalsEmpty')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('employee')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('periodLabel')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('submittedAt')}</th>
                <th className="px-4 py-3 text-end font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {timesheets.map(ts => {
                const emp = ts.users as unknown as { full_name_he: string; full_name_en: string; employee_number: string | null } | null
                return (
                  <tr key={ts.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{emp?.full_name_he ?? '—'}</div>
                      {emp?.employee_number && (
                        <div className="text-xs text-gray-400">#{emp.employee_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {ts.period_start} – {ts.period_end}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(ts.created_at).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Link
                        href={`/manager/approvals/${ts.id}`}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                      >
                        סקור →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(manager)/manager/approvals/page.tsx"
git commit -m "feat: manager approval queue page"
```

---

## Task 5: Approval detail page (review + approve/reject)

**Files:**
- Create: `app/(manager)/manager/approvals/[id]/page.tsx`

This is a Client Component because the manager edits per-entry notes inline before approving.

- [ ] **Step 1: Create `app/(manager)/manager/approvals/[id]/page.tsx`**

```tsx
// app/(manager)/manager/approvals/[id]/page.tsx
'use client'
import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { approveTimesheet, rejectTimesheet, saveManagerEntryNote } from '@/lib/actions/manager'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

type Entry = {
  id: string
  work_date: string
  hours: number
  employee_notes: string | null
  manager_notes: string | null
  project_id: string
  projects: { name_he: string; name_en: string; code: string } | null
}

type Timesheet = {
  id: string
  status: string
  period_start: string
  period_end: string
  employee_id: string
  users: { full_name_he: string; full_name_en: string; employee_number: string | null } | null
}

export default function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations('manager')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [id, setId] = useState('')
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then(p => setId(p.id))
  }, [params])

  useEffect(() => {
    if (!id) return
    const supabase = createClient()

    Promise.all([
      supabase
        .from('timesheets')
        .select('*, users!timesheets_employee_id_fkey(full_name_he, full_name_en, employee_number)')
        .eq('id', id)
        .single(),
      supabase
        .from('timesheet_entries')
        .select('*, projects(name_he, name_en, code)')
        .eq('timesheet_id', id)
        .order('work_date'),
    ]).then(([tsResult, entriesResult]) => {
      const ts = tsResult.data as unknown as Timesheet
      const ents = (entriesResult.data ?? []) as unknown as Entry[]
      setTimesheet(ts)
      setEntries(ents)
      const initialNotes: Record<string, string> = {}
      ents.forEach(e => { initialNotes[e.id] = e.manager_notes ?? '' })
      setNotes(initialNotes)
      setLoading(false)
    })
  }, [id])

  const handleApprove = () => {
    if (!confirm(t('approveConfirm'))) return
    startTransition(async () => {
      // Save all notes first
      await Promise.all(
        entries
          .filter(e => notes[e.id] !== (e.manager_notes ?? ''))
          .map(e => saveManagerEntryNote(e.id, notes[e.id]))
      )
      const result = await approveTimesheet(id)
      if (result.success) {
        router.push('/manager/approvals')
      } else {
        setError(result.error ?? 'Failed')
      }
    })
  }

  const handleReject = () => {
    if (!confirm(t('rejectConfirm'))) return
    startTransition(async () => {
      const result = await rejectTimesheet(id)
      if (result.success) {
        router.push('/manager/approvals')
      } else {
        setError(result.error ?? 'Failed')
      }
    })
  }

  if (loading) {
    return <div className="p-8 text-gray-400">טוען...</div>
  }

  if (!timesheet) {
    return <div className="p-8 text-red-600">גיליון לא נמצא</div>
  }

  const emp = timesheet.users
  const totalHours = entries.reduce((s, e) => s + Number(e.hours), 0)
  const isSubmitted = timesheet.status === 'submitted'

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/manager/approvals" className="text-sm text-blue-600 hover:underline">
            ← {t('approvals')}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-gray-800">
            {emp?.full_name_he ?? '—'}
            {emp?.employee_number && <span className="ms-2 text-base font-normal text-gray-400">#{emp.employee_number}</span>}
          </h1>
          <p className="text-sm text-gray-500">
            {timesheet.period_start} – {timesheet.period_end}
          </p>
        </div>

        {isSubmitted && (
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={isPending}
              className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {t('rejectBtn')}
            </button>
            <button
              onClick={handleApprove}
              disabled={isPending}
              className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              {t('approveBtn')}
            </button>
          </div>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      {/* Entries table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-start font-medium text-gray-500 w-32">תאריך</th>
              <th className="px-4 py-3 text-start font-medium text-gray-500">פרויקט</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 w-16">שעות</th>
              <th className="px-4 py-3 text-start font-medium text-gray-500">הערות עובד</th>
              <th className="px-4 py-3 text-start font-medium text-gray-500">הערות ממונה</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  אין רשומות בגיליון זה
                </td>
              </tr>
            )}
            {entries.map(e => (
              <tr key={e.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium">{e.work_date}</td>
                <td className="px-4 py-3">
                  {e.projects ? `${e.projects.name_he} (${e.projects.code})` : '—'}
                </td>
                <td className="px-4 py-3 text-center">{e.hours}</td>
                <td className="px-4 py-3 text-gray-500 italic">
                  {e.employee_notes ?? '—'}
                </td>
                <td className="px-4 py-3">
                  {isSubmitted ? (
                    <input
                      type="text"
                      value={notes[e.id] ?? ''}
                      onChange={ev => setNotes(prev => ({ ...prev, [e.id]: ev.target.value }))}
                      placeholder={t('addManagerNote')}
                      className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
                    />
                  ) : (
                    <span className="italic text-gray-500">{e.manager_notes ?? '—'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td colSpan={2} className="px-4 py-3 font-semibold">סה״כ</td>
              <td className="px-4 py-3 text-center font-bold">{totalHours}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(manager)/manager/approvals/[id]/page.tsx"
git commit -m "feat: approval detail page with per-entry manager notes and approve/reject"
```

---

## Task 6: Team list + team member views

**Files:**
- Create: `app/(manager)/manager/team/page.tsx`
- Create: `app/(manager)/manager/team/[userId]/timesheet/page.tsx`
- Create: `app/(manager)/manager/team/[userId]/absences/page.tsx`

- [ ] **Step 1: Create `app/(manager)/manager/team/page.tsx`**

```tsx
// app/(manager)/manager/team/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function TeamPage() {
  const t = await getTranslations('manager')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: teamMembers } = await supabase
    .from('users')
    .select('id, full_name_he, full_name_en, employee_number, role, departments(name_he)')
    .eq('manager_id', user.id)
    .order('full_name_he')

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-800">{t('team')}</h1>

      {!teamMembers || teamMembers.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-16">
          <p className="text-gray-400">{t('teamEmpty')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">שם</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">מחלקה</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">תפקיד</th>
                <th className="px-4 py-3 text-end font-medium text-gray-500">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map(member => {
                const dept = member.departments as unknown as { name_he: string } | null
                return (
                  <tr key={member.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{member.full_name_he}</div>
                      {member.employee_number && (
                        <div className="text-xs text-gray-400">#{member.employee_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{dept?.name_he ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {member.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex justify-end gap-3">
                        <Link
                          href={`/manager/team/${member.id}/timesheet`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {t('viewTimesheet')}
                        </Link>
                        <Link
                          href={`/manager/team/${member.id}/absences`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {t('viewAbsences')}
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(manager)/manager/team/[userId]/timesheet/page.tsx`**

```tsx
// app/(manager)/manager/team/[userId]/timesheet/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function TeamMemberTimesheetPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const t = await getTranslations('timesheet')
  const tm = await getTranslations('manager')
  const supabase = await createClient()

  const { data: member } = await supabase
    .from('users')
    .select('full_name_he, full_name_en, employee_number')
    .eq('id', userId)
    .single()

  if (!member) notFound()

  const { data: timesheets } = await supabase
    .from('timesheets')
    .select('*')
    .eq('employee_id', userId)
    .order('period_start', { ascending: false })

  const statusColours: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    submitted: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/manager/team" className="text-sm text-blue-600 hover:underline">
          ← {tm('team')}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-800">
          {member.full_name_he}
          {member.employee_number && (
            <span className="ms-2 text-base font-normal text-gray-400">#{member.employee_number}</span>
          )}
        </h1>
      </div>

      {!timesheets || timesheets.length === 0 ? (
        <p className="text-gray-400">{t('noTimesheets')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('period')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">סטטוס</th>
                <th className="px-4 py-3 text-end font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {timesheets.map(ts => (
                <tr key={ts.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {ts.period_start} – {ts.period_end}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${statusColours[ts.status] ?? ''}`}>
                      {t(`status.${ts.status as 'draft' | 'submitted' | 'approved' | 'rejected'}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    {ts.status === 'submitted' ? (
                      <Link
                        href={`/manager/approvals/${ts.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        סקור
                      </Link>
                    ) : (
                      <Link
                        href={`/timesheet/${ts.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        צפה
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(manager)/manager/team/[userId]/absences/page.tsx`**

```tsx
// app/(manager)/manager/team/[userId]/absences/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function TeamMemberAbsencesPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const t = await getTranslations('absences')
  const tm = await getTranslations('manager')
  const supabase = await createClient()

  const { data: member } = await supabase
    .from('users')
    .select('full_name_he, employee_number')
    .eq('id', userId)
    .single()

  if (!member) notFound()

  const { data: absences } = await supabase
    .from('absences')
    .select('*')
    .eq('employee_id', userId)
    .order('date_start', { ascending: false })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/manager/team" className="text-sm text-blue-600 hover:underline">
          ← {tm('team')}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-800">
          {member.full_name_he}
          {member.employee_number && (
            <span className="ms-2 text-base font-normal text-gray-400">#{member.employee_number}</span>
          )}
          <span className="ms-3 text-base font-normal text-gray-500">— {t('title')}</span>
        </h1>
      </div>

      {!absences || absences.length === 0 ? (
        <p className="text-gray-400">{t('noAbsences')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('type')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('dateStart')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('dateEnd')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 w-20">{t('hours')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('notes')}</th>
              </tr>
            </thead>
            <tbody>
              {absences.map(ab => (
                <tr key={ab.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {t(`types.${ab.type as 'sick' | 'vacation' | 'military' | 'spouse_sick' | 'parent_sick' | 'child_sick' | 'pregnancy_test'}`)}
                  </td>
                  <td className="px-4 py-3">{ab.date_start}</td>
                  <td className="px-4 py-3">{ab.date_end}</td>
                  <td className="px-4 py-3 text-center">{ab.hours}</td>
                  <td className="px-4 py-3 text-gray-500 italic">{ab.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 24 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "app/(manager)/manager/team/"
git commit -m "feat: team list + team member timesheet and absences views"
```

---

## Task 7: Reports pages

**Files:**
- Create: `app/(manager)/manager/reports/page.tsx`
- Create: `app/(manager)/manager/reports/hours-by-project/page.tsx`
- Create: `app/(manager)/manager/reports/absences/page.tsx`

- [ ] **Step 1: Create `app/(manager)/manager/reports/page.tsx`**

```tsx
// app/(manager)/manager/reports/page.tsx
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function ReportsPage() {
  const t = await getTranslations('manager')

  const cards = [
    {
      href: '/manager/reports/hours-by-project',
      title: t('reportHours'),
      description: 'סיכום שעות עבודה לפי פרויקט ועובד לתקופה נבחרת',
      icon: '📊',
    },
    {
      href: '/manager/reports/absences',
      title: t('reportAbsences'),
      description: 'רשימת היעדרויות של כל חברי הצוות',
      icon: '📅',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-800">{t('reports')}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="text-3xl">{card.icon}</div>
            <div className="text-base font-semibold text-gray-800">{card.title}</div>
            <div className="text-sm text-gray-500">{card.description}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(manager)/manager/reports/hours-by-project/page.tsx`**

```tsx
// app/(manager)/manager/reports/hours-by-project/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { parsePeriod, prevPeriod, nextPeriod } from '@/lib/utils/period'
import Link from 'next/link'

export default async function HoursByProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period } = await searchParams
  const { start, end } = parsePeriod(period)
  const t = await getTranslations('manager')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get all timesheets for direct reports in the period
  const { data: timesheets } = await supabase
    .from('timesheets')
    .select('id, employee_id, users!timesheets_employee_id_fkey(full_name_he, employee_number)')
    .gte('period_start', start)
    .lte('period_end', end)

  const timesheetIds = (timesheets ?? []).map(ts => ts.id)

  const { data: entries } = timesheetIds.length > 0
    ? await supabase
        .from('timesheet_entries')
        .select('timesheet_id, hours, projects(name_he, code)')
        .in('timesheet_id', timesheetIds)
    : { data: [] }

  // Build summary: employee → project → hours
  type Row = { employee: string; project: string; hours: number }
  const rows: Row[] = []

  ;(timesheets ?? []).forEach(ts => {
    const emp = ts.users as unknown as { full_name_he: string; employee_number: string | null } | null
    const tsEntries = (entries ?? []).filter(e => e.timesheet_id === ts.id)

    tsEntries.forEach(e => {
      const proj = e.projects as unknown as { name_he: string; code: string } | null
      rows.push({
        employee: emp?.full_name_he ?? '—',
        project: proj ? `${proj.name_he} (${proj.code})` : '—',
        hours: Number(e.hours),
      })
    })
  })

  // Group by project
  const byProject: Record<string, { employees: Record<string, number>; total: number }> = {}
  rows.forEach(r => {
    if (!byProject[r.project]) byProject[r.project] = { employees: {}, total: 0 }
    byProject[r.project].employees[r.employee] = (byProject[r.project].employees[r.employee] ?? 0) + r.hours
    byProject[r.project].total += r.hours
  })

  const grandTotal = rows.reduce((s, r) => s + r.hours, 0)
  const periodLabel = new Date(start + 'T00:00:00').toLocaleDateString('he-IL', { year: 'numeric', month: 'long' })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/manager/reports" className="text-sm text-blue-600 hover:underline">← {t('reports')}</Link>
          <h1 className="text-2xl font-semibold text-gray-800">{t('reportHours')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/manager/reports/hours-by-project?period=${prevPeriod(start)}`} className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">‹</Link>
          <span className="text-sm font-medium text-gray-700 min-w-36 text-center">{periodLabel}</span>
          <Link href={`/manager/reports/hours-by-project?period=${nextPeriod(start)}`} className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">›</Link>
        </div>
      </div>

      {Object.keys(byProject).length === 0 ? (
        <p className="text-gray-400">{t('noData')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(byProject)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([project, data]) => (
              <div key={project} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <span className="font-semibold text-gray-800">{project}</span>
                  <span className="text-sm font-bold text-blue-700">{data.total} שע׳</span>
                </div>
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {Object.entries(data.employees)
                      .sort((a, b) => b[1] - a[1])
                      .map(([emp, hours]) => (
                        <tr key={emp} className="border-t border-gray-100">
                          <td className="px-4 py-2 text-gray-700">{emp}</td>
                          <td className="px-4 py-2 text-end text-gray-600">{hours} שע׳</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}

          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
            {t('totalHours')}: {grandTotal} שעות
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(manager)/manager/reports/absences/page.tsx`**

```tsx
// app/(manager)/manager/reports/absences/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function TeamAbsencesReportPage() {
  const t = await getTranslations('absences')
  const tm = await getTranslations('manager')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get team members
  const { data: teamMembers } = await supabase
    .from('users')
    .select('id')
    .eq('manager_id', user.id)

  const memberIds = (teamMembers ?? []).map(m => m.id)

  const { data: absences } = memberIds.length > 0
    ? await supabase
        .from('absences')
        .select('*, users!absences_employee_id_fkey(full_name_he, employee_number)')
        .in('employee_id', memberIds)
        .order('date_start', { ascending: false })
    : { data: [] }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/manager/reports" className="text-sm text-blue-600 hover:underline">← {tm('reports')}</Link>
        <h1 className="text-2xl font-semibold text-gray-800">{tm('reportAbsences')}</h1>
      </div>

      {!absences || absences.length === 0 ? (
        <p className="text-gray-400">{t('noAbsences')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{tm('employee')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('type')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('dateStart')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('dateEnd')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 w-20">{t('hours')}</th>
              </tr>
            </thead>
            <tbody>
              {absences.map(ab => {
                const emp = ab.users as unknown as { full_name_he: string; employee_number: string | null } | null
                return (
                  <tr key={ab.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{emp?.full_name_he ?? '—'}</div>
                      {emp?.employee_number && <div className="text-xs text-gray-400">#{emp.employee_number}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {t(`types.${ab.type as 'sick' | 'vacation' | 'military' | 'spouse_sick' | 'parent_sick' | 'child_sick' | 'pregnancy_test'}`)}
                    </td>
                    <td className="px-4 py-3">{ab.date_start}</td>
                    <td className="px-4 py-3">{ab.date_end}</td>
                    <td className="px-4 py-3 text-center">{ab.hours}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 24 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "app/(manager)/manager/reports/"
git commit -m "feat: reports hub, hours-by-project, and team absences report"
```

---

## Plan 3 Complete

After all tasks the manager section has:
- **`/manager/approvals`** — Queue of submitted timesheets from direct reports
- **`/manager/approvals/[id]`** — Review with per-entry manager notes + approve/reject buttons
- **`/manager/team`** — Direct report list with links to their timesheets and absences
- **`/manager/team/[userId]/timesheet`** — Team member's full timesheet history
- **`/manager/team/[userId]/absences`** — Team member's absences
- **`/manager/reports`** — Hub with two report types
- **`/manager/reports/hours-by-project`** — Hours per project per employee, period navigation
- **`/manager/reports/absences`** — All team absences in one table

**Note:** Since Idan is the only user and is admin with no direct reports (`manager_id = auth.uid()` matches no one), approvals queue and team will be empty. To test: add a second user via Supabase Auth dashboard, set `manager_id = <idan_uuid>` in the `users` table, have them submit a timesheet.

**Next:** Plan 4 — Admin Interface (projects CRUD, user management, department management)
