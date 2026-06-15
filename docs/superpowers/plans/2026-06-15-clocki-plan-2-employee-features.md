# Clocki Employee Features — Implementation Plan (2 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all employee-facing screens: daily timesheet grid with slide-out notes drawer, periodic timesheet view, absences, vacation requests, file uploads (Storage), documents list, and profile page.

**Architecture:** Server Components fetch data via `lib/supabase/server.ts`; mutations go through Server Actions (`lib/actions/*.ts`). The daily timesheet grid and notes drawer are Client Components that call server actions. File uploads go through a Next.js API route that proxies to Supabase Storage. All pages live under `app/(employee)/` which already has the auth guard and AppShell wrapper from Plan 1.

**Tech Stack:** Next.js 15 App Router, Supabase (`@supabase/ssr`), next-intl, react-hook-form, zod, Tailwind CSS v4, Vitest

---

## Codebase Context (read before implementing any task)

```
app/(employee)/layout.tsx          ← auth guard + AppShell (DO NOT MODIFY)
lib/supabase/server.ts             ← async createClient() for Server Components
lib/supabase/client.ts             ← createClient() for Client Components
types/database.ts                  ← Database, UserRole, TimesheetStatus, etc.
messages/he.json + en.json         ← i18n strings (Task 1 adds Plan 2 keys)
components/layout/AppShell.tsx     ← Sidebar + TopBar shell (DO NOT MODIFY)
```

**Key types already in `types/database.ts`:**
- `TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected'`
- `AbsenceType = 'sick' | 'vacation' | 'military' | 'spouse_sick' | 'parent_sick' | 'child_sick' | 'pregnancy_test'`
- `VacationRequestType = 'periodic' | 'continuous'`
- `VacationRequestStatus = 'pending' | 'approved' | 'rejected'`
- `DocumentType = 'client_report' | 'absence_note'`

---

## File Map

```
lib/
  utils/
    period.ts                      ← date/period helpers (getCurrentPeriod, parsePeriod, prev/next)
    __tests__/period.test.ts       ← unit tests for period utils
  actions/
    timesheet.ts                   ← getOrCreateTimesheet, saveEntries, updateEntryNotes, submitTimesheet
    absence.ts                     ← createAbsence
    vacation.ts                    ← createVacationRequest
    upload.ts                      ← uploadFileToStorage (server action)
app/
  (employee)/
    timesheet/
      daily/page.tsx               ← Server Component: fetch period data, render TimesheetGrid
      periodic/page.tsx            ← Server Component: summary table of all timesheets
      [id]/page.tsx                ← Server Component: read-only timesheet detail
    absences/
      page.tsx                     ← Server Component: list + inline create form
    vacation/
      requests/page.tsx            ← Server Component: list of requests
      new/page.tsx                 ← Client Component: new vacation request form
    documents/
      page.tsx                     ← Server Component: list + upload buttons
    profile/
      page.tsx                     ← Server Component: read-only profile
  api/
    upload/route.ts                ← POST: validate + proxy file to Supabase Storage
components/
  timesheet/
    TimesheetGrid.tsx              ← Client Component: editable grid with add/remove rows
    NotesDrawer.tsx                ← Client Component: slide-out notes panel
  forms/
    AbsenceForm.tsx                ← Client Component: create absence form
    VacationForm.tsx               ← Client Component: create vacation request form
    FileUpload.tsx                 ← Client Component: file picker + upload trigger
messages/
  he.json                          ← add Plan 2 keys
  en.json                          ← add Plan 2 keys
```

---

## Task 1: Date/period utilities + i18n additions

**Files:**
- Create: `lib/utils/period.ts`
- Create: `lib/utils/__tests__/period.test.ts`
- Modify: `messages/he.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Create `lib/utils/period.ts`**

```typescript
// lib/utils/period.ts

export function getCurrentPeriod(): { start: string; end: string } {
  const now = new Date()
  return monthBounds(now.getFullYear(), now.getMonth() + 1)
}

export function parsePeriod(param: string | undefined): { start: string; end: string } {
  if (!param || !/^\d{4}-\d{2}$/.test(param)) return getCurrentPeriod()
  const [year, month] = param.split('-').map(Number)
  return monthBounds(year, month)
}

