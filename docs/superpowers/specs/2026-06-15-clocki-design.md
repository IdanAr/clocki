# Clocki — Design Spec
**Date:** 2026-06-15  
**Company:** Attenix  
**Inspired by:** Ovdimnet HR system

---

## 1. Overview

Clocki is a bilingual (Hebrew/English) HR time-tracking web application for Attenix. Employees log daily hours against assigned projects, submit timesheets for manager approval, track absences, and submit vacation requests. Managers approve timesheets and view team reports. Admins manage projects, assign them to employees, manage users and departments.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + magic link OTP) |
| File Storage | Supabase Storage |
| Styling | Tailwind CSS (with RTL support via `dir` attribute) |
| i18n | next-intl (Hebrew `he` + English `en`) |
| Deployment | Vercel |
| ORM | Supabase JS client (no Prisma — keep RLS intact) |

---

## 3. Architecture

```
Next.js 15 (App Router, TypeScript)
  ├── /app
  │     ├── (auth)/               — Login, OTP flow (public)
  │     ├── (employee)/           — Timesheet, absences, vacation, documents
  │     ├── (manager)/            — Approval queue, team view, reports
  │     └── (admin)/              — Projects, users, departments, settings
  ├── /app/api/
  │     └── upload/               — File upload route (Supabase Storage)
  ├── middleware.ts                — Session validation + role-based route guard
  └── /messages/he.json + en.json — i18n strings

Supabase
  ├── Auth          — Session management, OTP emails
  ├── PostgreSQL    — All core data, RLS policies per role
  ├── Storage       — Uploaded files (absence notes, client reports)
  └── Realtime      — Live approval status updates (optional v2)
```

**Data flow:** Server Components fetch data directly via Supabase server client. Client Components use the Supabase browser client for mutations and real-time. Middleware reads the Supabase session cookie and redirects unauthenticated or unauthorized users.

---

## 4. Roles

| Role | Capabilities |
|---|---|
| `employee` | Log hours, submit timesheets, track own absences, submit vacation requests, upload documents |
| `manager` | All employee capabilities + approve/reject team timesheets, view team absence/hours reports |
| `admin` | All manager capabilities + manage projects, assign projects to employees, manage users/departments, company settings |

Role is stored in `users.role` and enforced via Supabase RLS policies on every table. Middleware double-checks role on route entry.

---

## 5. Database Schema

### `departments`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name_he | text | Hebrew name |
| name_en | text | English name |
| manager_id | uuid FK → users | |

### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | Matches Supabase Auth UID |
| email | text | |
| full_name_he | text | Hebrew display name |
| full_name_en | text | English display name |
| employee_number | text | e.g. "207" |
| role | enum | employee \| manager \| admin |
| department_id | uuid FK → departments | |
| manager_id | uuid FK → users | Direct manager |
| created_at | timestamptz | |

### `projects`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name_he | text | Hebrew project name |
| name_en | text | English project name |
| code | text | Short code e.g. "ATX-01" |
| billing_type | enum | billable \| internal |
| is_active | boolean | Default true |
| created_by | uuid FK → users | |
| created_at | timestamptz | |

### `user_projects` (junction)
| Column | Type | Notes |
|---|---|---|
| user_id | uuid FK → users | |
| project_id | uuid FK → projects | |
| assigned_at | timestamptz | |
| assigned_by | uuid FK → users | Admin who assigned |

### `timesheets`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| employee_id | uuid FK → users | |
| period_start | date | First day of pay period |
| period_end | date | Last day of pay period |
| status | enum | draft \| submitted \| approved \| rejected |
| approved_by | uuid FK → users | Nullable |
| approved_at | timestamptz | Nullable |
| created_at | timestamptz | |

### `timesheet_entries`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| timesheet_id | uuid FK → timesheets | |
| project_id | uuid FK → projects | |
| work_date | date | |
| hours | decimal(4,2) | |
| employee_notes | text | Nullable |
| manager_notes | text | Read-only for employee |

### `absences`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| employee_id | uuid FK → users | |
| type | enum | sick \| vacation \| military \| spouse_sick \| parent_sick \| child_sick \| pregnancy_test |
| date_start | date | |
| date_end | date | |
| hours | decimal(4,2) | |
| notes | text | |
| document_url | text | Supabase Storage URL |
| created_at | timestamptz | |

### `vacation_requests`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| employee_id | uuid FK → users | |
| date_start | date | |
| date_end | date | |
| type | enum | periodic \| continuous |
| status | enum | pending \| approved \| rejected |
| employee_notes | text | |
| manager_notes | text | |
| created_at | timestamptz | |

### `documents`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| employee_id | uuid FK → users | |
| type | enum | client_report \| absence_note |
| file_url | text | Supabase Storage URL |
| file_name | text | |
| absence_id | uuid FK → absences | Nullable, links note to absence |
| uploaded_at | timestamptz | |