export function prevPeriod(periodStart: string): string {
  const d = new Date(periodStart + 'T00:00:00')
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function nextPeriod(periodStart: string): string {
  const d = new Date(periodStart + 'T00:00:00')
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function periodParam(periodStart: string): string {
  return periodStart.slice(0, 7)
}

export function formatPeriodLabel(periodStart: string, locale: string): string {
  return new Date(periodStart + 'T00:00:00').toLocaleDateString(
    locale === 'he' ? 'he-IL' : 'en-US',
    { year: 'numeric', month: 'long' }
  )
}

function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}
```

- [ ] **Step 2: Create `lib/utils/__tests__/period.test.ts`**

```typescript
// lib/utils/__tests__/period.test.ts
import { describe, it, expect } from 'vitest'
import { parsePeriod, prevPeriod, nextPeriod, periodParam, formatPeriodLabel } from '../period'

describe('parsePeriod', () => {
  it('returns correct start/end for June', () => {
    const { start, end } = parsePeriod('2026-06')
    expect(start).toBe('2026-06-01')
    expect(end).toBe('2026-06-30')
  })

  it('returns 31-day end for January', () => {
    expect(parsePeriod('2026-01').end).toBe('2026-01-31')
  })

  it('returns 28-day end for Feb non-leap', () => {
    expect(parsePeriod('2026-02').end).toBe('2026-02-28')
  })

  it('returns 29-day end for Feb leap year', () => {
    expect(parsePeriod('2024-02').end).toBe('2024-02-29')
  })

  it('falls back to current period for undefined', () => {
    const { start } = parsePeriod(undefined)
    expect(start).toMatch(/^\d{4}-\d{2}-01$/)
  })

  it('falls back for invalid format', () => {
    const { start } = parsePeriod('not-a-period')
    expect(start).toMatch(/^\d{4}-\d{2}-01$/)
  })
})

describe('prevPeriod', () => {
  it('returns previous month param', () => {
    expect(prevPeriod('2026-06-01')).toBe('2026-05')
  })

  it('wraps year correctly', () => {
    expect(prevPeriod('2026-01-01')).toBe('2025-12')
  })
})

describe('nextPeriod', () => {
  it('returns next month param', () => {
    expect(nextPeriod('2026-06-01')).toBe('2026-07')
  })

  it('wraps year correctly', () => {
    expect(nextPeriod('2026-12-01')).toBe('2027-01')
  })
})

describe('periodParam', () => {
  it('extracts YYYY-MM', () => {
    expect(periodParam('2026-06-01')).toBe('2026-06')
  })
})

describe('formatPeriodLabel', () => {
  it('returns non-empty string for he locale', () => {
    expect(formatPeriodLabel('2026-06-01', 'he')).toBeTruthy()
  })

  it('returns non-empty string for en locale', () => {
    expect(formatPeriodLabel('2026-06-01', 'en')).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run tests (expect 11 existing + 10 new = 21 pass)**

```bash
npm test
```

Expected: 21 tests pass across 3 test files.

- [ ] **Step 4: Add Plan 2 i18n keys to `messages/en.json`**

Open `messages/en.json`. In the `"auth"` object add after `"checkEmailDesc"`:

No changes to auth. Find `"timesheet"` object and replace it entirely with:

```json
"timesheet": {
  "daily": "Daily Timesheet",
  "periodic": "Periodic Timesheet",
  "project": "Project",
  "hours": "Hours",
  "notes": "Notes",
  "employeeNotes": "Your note",
  "managerNotes": "Manager note",
  "noManagerNote": "No manager note yet.",
  "addRow": "Add row",
  "submit": "Submit for Approval",
  "submitConfirm": "Submit this timesheet for manager approval? You won't be able to edit it after submission.",
  "save": "Save",
  "saving": "Saving...",
  "detail": "Timesheet Detail",
  "status": {
    "draft": "Draft",
    "submitted": "Pending approval",
    "approved": "Approved",
    "rejected": "Rejected"
  },
  "totalHours": "Total hours",
  "absenceHours": "Absence hours",
  "noEntries": "No entries yet. Click \"Add row\" to start.",
  "noTimesheets": "No timesheets found.",
  "period": "Period"
},
"absences": {
  "title": "Absences",
  "newAbsence": "Log Absence",
  "type": "Type",
  "dateStart": "From",
  "dateEnd": "To",
  "hours": "Hours",
  "notes": "Notes",
  "document": "Document",
  "noAbsences": "No absences recorded.",
  "types": {
    "sick": "Sick leave",
    "vacation": "Vacation",
    "military": "Military reserve",
    "spouse_sick": "Spouse sick",
    "parent_sick": "Parent sick",
    "child_sick": "Child sick",
    "pregnancy_test": "Pregnancy test"
  },
  "save": "Save Absence",
  "cancel": "Cancel",
  "uploadNote": "Upload absence note"
},
"vacation": {
  "title": "Vacation Requests",
  "newRequest": "New Request",
  "dateStart": "From",
  "dateEnd": "To",
  "type": "Type",
  "notes": "Notes",
  "status": {
    "pending": "Pending",
    "approved": "Approved",
    "rejected": "Rejected"
  },
  "types": {
    "periodic": "Periodic",
    "continuous": "Continuous"
  },
  "noRequests": "No vacation requests yet.",
  "submit": "Submit Request",
  "cancel": "Cancel",
  "managerNotes": "Manager notes"
},
"documents": {
  "title": "Documents",
  "uploadClientReport": "Upload Client Report",
  "uploadAbsenceNote": "Upload Absence Note",
  "fileName": "File name",
  "type": "Type",
  "uploadedAt": "Uploaded",
  "noDocuments": "No documents uploaded yet.",
  "types": {
    "client_report": "Client report",
    "absence_note": "Absence note"
  },
  "selectFile": "Select file",
  "uploading": "Uploading...",
  "upload": "Upload",
  "maxSize": "Max 5 MB. Accepted: PDF, JPG, PNG, BMP, GIF, TIFF"
},
"profile": {
  "title": "My Profile",
  "fullNameHe": "Full name (Hebrew)",
  "fullNameEn": "Full name (English)",
  "employeeNumber": "Employee #",
  "email": "Email",
  "role": "Role",
  "department": "Department",
  "manager": "Direct manager",
  "roles": {
    "employee": "Employee",
    "manager": "Manager",
    "admin": "Admin"
  }
}
```

- [ ] **Step 5: Add the same keys to `messages/he.json`**

Find `"timesheet"` object and replace entirely:

```json
"timesheet": {
  "daily": "דוח יומי",
  "periodic": "דוח תקופתי",
  "project": "פרויקט",
  "hours": "שעות",
  "notes": "הערות",
  "employeeNotes": "הערות עובד",
  "managerNotes": "הערות ממונה",
  "noManagerNote": "אין הערת ממונה עדיין.",
  "addRow": "הוסף שורה",
  "submit": "שלח לאישור",
  "submitConfirm": "לשלוח גיליון זה לאישור ממונה? לא ניתן יהיה לערוך לאחר השליחה.",
  "save": "שמור",
  "saving": "שומר...",
  "detail": "פרטי גיליון",
  "status": {
    "draft": "טיוטה",
    "submitted": "ממתין לאישור",
    "approved": "אושר",
    "rejected": "נדחה"
  },
  "totalHours": "סה״כ שעות",
  "absenceHours": "שעות היעדרות",
  "noEntries": "אין רשומות. לחץ על \"הוסף שורה\" כדי להתחיל.",
  "noTimesheets": "לא נמצאו גיליונות.",
  "period": "תקופה"
},
"absences": {
  "title": "היעדרויות",
  "newAbsence": "דיווח היעדרות",
  "type": "סוג",
  "dateStart": "מתאריך",
  "dateEnd": "עד תאריך",
  "hours": "שעות",
  "notes": "הערות",
  "document": "מסמך",
  "noAbsences": "לא נרשמו היעדרויות.",
  "types": {
    "sick": "מחלה",
    "vacation": "חופשה",
    "military": "מילואים",
    "spouse_sick": "מחלת בן/בת זוג",
    "parent_sick": "מחלת הורה",
    "child_sick": "מחלת ילד",
    "pregnancy_test": "בדיקת היריון"
  },
  "save": "שמור היעדרות",
  "cancel": "ביטול",
  "uploadNote": "העלאת אישור היעדרות"
},
"vacation": {
  "title": "בקשות חופשה",
  "newRequest": "בקשה חדשה",
  "dateStart": "מתאריך",
  "dateEnd": "עד תאריך",
  "type": "סוג",
  "notes": "הערות",
  "status": {
    "pending": "ממתין",
    "approved": "אושר",
    "rejected": "נדחה"
  },
  "types": {
    "periodic": "תקופתית",
    "continuous": "רציפה"
  },
  "noRequests": "אין בקשות חופשה עדיין.",
  "submit": "שלח בקשה",
  "cancel": "ביטול",
  "managerNotes": "הערות ממונה"
},
"documents": {
  "title": "מסמכים",
  "uploadClientReport": "העלאת דוח לקוח",
  "uploadAbsenceNote": "העלאת אישור היעדרות",
  "fileName": "שם קובץ",
  "type": "סוג",
  "uploadedAt": "הועלה",
  "noDocuments": "לא הועלו מסמכים עדיין.",
  "types": {
    "client_report": "דוח לקוח",
    "absence_note": "אישור היעדרות"
  },
  "selectFile": "בחר קובץ",
  "uploading": "מעלה...",
  "upload": "העלה",
  "maxSize": "עד 5 מ״ב. סוגים מותרים: PDF, JPG, PNG, BMP, GIF, TIFF"
},
"profile": {
  "title": "הפרופיל שלי",
  "fullNameHe": "שם מלא (עברית)",
  "fullNameEn": "שם מלא (אנגלית)",
  "employeeNumber": "מספר עובד",
  "email": "אימייל",
  "role": "תפקיד",
  "department": "מחלקה",
  "manager": "ממונה ישיר",
  "roles": {
    "employee": "עובד",
    "manager": "מנהל",
    "admin": "מנהל מערכת"
  }
}
```

- [ ] **Step 6: Run tests again (should still pass)**

```bash
npm test
```

Expected: 21 tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/utils/ messages/
git commit -m "feat: add period date utilities + Plan 2 i18n strings"
```

---

## Task 2: Timesheet server actions

**Files:**
- Create: `lib/actions/timesheet.ts`

- [ ] **Step 1: Create `lib/actions/timesheet.ts`**

```typescript
// lib/actions/timesheet.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type EntryInput = {
  work_date: string
  project_id: string
  hours: number
  employee_notes?: string | null
}

export async function getOrCreateTimesheet(periodStart: string, periodEnd: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: existing } = await supabase
    .from('timesheets')
    .select('*')
    .eq('employee_id', user.id)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .maybeSingle()

  if (existing) return existing

  const { data, error } = await supabase
    .from('timesheets')
    .insert({
      employee_id: user.id,
      period_start: periodStart,
      period_end: periodEnd,
      status: 'draft',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function saveEntries(timesheetId: string, entries: EntryInput[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Verify ownership + draft status
  const { data: ts } = await supabase
    .from('timesheets')
    .select('employee_id, status')
    .eq('id', timesheetId)
    .single()

  if (!ts || ts.employee_id !== user.id || ts.status !== 'draft') {
    throw new Error('Cannot edit this timesheet')
  }

  // Delete all and re-insert (clean replace)
  const { error: delError } = await supabase
    .from('timesheet_entries')
    .delete()
    .eq('timesheet_id', timesheetId)

  if (delError) throw new Error(delError.message)

  if (entries.length > 0) {
    const { error: insError } = await supabase
      .from('timesheet_entries')
      .insert(
        entries.map(e => ({
          timesheet_id: timesheetId,
          project_id: e.project_id,
          work_date: e.work_date,
          hours: e.hours,
          employee_notes: e.employee_notes ?? null,
          manager_notes: null,
        }))
      )
    if (insError) throw new Error(insError.message)
  }

  revalidatePath('/timesheet/daily')
}

export async function updateEntryNotes(entryId: string, employeeNotes: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Verify ownership via join
  const { data: entry } = await supabase
    .from('timesheet_entries')
    .select('id, timesheets!inner(employee_id, status)')
    .eq('id', entryId)
    .single()

  if (!entry) throw new Error('Entry not found')

  const { error } = await supabase
    .from('timesheet_entries')
    .update({ employee_notes: employeeNotes })
    .eq('id', entryId)

  if (error) throw new Error(error.message)
  revalidatePath('/timesheet/daily')
}

export async function submitTimesheet(timesheetId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('timesheets')
    .update({ status: 'submitted' })
    .eq('id', timesheetId)
    .eq('employee_id', user.id)
    .eq('status', 'draft')

  if (error) throw new Error(error.message)
  revalidatePath('/timesheet/daily')
  revalidatePath('/timesheet/periodic')
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/timesheet.ts
git commit -m "feat: add timesheet server actions (getOrCreate, saveEntries, updateNotes, submit)"
```

---

## Task 3: Daily timesheet page (Server Component)

**Files:**
- Modify: `app/(employee)/timesheet/daily/page.tsx`

- [ ] **Step 1: Replace `app/(employee)/timesheet/daily/page.tsx`**

```tsx
// app/(employee)/timesheet/daily/page.tsx
import { createClient } from '@/lib/supabase/server'
import { parsePeriod, prevPeriod, nextPeriod } from '@/lib/utils/period'
import { getOrCreateTimesheet } from '@/lib/actions/timesheet'
import { getTranslations, getLocale } from 'next-intl/server'
import TimesheetGrid from '@/components/timesheet/TimesheetGrid'
import Link from 'next/link'

export default async function DailyTimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period } = await searchParams
  const { start, end } = parsePeriod(period)
  const locale = await getLocale()
  const t = await getTranslations('timesheet')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const timesheet = await getOrCreateTimesheet(start, end)

  const [{ data: entries }, { data: absences }, { data: projectRows }] = await Promise.all([
    supabase
      .from('timesheet_entries')
      .select('*')
      .eq('timesheet_id', timesheet.id)
      .order('work_date'),
    supabase
      .from('absences')
      .select('*')
      .eq('employee_id', user.id)
      .gte('date_start', start)
      .lte('date_end', end),
    supabase
      .from('user_projects')
      .select('project_id, projects(id, name_he, name_en, code)')
      .eq('user_id', user.id),
  ])

  const projects = (projectRows ?? [])
    .map(r => r.projects)
    .filter(Boolean) as { id: string; name_he: string; name_en: string; code: string }[]

  const statusColours: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    submitted: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  }

  const periodLabel = new Date(start + 'T00:00:00').toLocaleDateString(
    locale === 'he' ? 'he-IL' : 'en-US',
    { year: 'numeric', month: 'long' }
  )

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-800">{t('daily')}</h1>

        <div className="flex items-center gap-2">
          <Link
            href={`/timesheet/daily?period=${prevPeriod(start)}`}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            ‹
          </Link>
          <span className="min-w-36 text-center text-sm font-medium text-gray-700">
            {periodLabel}
          </span>
          <Link
            href={`/timesheet/daily?period=${nextPeriod(start)}`}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            ›
          </Link>
          <span
            className={`rounded px-2 py-1 text-xs font-semibold ${statusColours[timesheet.status] ?? ''}`}
          >
            {t(`status.${timesheet.status}`)}
          </span>
        </div>
      </div>

      <TimesheetGrid
        timesheet={timesheet}
        entries={entries ?? []}
        absences={absences ?? []}
        projects={projects}
        periodStart={start}
        periodEnd={end}
        locale={locale}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(employee)/timesheet/daily/page.tsx"
git commit -m "feat: daily timesheet server component with period navigation"
```

---

## Task 4: TimesheetGrid client component

**Files:**
- Create: `components/timesheet/TimesheetGrid.tsx`

- [ ] **Step 1: Create `components/timesheet/TimesheetGrid.tsx`**

```tsx
// components/timesheet/TimesheetGrid.tsx
'use client'
import { useState, useTransition } from 'react'
import { saveEntries, submitTimesheet } from '@/lib/actions/timesheet'
import NotesDrawer from './NotesDrawer'
import { useTranslations } from 'next-intl'

export type Project = { id: string; name_he: string; name_en: string; code: string }
export type TimesheetEntry = {
  id: string
  timesheet_id: string
  project_id: string
  work_date: string
  hours: number
  employee_notes: string | null
  manager_notes: string | null
}
export type Absence = {
  id: string
  type: string
  date_start: string
  date_end: string
  hours: number
}
export type Timesheet = {
  id: string
  status: string
  employee_id: string
  period_start: string
  period_end: string
}

type RowData = {
  key: string
  entryId?: string
  work_date: string
  project_id: string
  hours: number
  employee_notes: string
  manager_notes: string
}

let _keyCounter = 0
const newKey = () => `new-${++_keyCounter}`

function entriesToRows(entries: TimesheetEntry[]): RowData[] {
  return entries.map(e => ({
    key: e.id,
    entryId: e.id,
    work_date: e.work_date,
    project_id: e.project_id,
    hours: e.hours,
    employee_notes: e.employee_notes ?? '',
    manager_notes: e.manager_notes ?? '',
  }))
}

export default function TimesheetGrid({
  timesheet,
  entries,
  absences,
  projects,
  periodStart,
  periodEnd,
  locale,
}: {
  timesheet: Timesheet
  entries: TimesheetEntry[]
  absences: Absence[]
  projects: Project[]
  periodStart: string
  periodEnd: string
  locale: string
}) {
  const t = useTranslations('timesheet')
  const [rows, setRows] = useState<RowData[]>(() => entriesToRows(entries))
  const [drawerRow, setDrawerRow] = useState<RowData | null>(null)
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState('')

  const isEditable = timesheet.status === 'draft'

  const addRow = () => {
    setRows(prev => [
      ...prev,
      {
        key: newKey(),
        work_date: periodStart,
        project_id: projects[0]?.id ?? '',
        hours: 8,
        employee_notes: '',
        manager_notes: '',
      },
    ])
  }

  const removeRow = (key: string) => setRows(prev => prev.filter(r => r.key !== key))

  const updateRow = (key: string, field: keyof RowData, value: string | number) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, [field]: value } : r)))
  }

  const updateRowNotes = (key: string, notes: string) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, employee_notes: notes } : r)))
  }

  const handleSave = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      startTransition(async () => {
        try {
          setSaveError('')
          await saveEntries(
            timesheet.id,
            rows.map(r => ({
              work_date: r.work_date,
              project_id: r.project_id,
              hours: Number(r.hours),
              employee_notes: r.employee_notes || null,
            }))
          )
          resolve()
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Save failed'
          setSaveError(msg)
          reject(e)
        }
      })
    })
  }

  const handleSubmit = () => {
    if (!confirm(t('submitConfirm'))) return
    startTransition(async () => {
      try {
        setSaveError('')
        await saveEntries(
          timesheet.id,
          rows.map(r => ({
            work_date: r.work_date,
            project_id: r.project_id,
            hours: Number(r.hours),
            employee_notes: r.employee_notes || null,
          }))
        )
        await submitTimesheet(timesheet.id)
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Submit failed')
      }
    })
  }

  const totalHours = rows.reduce((sum, r) => sum + Number(r.hours), 0)
  const absenceHours = absences.reduce((sum, a) => sum + Number(a.hours), 0)

  const absenceTypeLabel: Record<string, string> = {
    sick: 'מחלה', vacation: 'חופשה', military: 'מילואים',
    spouse_sick: 'מחלת בן/בת זוג', parent_sick: 'מחלת הורה',
    child_sick: 'מחלת ילד', pregnancy_test: 'בדיקת היריון',
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-start font-medium text-gray-500 w-36">תאריך</th>
              <th className="px-3 py-2 text-start font-medium text-gray-500">פרויקט</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500 w-20">שעות</th>
              <th className="px-3 py-2 w-10"></th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  {t('noEntries')}
                </td>
              </tr>
            )}

            {rows.map(row => (
              <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50/50">
                <td className="px-3 py-2">
                  {isEditable ? (
                    <input
                      type="date"
                      value={row.work_date}
                      min={periodStart}
                      max={periodEnd}
                      onChange={e => updateRow(row.key, 'work_date', e.target.value)}
                      className="rounded border border-gray-200 px-2 py-1 text-sm w-34"
                    />
                  ) : (
                    <span className="font-medium">{row.work_date}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {isEditable ? (
                    <select
                      value={row.project_id}
                      onChange={e => updateRow(row.key, 'project_id', e.target.value)}
                      className="rounded border border-gray-200 px-2 py-1 text-sm max-w-52"
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {locale === 'he' ? p.name_he : p.name_en} ({p.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>
                      {projects.find(p => p.id === row.project_id)?.[locale === 'he' ? 'name_he' : 'name_en'] ?? row.project_id}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {isEditable ? (
                    <input
                      type="number"
                      min="0.5"
                      max="24"
                      step="0.5"
                      value={row.hours}
                      onChange={e => updateRow(row.key, 'hours', e.target.value)}
                      className="w-16 rounded border border-gray-200 px-2 py-1 text-center text-sm"
                    />
                  ) : (
                    <span>{row.hours}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => setDrawerRow(row)}
                    className="text-base leading-none"
                    title={t('notes')}
                    aria-label={t('notes')}
                  >
                    {row.employee_notes || row.manager_notes ? '💬' : '🗨️'}
                  </button>
                </td>
                <td className="px-3 py-2 text-center">
                  {isEditable && (
                    <button
                      onClick={() => removeRow(row.key)}
                      className="text-red-400 hover:text-red-600 text-sm"
                      aria-label="Remove row"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {/* Absence rows (read-only) */}
            {absences.map(ab => (
              <tr key={`absence-${ab.id}`} className="border-t border-gray-100 bg-red-50">
                <td className="px-3 py-2 text-red-700 font-medium">{ab.date_start}</td>
                <td className="px-3 py-2 text-red-600 italic" colSpan={2}>
                  {absenceTypeLabel[ab.type] ?? ab.type} — {ab.hours} שע׳
                </td>
                <td colSpan={2} />
              </tr>
            ))}

            {/* Add row button */}
            {isEditable && (
              <tr className="border-t border-gray-100">
                <td colSpan={5} className="px-3 py-2">
                  <button
                    onClick={addRow}
                    disabled={projects.length === 0}
                    className="rounded border border-dashed border-blue-300 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                  >
                    + {t('addRow')}
                  </button>
                  {projects.length === 0 && (
                    <span className="ms-2 text-xs text-gray-400">
                      אין פרויקטים מוקצים — פנה לאדמין
                    </span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-4 py-3">
        {saveError && (
          <p className="mb-2 text-sm text-red-600">{saveError}</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-6 text-sm text-gray-500">
            <span>
              {t('totalHours')}: <strong className="text-gray-800">{totalHours}</strong>
            </span>
            {absenceHours > 0 && (
              <span>
                {t('absenceHours')}: <strong className="text-red-600">{absenceHours}</strong>
              </span>
            )}
          </div>

          {isEditable && (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isPending}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {isPending ? t('saving') : t('save')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending || rows.length === 0}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {t('submit')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notes Drawer */}
      {drawerRow && (
        <NotesDrawer
          row={drawerRow}
          isEditable={isEditable}
          onClose={() => setDrawerRow(null)}
          onSave={(notes) => {
            updateRowNotes(drawerRow.key, notes)
            setDrawerRow(null)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/timesheet/TimesheetGrid.tsx
git commit -m "feat: add TimesheetGrid client component with add/remove rows and inline editing"
```

---

## Task 5: NotesDrawer component

**Files:**
- Create: `components/timesheet/NotesDrawer.tsx`

- [ ] **Step 1: Create `components/timesheet/NotesDrawer.tsx`**

```tsx
// components/timesheet/NotesDrawer.tsx
'use client'
import { useState, useTransition, useEffect } from 'react'
import { updateEntryNotes } from '@/lib/actions/timesheet'
import { useTranslations } from 'next-intl'

type RowData = {
  key: string
  entryId?: string
  work_date: string
  employee_notes: string
  manager_notes: string
}

export default function NotesDrawer({
  row,
  isEditable,
  onClose,
  onSave,
}: {
  row: RowData
  isEditable: boolean
  onClose: () => void
  onSave: (notes: string) => void
}) {
  const t = useTranslations('timesheet')
  const [notes, setNotes] = useState(row.employee_notes)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Sync notes when row changes
  useEffect(() => {
    setNotes(row.employee_notes)
    setError('')
  }, [row.key, row.employee_notes])

  const handleSave = () => {
    if (!row.entryId) {
      // Not yet persisted — just update parent state
      onSave(notes)
      return
    }
    startTransition(async () => {
      try {
        await updateEntryNotes(row.entryId!, notes)
        onSave(notes)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel — slides in from the end (right in LTR, left in RTL) */}
      <aside
        className="fixed inset-y-0 end-0 z-50 flex w-80 flex-col border-s border-gray-200 bg-white shadow-2xl"
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal
        aria-label={t('notes')}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">📅 {row.work_date}</p>
            <p className="text-xs text-gray-500">{t('notes')}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-5 overflow-auto p-4">
          {/* Employee notes */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t('employeeNotes')}
            </label>
            {isEditable ? (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={6}
                placeholder="הוסף הערה..."
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <div className="min-h-20 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {notes || <span className="italic text-gray-400">אין הערה</span>}
              </div>
            )}
          </div>

          {/* Manager notes — always read-only for employee */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t('managerNotes')}
            </label>
            <div className="min-h-16 rounded-lg bg-gray-50 px-3 py-2 text-sm italic text-gray-500">
              {row.manager_notes || <span className="text-gray-400">{t('noManagerNote')}</span>}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        {isEditable && (
          <div className="border-t border-gray-200 p-4">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? t('saving') : t('save')}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/timesheet/NotesDrawer.tsx
git commit -m "feat: add NotesDrawer slide-out panel (employee editable, manager notes read-only)"
```

---

## Task 6: Periodic timesheet page + timesheet detail page

**Files:**
- Create: `app/(employee)/timesheet/periodic/page.tsx`
- Create: `app/(employee)/timesheet/[id]/page.tsx`

- [ ] **Step 1: Create `app/(employee)/timesheet/periodic/page.tsx`**

```tsx
// app/(employee)/timesheet/periodic/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function PeriodicTimesheetPage() {
  const t = await getTranslations('timesheet')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: timesheets } = await supabase
    .from('timesheets')
    .select('*')
    .eq('employee_id', user.id)
    .order('period_start', { ascending: false })

  const statusColours: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    submitted: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">{t('periodic')}</h1>
        <Link
          href="/timesheet/daily"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          {t('daily')} →
        </Link>
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
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {ts.period_start} – {ts.period_end}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${statusColours[ts.status] ?? ''}`}>
                      {t(`status.${ts.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    {ts.status === 'draft' ? (
                      <Link
                        href={`/timesheet/daily?period=${ts.period_start.slice(0, 7)}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        ערוך
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

- [ ] **Step 2: Create `app/(employee)/timesheet/[id]/page.tsx`**

```tsx
// app/(employee)/timesheet/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getTranslations, getLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function TimesheetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations('timesheet')
  const locale = await getLocale()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: ts } = await supabase
    .from('timesheets')
    .select('*')
    .eq('id', id)
    .eq('employee_id', user.id)
    .single()

  if (!ts) notFound()

  const { data: entries } = await supabase
    .from('timesheet_entries')
    .select('*, projects(name_he, name_en, code)')
    .eq('timesheet_id', id)
    .order('work_date')

  const statusColours: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    submitted: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  }

  const totalHours = (entries ?? []).reduce((s, e) => s + Number(e.hours), 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/timesheet/periodic" className="text-sm text-blue-600 hover:underline">
          ← {t('periodic')}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-800">
          {t('detail')} · {ts.period_start} – {ts.period_end}
        </h1>
        <span className={`rounded px-2 py-1 text-xs font-semibold ${statusColours[ts.status] ?? ''}`}>
          {t(`status.${ts.status}`)}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-start font-medium text-gray-500">תאריך</th>
              <th className="px-4 py-3 text-start font-medium text-gray-500">פרויקט</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 w-20">שעות</th>
              <th className="px-4 py-3 text-start font-medium text-gray-500">{t('employeeNotes')}</th>
              <th className="px-4 py-3 text-start font-medium text-gray-500">{t('managerNotes')}</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map(e => {
              const proj = e.projects as { name_he: string; name_en: string; code: string } | null
              return (
                <tr key={e.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium">{e.work_date}</td>
                  <td className="px-4 py-3">{proj ? (locale === 'he' ? proj.name_he : proj.name_en) : '—'}</td>
                  <td className="px-4 py-3 text-center">{e.hours}</td>
                  <td className="px-4 py-3 text-gray-600 italic">{e.employee_notes ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 italic">{e.manager_notes ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td colSpan={2} className="px-4 py-3 font-semibold">{t('totalHours')}</td>
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

- [ ] **Step 3: Commit**

```bash
git add "app/(employee)/timesheet/periodic/page.tsx" "app/(employee)/timesheet/[id]/page.tsx"
git commit -m "feat: add periodic timesheet list and read-only timesheet detail pages"
```

---

## Task 7: Absence server action + list page + create form

**Files:**
- Create: `lib/actions/absence.ts`
- Create: `components/forms/AbsenceForm.tsx`
- Create: `app/(employee)/absences/page.tsx`

- [ ] **Step 1: Create `lib/actions/absence.ts`**

```typescript
// lib/actions/absence.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const AbsenceSchema = z.object({
  type: z.enum(['sick', 'vacation', 'military', 'spouse_sick', 'parent_sick', 'child_sick', 'pregnancy_test']),
  date_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().min(0.5).max(744),
  notes: z.string().optional(),
})

export type AbsenceInput = z.infer<typeof AbsenceSchema>
export type AbsenceResult = { success: true } | { success: false; error: string }

export async function createAbsence(input: AbsenceInput): Promise<AbsenceResult> {
  const parsed = AbsenceSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.from('absences').insert({
    employee_id: user.id,
    type: parsed.data.type,
    date_start: parsed.data.date_start,
    date_end: parsed.data.date_end,
    hours: parsed.data.hours,
    notes: parsed.data.notes ?? null,
    document_url: null,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/absences')
  return { success: true }
}
```

- [ ] **Step 2: Create `components/forms/AbsenceForm.tsx`**

```tsx
// components/forms/AbsenceForm.tsx
'use client'
import { useState, useTransition } from 'react'
import { createAbsence } from '@/lib/actions/absence'
import { useTranslations } from 'next-intl'
import type { AbsenceType } from '@/types/database'

const ABSENCE_TYPES: AbsenceType[] = [
  'sick', 'vacation', 'military', 'spouse_sick', 'parent_sick', 'child_sick', 'pregnancy_test'
]

export default function AbsenceForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations('absences')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    type: 'sick' as AbsenceType,
    date_start: '',
    date_end: '',
    hours: 8,
    notes: '',
  })

  const set = (field: string, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await createAbsence({
        ...form,
        hours: Number(form.hours),
      })
      if (result.success) {
        onDone()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">{t('type')}</label>
          <select
            value={form.type}
            onChange={e => set('type', e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            required
          >
            {ABSENCE_TYPES.map(type => (
              <option key={type} value={type}>{t(`types.${type}`)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">{t('dateStart')}</label>
          <input
            type="date"
            value={form.date_start}
            onChange={e => set('date_start', e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">{t('dateEnd')}</label>
          <input
            type="date"
            value={form.date_end}
            onChange={e => set('date_end', e.target.value)}
            min={form.date_start}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">{t('hours')}</label>
          <input
            type="number"
            min="0.5"
            max="744"
            step="0.5"
            value={form.hours}
            onChange={e => set('hours', e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            required
          />
        </div>

        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-600">{t('notes')}</label>
          <input
            type="text"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="הערות (אופציונלי)"
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? '...' : t('save')}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Create `app/(employee)/absences/page.tsx`**

```tsx
// app/(employee)/absences/page.tsx
'use client'
import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import AbsenceForm from '@/components/forms/AbsenceForm'

type Absence = {
  id: string
  type: string
  date_start: string
  date_end: string
  hours: number
  notes: string | null
  document_url: string | null
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  sick: 'מחלה', vacation: 'חופשה', military: 'מילואים',
  spouse_sick: 'מחלת בן/בת זוג', parent_sick: 'מחלת הורה',
  child_sick: 'מחלת ילד', pregnancy_test: 'בדיקת היריון',
}

export default function AbsencesPage() {
  const t = useTranslations('absences')
  const [absences, setAbsences] = useState<Absence[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchAbsences = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('absences')
      .select('*')
      .order('date_start', { ascending: false })
    setAbsences(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchAbsences() }, [])

  const handleFormDone = () => {
    setShowForm(false)
    fetchAbsences()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">{t('title')}</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            + {t('newAbsence')}
          </button>
        )}
      </div>

      {showForm && <AbsenceForm onDone={handleFormDone} />}

      {loading ? (
        <p className="text-gray-400 text-sm">טוען...</p>
      ) : absences.length === 0 ? (
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
                  <td className="px-4 py-3 font-medium">{TYPE_LABELS[ab.type] ?? ab.type}</td>
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

Expected: 21 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/absence.ts components/forms/AbsenceForm.tsx "app/(employee)/absences/page.tsx"
git commit -m "feat: absences list page with inline create form and server action"
```

---

## Task 8: Vacation requests pages + server action

**Files:**
- Create: `lib/actions/vacation.ts`
- Create: `components/forms/VacationForm.tsx`
- Create: `app/(employee)/vacation/requests/page.tsx`
- Create: `app/(employee)/vacation/new/page.tsx`

- [ ] **Step 1: Create `lib/actions/vacation.ts`**

```typescript
// lib/actions/vacation.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const VacationSchema = z.object({
  date_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['periodic', 'continuous']),
  employee_notes: z.string().optional(),
})

export type VacationInput = z.infer<typeof VacationSchema>
export type VacationResult = { success: true } | { success: false; error: string }

export async function createVacationRequest(input: VacationInput): Promise<VacationResult> {
  const parsed = VacationSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.from('vacation_requests').insert({
    employee_id: user.id,
    date_start: parsed.data.date_start,
    date_end: parsed.data.date_end,
    type: parsed.data.type,
    status: 'pending',
    employee_notes: parsed.data.employee_notes ?? null,
    manager_notes: null,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/vacation/requests')
  return { success: true }
}
```

- [ ] **Step 2: Create `components/forms/VacationForm.tsx`**

```tsx
// components/forms/VacationForm.tsx
'use client'
import { useState, useTransition } from 'react'
import { createVacationRequest } from '@/lib/actions/vacation'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function VacationForm({ defaultType = 'periodic' }: { defaultType?: 'periodic' | 'continuous' }) {
  const t = useTranslations('vacation')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    date_start: '',
    date_end: '',
    type: defaultType,
    employee_notes: '',
  })

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await createVacationRequest(form)
      if (result.success) {
        router.push('/vacation/requests')
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-lg">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t('type')}</label>
        <select
          value={form.type}
          onChange={e => set('type', e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="periodic">{t('types.periodic')}</option>
          <option value="continuous">{t('types.continuous')}</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('dateStart')}</label>
          <input
            type="date"
            value={form.date_start}
            onChange={e => set('date_start', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('dateEnd')}</label>
          <input
            type="date"
            value={form.date_end}
            onChange={e => set('date_end', e.target.value)}
            min={form.date_start}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t('notes')}</label>
        <textarea
          value={form.employee_notes}
          onChange={e => set('employee_notes', e.target.value)}
          rows={3}
          placeholder="הערות (אופציונלי)"
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-6 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? '...' : t('submit')}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Create `app/(employee)/vacation/requests/page.tsx`**

```tsx
// app/(employee)/vacation/requests/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function VacationRequestsPage() {
  const t = await getTranslations('vacation')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: requests } = await supabase
    .from('vacation_requests')
    .select('*')
    .eq('employee_id', user.id)
    .order('created_at', { ascending: false })

  const statusColours: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  }

  const typeLabels: Record<string, string> = {
    periodic: t('types.periodic'),
    continuous: t('types.continuous'),
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">{t('title')}</h1>
        <Link
          href="/vacation/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + {t('newRequest')}
        </Link>
      </div>

      {!requests || requests.length === 0 ? (
        <p className="text-gray-400">{t('noRequests')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('type')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('dateStart')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('dateEnd')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">סטטוס</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('managerNotes')}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">{typeLabels[r.type] ?? r.type}</td>
                  <td className="px-4 py-3">{r.date_start}</td>
                  <td className="px-4 py-3">{r.date_end}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${statusColours[r.status] ?? ''}`}>
                      {t(`status.${r.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 italic">{r.manager_notes ?? '—'}</td>
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

- [ ] **Step 4: Create `app/(employee)/vacation/new/page.tsx`**

```tsx
// app/(employee)/vacation/new/page.tsx
import { getTranslations } from 'next-intl/server'
import VacationForm from '@/components/forms/VacationForm'

export default async function NewVacationPage() {
  const t = await getTranslations('vacation')
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-800">{t('newRequest')}</h1>
      <VacationForm defaultType="periodic" />
    </div>
  )
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: 21 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/vacation.ts components/forms/VacationForm.tsx "app/(employee)/vacation/"
git commit -m "feat: vacation requests list and new request form with server action"
```

---

## Task 9: Supabase Storage setup + upload API route + FileUpload component

**MANUAL STEP before coding:**

In Supabase dashboard:
1. Go to **Storage** → **New bucket**
2. Name: `documents`
3. Set to **Public** (files are accessed via URL)
4. Save

Then add the Storage policy in **SQL Editor**:

```sql
-- Allow authenticated users to upload to their own folder
create policy "users upload own files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to read their own files
create policy "users read own files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

**Files:**
- Create: `app/api/upload/route.ts`
- Create: `components/forms/FileUpload.tsx`
- Create: `lib/actions/upload.ts`

- [ ] **Step 1: Create `app/api/upload/route.ts`**

```typescript
// app/api/upload/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = new Set([
  'image/png', 'image/jpg', 'image/jpeg', 'image/bmp',
  'image/gif', 'image/tiff', 'image/tif', 'application/pdf',
])
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 5 MB limit' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from('documents')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)

  return NextResponse.json({ url: publicUrl, name: file.name })
}
```

- [ ] **Step 2: Create `components/forms/FileUpload.tsx`**

```tsx
// components/forms/FileUpload.tsx
'use client'
import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

type UploadResult = { url: string; name: string }

export default function FileUpload({
  onUpload,
  label,
}: {
  onUpload: (result: UploadResult) => void
  label?: string
}) {
  const t = useTranslations('documents')
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (file: File) => {
    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Upload failed')
      } else {
        onUpload(json)
      }
    } catch {
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.bmp,.gif,.tiff,.tif"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="rounded-md border border-dashed border-blue-300 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50"
      >
        {uploading ? t('uploading') : (label ?? t('selectFile'))}
      </button>
      <p className="text-xs text-gray-400">{t('maxSize')}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Create `lib/actions/upload.ts`** (saves document record to DB after upload)

```typescript
// lib/actions/upload.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DocumentType } from '@/types/database'

export type SaveDocumentResult = { success: true } | { success: false; error: string }

export async function saveDocument(
  fileUrl: string,
  fileName: string,
  type: DocumentType,
  absenceId?: string
): Promise<SaveDocumentResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.from('documents').insert({
    employee_id: user.id,
    type,
    file_url: fileUrl,
    file_name: fileName,
    absence_id: absenceId ?? null,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/documents')
  return { success: true }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 21 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/upload/route.ts components/forms/FileUpload.tsx lib/actions/upload.ts
git commit -m "feat: file upload API route, FileUpload component, saveDocument server action"
```

---

## Task 10: Documents page

**Files:**
- Create: `app/(employee)/documents/page.tsx`

- [ ] **Step 1: Create `app/(employee)/documents/page.tsx`**

```tsx
// app/(employee)/documents/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveDocument } from '@/lib/actions/upload'
import FileUpload from '@/components/forms/FileUpload'
import { useTranslations } from 'next-intl'

type Document = {
  id: string
  type: string
  file_url: string
  file_name: string
  uploaded_at: string
}

export default function DocumentsPage() {
  const t = useTranslations('documents')
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadError, setUploadError] = useState('')

  const fetchDocs = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('documents')
      .select('*')
      .order('uploaded_at', { ascending: false })
    setDocuments(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchDocs() }, [])

  const handleUpload = (type: 'client_report' | 'absence_note') =>
    async ({ url, name }: { url: string; name: string }) => {
      setUploadError('')
      const result = await saveDocument(url, name, type)
      if (!result.success) {
        setUploadError(result.error)
      } else {
        fetchDocs()
      }
    }

  const typeLabel: Record<string, string> = {
    client_report: t('types.client_report'),
    absence_note: t('types.absence_note'),
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-800">{t('title')}</h1>

      <div className="flex flex-wrap gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">{t('uploadClientReport')}</p>
          <FileUpload
            label={t('uploadClientReport')}
            onUpload={handleUpload('client_report')}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">{t('uploadAbsenceNote')}</p>
          <FileUpload
            label={t('uploadAbsenceNote')}
            onUpload={handleUpload('absence_note')}
          />
        </div>
      </div>

      {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">טוען...</p>
      ) : documents.length === 0 ? (
        <p className="text-gray-400">{t('noDocuments')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('fileName')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('type')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('uploadedAt')}</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <tr key={doc.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{doc.file_name}</td>
                  <td className="px-4 py-3">{typeLabel[doc.type] ?? doc.type}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(doc.uploaded_at).toLocaleDateString('he-IL')}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      צפה
                    </a>
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

- [ ] **Step 2: Commit**

```bash
git add "app/(employee)/documents/page.tsx"
git commit -m "feat: documents page with client report and absence note upload"
```

---

## Task 11: Profile page

**Files:**
- Create: `app/(employee)/profile/page.tsx`

- [ ] **Step 1: Create `app/(employee)/profile/page.tsx`**

```tsx
// app/(employee)/profile/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'

export default async function ProfilePage() {
  const t = await getTranslations('profile')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*, departments(name_he, name_en)')
    .eq('id', user.id)
    .single()

  const { data: manager } = profile?.manager_id
    ? await supabase
        .from('users')
        .select('full_name_he, full_name_en, email')
        .eq('id', profile.manager_id)
        .single()
    : { data: null }

  const dept = profile?.departments as { name_he: string; name_en: string } | null

  const rows = [
    { label: t('fullNameHe'), value: profile?.full_name_he || '—' },
    { label: t('fullNameEn'), value: profile?.full_name_en || '—' },
    { label: t('employeeNumber'), value: profile?.employee_number || '—' },
    { label: t('email'), value: user.email ?? '—' },
    { label: t('role'), value: profile?.role ? t(`roles.${profile.role}`) : '—' },
    { label: t('department'), value: dept?.name_he || dept?.name_en || '—' },
    { label: t('manager'), value: manager?.full_name_he || manager?.full_name_en || manager?.email || '—' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-800">{t('title')}</h1>

      <div className="max-w-lg overflow-hidden rounded-lg border border-gray-200 bg-white">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex border-b border-gray-100 last:border-0">
            <div className="w-44 flex-shrink-0 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
              {label}
            </div>
            <div className="flex-1 px-4 py-3 text-sm text-gray-800">{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: 21 tests pass.

- [ ] **Step 3: Commit**

```bash
git add "app/(employee)/profile/page.tsx"
git commit -m "feat: profile page (read-only employee details)"
```

---

## Task 12: Wire up sidebar links + root redirect

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Update `app/page.tsx` to redirect to daily timesheet**

Read the current `app/page.tsx`, then replace with:

```tsx
// app/page.tsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/timesheet/daily')
}
```

- [ ] **Step 2: Update `components/layout/Sidebar.tsx` — add Profile link**

Read the current `components/layout/Sidebar.tsx`.

In the Sidebar function body, after the documents NavSection, add a profile link:

```tsx
<NavSection label={t('profile')}>
  <NavItem href="/profile">{t('profile')}</NavItem>
</NavSection>
```

Also add `"profile": "פרופיל"` to `messages/he.json` `nav` section and `"profile": "Profile"` to `messages/en.json` `nav` section (they already exist from Plan 1 — verify they are there, add only if missing).

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: 21 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/layout/Sidebar.tsx
git commit -m "feat: root redirect + profile link in sidebar"
```

---

## Plan 2 Complete

After all tasks the app has:
- **Daily timesheet** — editable grid, period navigation, add/remove rows, save + submit, absence rows auto-shown
- **Notes drawer** — 💬 per row, slides from end, employee editable, manager note read-only
- **Periodic view** — lists all timesheets with status, links to detail or edit
- **Timesheet detail** — read-only view of submitted/approved timesheets
- **Absences** — list all, inline create form
- **Vacation requests** — list all, new request page
- **Documents** — list with upload for client reports and absence notes
- **Profile** — read-only personal info
- **File uploads** — via `/api/upload` → Supabase Storage

**Next:** Plan 3 — Manager Features (approval queue, team view, approving timesheets with manager notes)