**RLS rules:** Employees see only their own rows. Managers see rows for users where `users.manager_id = auth.uid()`. Admins bypass RLS via service role (admin routes only, server-side).

---

## 6. Routes & Pages

### Auth (public)
- `/login` — Email input
- `/login/otp` — OTP / magic link verification

### Employee (authenticated, any role)
- `/timesheet/daily` — Daily timesheet grid with side-drawer notes
- `/timesheet/periodic` — Periodic summary view, pay-period selector
- `/timesheet/[id]` — Read-only view of a submitted/approved timesheet
- `/absences` — Absence list with date range filter; upload absence note button
- `/absences/upload-note` — Upload sick/absence document
- `/vacation/requests` — List of vacation requests (periodic)
- `/vacation/new` — Submit new vacation request
- `/vacation/continuous` — Submit continuous vacation request
- `/documents` — All uploaded documents list
- `/documents/upload-client-report` — Upload client report file
- `/profile` — Personal info (read-only, populated from Supabase Auth)

### Manager (role ≥ manager)
- `/manager/approvals` — Queue of submitted timesheets awaiting approval
- `/manager/approvals/[id]` — Review and approve/reject a timesheet
- `/manager/team` — Team member list
- `/manager/team/[userId]/timesheet` — View a team member's timesheet
- `/manager/team/[userId]/absences` — View a team member's absences
- `/manager/reports` — Report hub
- `/manager/reports/absences` — Absence report with filters
- `/manager/reports/hours-by-project` — Hours per project per employee
- `/manager/reports/employee-details` — Employee detail report

### Admin (role = admin)
- `/admin/projects` — Project list (active/inactive, search, filter by billing type)
- `/admin/projects/new` — Create project (name_he, name_en, code, billing_type)
- `/admin/projects/[id]/edit` — Edit project
- `/admin/users` — User list with role badges
- `/admin/users/new` — Create user (links to Supabase Auth invite)
- `/admin/users/[id]/edit` — Edit user (name, role, department, manager)
- `/admin/users/[id]/assign-projects` — Checkbox list of projects to assign/unassign
- `/admin/departments` — Department list
- `/admin/departments/new` — Create department
- `/admin/settings` — Company settings (name, pay period type: monthly/bi-weekly, period start day)

---

## 7. Key UI Behaviours

### Language toggle (HE ↔ EN)
- Stored in cookie, respected by next-intl
- Flips entire layout: `dir="rtl"` for Hebrew, `dir="ltr"` for English
- All project names, user names show the appropriate language variant

### Daily timesheet grid
- Rows = one per project entry per day
- Project dropdown shows only projects assigned to the current employee via `user_projects`
- Absence days auto-populate as read-only rows (sourced from `absences` table)
- Status badge: Draft → Submitted → Approved / Rejected
- Submit button locks the sheet and sends an email notification to the employee's direct manager via Supabase transactional email

### Notes side drawer
- Triggered by 💬 icon on any timesheet row
- Slides in from the right; does not interrupt the table
- Employee textarea (editable) + manager note panel (read-only for employee, editable for manager in approval view)
- Badge on row icon indicates note exists

### File uploads
- Accepted: PNG, JPG, BMP, GIF, JPEG, TIFF, PDF, TIF
- Max size: 5 MB
- Stored in Supabase Storage; URL saved to `documents.file_url` or `absences.document_url`

---

## 8. Admin Interface Detail

### `/admin/projects`
- Table: Hebrew name, English name, code, billing type badge, active/inactive badge, Edit + Deactivate/Activate actions
- Search input + billing type filter dropdown
- "New Project" button → `/admin/projects/new`

### `/admin/projects/new` and `/[id]/edit`
- Fields: `name_he` (required), `name_en` (required), `code` (required, unique), `billing_type` (billable/internal), `is_active` toggle
- Validation: code must be unique across active projects

### `/admin/users/[id]/assign-projects`
- Shows employee name, number, department
- Checkbox list of all active projects
- Currently assigned projects pre-checked with "Assigned" badge
- Save button updates `user_projects` junction table

---

## 9. Error Handling & Validation

- All forms validate client-side with react-hook-form + zod schemas
- Server actions re-validate; never trust client-only validation
- Supabase RLS is the final enforcement layer
- File upload: type and size validated before upload attempt
- Unauthorised route access → redirect to `/login` (unauthenticated) or `/` (wrong role)

---

## 10. Testing Strategy

- **Unit:** zod schemas, utility functions (date formatting, hour calculations)
- **Integration:** Supabase test project for RLS policy tests
- **E2E:** Playwright — login flow, daily timesheet submit → manager approve cycle, admin project creation and user assignment
- No unit tests for pure UI components (overhead not worth it for this scope)

---

## 11. Out of Scope (v1)

- Real-time notifications (Supabase Realtime) — v2
- Mobile app
- Excel/PDF export of reports — v2
- SSO / SAML
- Multi-tenant (multiple companies)
