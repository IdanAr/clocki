# Clocki Foundation & Auth — Implementation Plan (1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a working Next.js 15 + Supabase app with login, OTP auth, role-based routing middleware, bilingual (HE/EN) shared layout, and the full database schema — ready for feature plans 2–4 to build on top.

**Architecture:** Next.js 15 App Router (TypeScript) with Supabase Auth (magic-link OTP). Middleware enforces session + role on every route. `next-intl` drives RTL/LTR layout switching via a cookie. All data access goes through `@supabase/ssr` server/browser clients; RLS policies are the security layer.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Supabase (`@supabase/ssr`), next-intl, react-hook-form, zod, Vitest (unit), Playwright (E2E)

---

## File Map

```
clocki/                                ← project root (init here)
├── app/
│   ├── layout.tsx                     ← root HTML shell (sets <html lang dir>)
│   ├── (auth)/
│   │   ├── login/page.tsx             ← email entry → sends OTP
│   │   └── login/otp/page.tsx         ← OTP entry → verifies + redirects
│   └── (employee)/
│       ├── layout.tsx                 ← AppShell (sidebar + topbar) guard
│       └── timesheet/
│           └── daily/page.tsx         ← placeholder (confirms redirect works)
├── components/
│   └── layout/
│       ├── AppShell.tsx               ← flex shell: sidebar + main
│       ├── Sidebar.tsx                ← nav links, role-filtered
│       ├── TopBar.tsx                 ← user menu, language toggle
│       └── LanguageToggle.tsx         ← HE/EN cookie setter
├── lib/
│   └── supabase/
│       ├── client.ts                  ← browser Supabase client
│       ├── server.ts                  ← server component Supabase client
│       └── middleware-client.ts       ← middleware Supabase client
├── types/
│   └── database.ts                    ← manual TypeScript DB types
├── i18n/
│   └── request.ts                     ← next-intl locale resolution
├── messages/
│   ├── he.json                        ← Hebrew strings
│   └── en.json                        ← English strings
├── supabase/
│   └── migrations/
│       ├── 001_schema.sql             ← all tables
│       └── 002_rls.sql                ← all RLS policies + helper functions
├── middleware.ts                      ← auth session + role guard
├── next.config.ts                     ← next-intl plugin
├── tailwind.config.ts                 ← RTL-aware config
├── vitest.config.ts                   ← unit test config
└── .env.local                         ← Supabase credentials (gitignored)
```

---

## Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `vitest.config.ts`

- [ ] **Step 1: Run create-next-app inside the Clocki directory**

```bash
cd "C:/Users/idan/Desktop/Idan/Personal/Claude/Code/Clocki"
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-eslint
```

When prompted "Would you like to use Turbopack?" answer **Yes**.

- [ ] **Step 2: Install Supabase SSR, next-intl, form libs, and Vitest**

```bash
npm install @supabase/ssr @supabase/supabase-js next-intl react-hook-form zod @hookform/resolvers
npm install -D vitest @vitejs/plugin-react @vitest/ui jsdom @testing-library/react @testing-library/jest-dom playwright @playwright/test
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 4: Create vitest.setup.ts**

```typescript
// vitest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to package.json**

Open `package.json` and add inside `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

- [ ] **Step 6: Verify the project starts**

```bash
npm run dev
```

Expected: Server starts on `http://localhost:3000` with no errors.

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js 15 project with Supabase + next-intl + Vitest"
```

---

## Task 2: Create Supabase project and configure environment

**Files:**
- Create: `.env.local`, `.env.example`

- [ ] **Step 1: Create a Supabase project**

1. Go to https://supabase.com → New Project → name it `clocki`
2. Choose a strong database password and save it
3. Wait for the project to be ready (~2 min)
4. Go to Settings → API → copy `Project URL` and `anon public` key

- [ ] **Step 2: Create .env.local**

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Replace with your actual values from Step 1.

- [ ] **Step 3: Create .env.example (safe to commit)**

```bash
# .env.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 4: Add .env.local to .gitignore**

Open `.gitignore` and confirm `.env.local` is listed (create-next-app adds it automatically). Also add:

```
.env.local
.env.*.local
.superpowers/
```

- [ ] **Step 5: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add Supabase env config and gitignore"
```

---

## Task 3: Database schema migration

**Files:**
- Create: `supabase/migrations/001_schema.sql`

- [ ] **Step 1: Create the migrations directory**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 2: Create supabase/migrations/001_schema.sql**

```sql
-- supabase/migrations/001_schema.sql

create extension if not exists "uuid-ossp";

-- Departments (no FK to users yet — created before users table)
create table departments (
  id uuid primary key default uuid_generate_v4(),
  name_he text not null,
  name_en text not null,
  manager_id uuid  -- FK added after users table exists (see below)
);

-- Users (extends auth.users via same id)
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name_he text not null default '',
  full_name_en text not null default '',
  employee_number text,
  role text not null check (role in ('employee', 'manager', 'admin')) default 'employee',
  department_id uuid references departments(id),
  manager_id uuid references users(id),
  created_at timestamptz not null default now()
);

-- Add FK from departments to users now that users exists
alter table departments
  add constraint departments_manager_id_fkey
  foreign key (manager_id) references users(id);

-- Projects
create table projects (
  id uuid primary key default uuid_generate_v4(),
  name_he text not null,
  name_en text not null,
  code text not null unique,
  billing_type text not null check (billing_type in ('billable', 'internal')),
  is_active boolean not null default true,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

-- User ↔ Project assignment (junction)
create table user_projects (
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references users(id),
  primary key (user_id, project_id)
);

-- Timesheets (one per employee per pay period)
create table timesheets (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null
    check (status in ('draft', 'submitted', 'approved', 'rejected'))
    default 'draft',
  approved_by uuid references users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (employee_id, period_start, period_end)
);

-- Individual time entries within a timesheet
create table timesheet_entries (
  id uuid primary key default uuid_generate_v4(),
  timesheet_id uuid not null references timesheets(id) on delete cascade,
  project_id uuid not null references projects(id),
  work_date date not null,
  hours decimal(4,2) not null check (hours > 0 and hours <= 24),
  employee_notes text,
  manager_notes text
);

-- Absence records
create table absences (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references users(id) on delete cascade,
  type text not null check (type in (
    'sick', 'vacation', 'military',
    'spouse_sick', 'parent_sick', 'child_sick', 'pregnancy_test'
  )),
  date_start date not null,
  date_end date not null,
  hours decimal(4,2) not null check (hours > 0),
  notes text,
  document_url text,
  created_at timestamptz not null default now()
);

-- Vacation requests
create table vacation_requests (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references users(id) on delete cascade,
  date_start date not null,
  date_end date not null,
  type text not null check (type in ('periodic', 'continuous')),
  status text not null
    check (status in ('pending', 'approved', 'rejected'))
    default 'pending',
  employee_notes text,
  manager_notes text,
  created_at timestamptz not null default now()
);

-- Uploaded documents
create table documents (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('client_report', 'absence_note')),
  file_url text not null,
  file_name text not null,
  absence_id uuid references absences(id),
  uploaded_at timestamptz not null default now()
);

-- Trigger: auto-create users row when Supabase Auth creates a user
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name_he, full_name_en, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name_he', ''),
    coalesce(new.raw_user_meta_data->>'full_name_en', ''),
    coalesce(new.raw_user_meta_data->>'role', 'employee')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

- [ ] **Step 3: Run the migration in Supabase**

In the Supabase dashboard: SQL Editor → paste the entire file → Run.

Expected: No errors. All tables appear in Table Editor.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema migration (001_schema.sql)"
```

---

## Task 4: RLS policies migration

**Files:**
- Create: `supabase/migrations/002_rls.sql`

- [ ] **Step 1: Create supabase/migrations/002_rls.sql**

```sql
-- supabase/migrations/002_rls.sql

-- Enable RLS on every table
alter table users enable row level security;
alter table departments enable row level security;
alter table projects enable row level security;
alter table user_projects enable row level security;
alter table timesheets enable row level security;
alter table timesheet_entries enable row level security;
alter table absences enable row level security;
alter table vacation_requests enable row level security;
alter table documents enable row level security;

-- Helper: current user's role (security definer so RLS can call it safely)
create or replace function get_my_role()
returns text language sql security definer stable as $$
  select role from public.users where id = auth.uid()
$$;

-- Helper: current user's manager_id
create or replace function is_my_direct_report(employee_uuid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.users
    where id = employee_uuid and manager_id = auth.uid()
  )
$$;

-- ── USERS ──────────────────────────────────────────────────────────────────
create policy "users: read own or team or all (admin)"
  on users for select using (
    id = auth.uid()
    or get_my_role() = 'admin'
    or (get_my_role() = 'manager' and manager_id = auth.uid())
  );

create policy "users: insert via trigger only"
  on users for insert with check (id = auth.uid());

create policy "users: update own profile"
  on users for update using (id = auth.uid() or get_my_role() = 'admin');

create policy "users: delete admin only"
  on users for delete using (get_my_role() = 'admin');

-- ── DEPARTMENTS ────────────────────────────────────────────────────────────
create policy "departments: all can read"
  on departments for select using (true);

create policy "departments: admin write"
  on departments for all using (get_my_role() = 'admin');

-- ── PROJECTS ───────────────────────────────────────────────────────────────
create policy "projects: employee sees assigned active projects"
  on projects for select using (
    get_my_role() in ('admin', 'manager')
    or (
      is_active = true
      and exists (
        select 1 from user_projects
        where user_id = auth.uid() and project_id = projects.id
      )
    )
  );

create policy "projects: admin write"
  on projects for all using (get_my_role() = 'admin');

-- ── USER_PROJECTS ──────────────────────────────────────────────────────────
create policy "user_projects: read own or admin/manager"
  on user_projects for select using (
    user_id = auth.uid()
    or get_my_role() in ('admin', 'manager')
  );

create policy "user_projects: admin write"
  on user_projects for all using (get_my_role() = 'admin');

-- ── TIMESHEETS ─────────────────────────────────────────────────────────────
create policy "timesheets: read own or team (manager) or all (admin)"
  on timesheets for select using (
    employee_id = auth.uid()
    or get_my_role() = 'admin'
    or (get_my_role() = 'manager' and is_my_direct_report(employee_id))
  );

create policy "timesheets: employee insert own"
  on timesheets for insert with check (employee_id = auth.uid());

create policy "timesheets: employee or manager update"
  on timesheets for update using (
    employee_id = auth.uid()
    or get_my_role() in ('admin', 'manager')
  );

-- ── TIMESHEET_ENTRIES ──────────────────────────────────────────────────────
create policy "entries: read via timesheet access"
  on timesheet_entries for select using (
    exists (
      select 1 from timesheets t
      where t.id = timesheet_entries.timesheet_id
        and (
          t.employee_id = auth.uid()
          or get_my_role() = 'admin'
          or (get_my_role() = 'manager' and is_my_direct_report(t.employee_id))
        )
    )
  );

create policy "entries: employee insert own timesheet"
  on timesheet_entries for insert with check (
    exists (
      select 1 from timesheets t
      where t.id = timesheet_entries.timesheet_id
        and t.employee_id = auth.uid()
        and t.status = 'draft'
    )
  );

create policy "entries: employee or manager update"
  on timesheet_entries for update using (
    exists (
      select 1 from timesheets t
      where t.id = timesheet_entries.timesheet_id
        and (
          t.employee_id = auth.uid()
          or get_my_role() in ('admin', 'manager')
        )
    )
  );

create policy "entries: employee delete from draft"
  on timesheet_entries for delete using (
    exists (
      select 1 from timesheets t
      where t.id = timesheet_entries.timesheet_id
        and t.employee_id = auth.uid()
        and t.status = 'draft'
    )
  );

-- ── ABSENCES ───────────────────────────────────────────────────────────────
create policy "absences: read own or team or admin"
  on absences for select using (
    employee_id = auth.uid()
    or get_my_role() = 'admin'
    or (get_my_role() = 'manager' and is_my_direct_report(employee_id))
  );

create policy "absences: employee insert own"
  on absences for insert with check (employee_id = auth.uid());

create policy "absences: employee or admin update"
  on absences for update using (
    employee_id = auth.uid() or get_my_role() = 'admin'
  );

-- ── VACATION_REQUESTS ──────────────────────────────────────────────────────
create policy "vacation: read own or team or admin"
  on vacation_requests for select using (
    employee_id = auth.uid()
    or get_my_role() = 'admin'
    or (get_my_role() = 'manager' and is_my_direct_report(employee_id))
  );

create policy "vacation: employee insert own"
  on vacation_requests for insert with check (employee_id = auth.uid());

create policy "vacation: employee or manager update"
  on vacation_requests for update using (
    employee_id = auth.uid()
    or get_my_role() in ('admin', 'manager')
  );

-- ── DOCUMENTS ──────────────────────────────────────────────────────────────
create policy "documents: read own or admin"
  on documents for select using (
    employee_id = auth.uid()
    or get_my_role() in ('admin', 'manager')
  );

create policy "documents: employee insert own"
  on documents for insert with check (employee_id = auth.uid());
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Paste entire `002_rls.sql` → Run.

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_rls.sql
git commit -m "feat: add RLS policies and helper functions"
```

---

## Task 5: TypeScript database types

**Files:**
- Create: `types/database.ts`

- [ ] **Step 1: Create types/database.ts**

```typescript
// types/database.ts

export type UserRole = 'employee' | 'manager' | 'admin'
export type BillingType = 'billable' | 'internal'
export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type AbsenceType =
  | 'sick' | 'vacation' | 'military'
  | 'spouse_sick' | 'parent_sick' | 'child_sick' | 'pregnancy_test'
export type VacationRequestType = 'periodic' | 'continuous'
export type VacationRequestStatus = 'pending' | 'approved' | 'rejected'
export type DocumentType = 'client_report' | 'absence_note'

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: { id: string; name_he: string; name_en: string; manager_id: string | null }
        Insert: Omit<Database['public']['Tables']['departments']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['departments']['Row']>
      }
      users: {
        Row: {
          id: string; email: string
          full_name_he: string; full_name_en: string
          employee_number: string | null
          role: UserRole
          department_id: string | null; manager_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['users']['Row']>
      }
      projects: {
        Row: {
          id: string; name_he: string; name_en: string
          code: string; billing_type: BillingType
          is_active: boolean; created_by: string | null; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['projects']['Row']>
      }
      user_projects: {
        Row: { user_id: string; project_id: string; assigned_at: string; assigned_by: string | null }
        Insert: Omit<Database['public']['Tables']['user_projects']['Row'], 'assigned_at'>
        Update: Partial<Database['public']['Tables']['user_projects']['Row']>
      }
      timesheets: {
        Row: {
          id: string; employee_id: string
          period_start: string; period_end: string
          status: TimesheetStatus
          approved_by: string | null; approved_at: string | null; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['timesheets']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['timesheets']['Row']>
      }
      timesheet_entries: {
        Row: {
          id: string; timesheet_id: string; project_id: string
          work_date: string; hours: number
          employee_notes: string | null; manager_notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['timesheet_entries']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['timesheet_entries']['Row']>
      }
      absences: {
        Row: {
          id: string; employee_id: string; type: AbsenceType
          date_start: string; date_end: string; hours: number
          notes: string | null; document_url: string | null; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['absences']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['absences']['Row']>
      }
      vacation_requests: {
        Row: {
          id: string; employee_id: string
          date_start: string; date_end: string
          type: VacationRequestType; status: VacationRequestStatus
          employee_notes: string | null; manager_notes: string | null; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['vacation_requests']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['vacation_requests']['Row']>
      }
      documents: {
        Row: {
          id: string; employee_id: string; type: DocumentType
          file_url: string; file_name: string
          absence_id: string | null; uploaded_at: string
        }
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'uploaded_at'>
        Update: Partial<Database['public']['Tables']['documents']['Row']>
      }
    }
    Functions: {
      get_my_role: { Args: Record<string, never>; Returns: UserRole }
      is_my_direct_report: { Args: { employee_uuid: string }; Returns: boolean }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add types/
git commit -m "feat: add TypeScript database types"
```

---

## Task 6: Supabase client helpers

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware-client.ts`

- [ ] **Step 1: Create lib/supabase/client.ts** (browser client)

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create lib/supabase/server.ts** (server component client)

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — can't set cookies; middleware handles refresh
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create lib/supabase/middleware-client.ts**

```typescript
// lib/supabase/middleware-client.ts
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/database'
import type { UserRole } from '@/types/database'

export async function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  return { supabase, response }
}

export function getRedirectForRole(role: UserRole, pathname: string): string | null {
  if (pathname.startsWith('/admin') && role !== 'admin') return '/timesheet/daily'
  if (pathname.startsWith('/manager') && role === 'employee') return '/timesheet/daily'
  return null
}
```

- [ ] **Step 4: Write unit tests for getRedirectForRole**

```typescript
// lib/supabase/__tests__/middleware-client.test.ts
import { describe, it, expect } from 'vitest'
import { getRedirectForRole } from '../middleware-client'

describe('getRedirectForRole', () => {
  it('redirects employee away from /admin', () => {
    expect(getRedirectForRole('employee', '/admin/projects')).toBe('/timesheet/daily')
  })

  it('redirects employee away from /manager', () => {
    expect(getRedirectForRole('employee', '/manager/approvals')).toBe('/timesheet/daily')
  })

  it('allows manager on /manager routes', () => {
    expect(getRedirectForRole('manager', '/manager/approvals')).toBeNull()
  })

  it('redirects manager away from /admin', () => {
    expect(getRedirectForRole('manager', '/admin/users')).toBe('/timesheet/daily')
  })

  it('allows admin on /admin routes', () => {
    expect(getRedirectForRole('admin', '/admin/projects')).toBeNull()
  })

  it('allows admin on /manager routes', () => {
    expect(getRedirectForRole('admin', '/manager/approvals')).toBeNull()
  })

  it('returns null for non-guarded routes', () => {
    expect(getRedirectForRole('employee', '/timesheet/daily')).toBeNull()
  })
})
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: All 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/ 
git commit -m "feat: add Supabase client helpers + role redirect logic with tests"
```

---

## Task 7: Middleware (auth + role guard)

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create middleware.ts**

```typescript
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient, getRedirectForRole } from '@/lib/supabase/middleware-client'
import type { UserRole } from '@/types/database'

export async function middleware(request: NextRequest) {
  const { supabase, response } = await createMiddlewareClient(request)
  const { pathname } = request.nextUrl

  const { data: { user } } = await supabase.auth.getUser()

  // Not authenticated → send to login (except if already on login)
  if (!user && !pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Already authenticated → skip login pages
  if (user && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/timesheet/daily', request.url))
  }

  // Role-based guard (only for authenticated users on guarded paths)
  if (user && (pathname.startsWith('/admin') || pathname.startsWith('/manager'))) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = (profile?.role ?? 'employee') as UserRole
    const redirectPath = getRedirectForRole(role, pathname)

    if (redirectPath) {
      return NextResponse.redirect(new URL(redirectPath, request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add auth + role-based middleware"
```

---

## Task 8: Configure next-intl

**Files:**
- Create: `i18n/request.ts`, `messages/he.json`, `messages/en.json`
- Modify: `next.config.ts`

- [ ] **Step 1: Create i18n/request.ts**

```typescript
// i18n/request.ts
import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const locale = cookieStore.get('locale')?.value ?? 'he'
  const validLocale = ['he', 'en'].includes(locale) ? locale : 'he'

  return {
    locale: validLocale,
    messages: (await import(`../messages/${validLocale}.json`)).default,
  }
})
```

- [ ] **Step 2: Create messages/he.json**

```json
{
  "nav": {
    "timesheets": "גיליונות",
    "daily": "יומי",
    "periodic": "תקופתי",
    "absences": "היעדרויות",
    "vacation": "חופשות",
    "vacationRequests": "בקשות חופשה",
    "newVacation": "בקשת חופשה חדשה",
    "continuousVacation": "חופשה רציפה",
    "documents": "מסמכים",
    "uploadClientReport": "העלאת דוח לקוח",
    "profile": "פרטים אישיים",
    "logout": "יציאה",
    "approvals": "אישורים",
    "team": "הצוות שלי",
    "reports": "דוחות",
    "adminProjects": "ניהול פרויקטים",
    "adminUsers": "ניהול משתמשים",
    "adminDepartments": "מחלקות",
    "adminSettings": "הגדרות"
  },
  "auth": {
    "title": "כניסה למערכת",
    "emailLabel": "כתובת אימייל",
    "emailPlaceholder": "your@email.com",
    "sendOtp": "שלח קוד",
    "otpTitle": "הזן קוד אימות",
    "otpDescription": "שלחנו קוד חד-פעמי לאימייל שלך",
    "otpLabel": "קוד חד-פעמי",
    "verify": "אמת",
    "backToLogin": "חזור להתחברות",
    "loggingIn": "מתחבר...",
    "sending": "שולח..."
  },
  "common": {
    "save": "שמור",
    "cancel": "ביטול",
    "edit": "ערוך",
    "delete": "מחק",
    "add": "הוסף",
    "search": "חיפוש",
    "loading": "טוען...",
    "welcome": "ברוכים הבאים"
  },
  "timesheet": {
    "daily": "דוח יומי",
    "periodic": "דוח תקופתי",
    "project": "פרויקט",
    "hours": "שעות",
    "notes": "הערות",
    "employeeNotes": "הערות עובד",
    "managerNotes": "הערות ממונה",
    "addRow": "הוסף שורה",
    "submit": "שלח לאישור",
    "save": "שמור",
    "status": {
      "draft": "טיוטה",
      "submitted": "ממתין לאישור",
      "approved": "אושר",
      "rejected": "נדחה"
    }
  }
}
```

- [ ] **Step 3: Create messages/en.json**

```json
{
  "nav": {
    "timesheets": "Timesheets",
    "daily": "Daily",
    "periodic": "Periodic",
    "absences": "Absences",
    "vacation": "Vacation",
    "vacationRequests": "Vacation Requests",
    "newVacation": "New Vacation Request",
    "continuousVacation": "Continuous Vacation",
    "documents": "Documents",
    "uploadClientReport": "Upload Client Report",
    "profile": "Profile",
    "logout": "Logout",
    "approvals": "Approvals",
    "team": "My Team",
    "reports": "Reports",
    "adminProjects": "Projects",
    "adminUsers": "Users",
    "adminDepartments": "Departments",
    "adminSettings": "Settings"
  },
  "auth": {
    "title": "Sign in",
    "emailLabel": "Email address",
    "emailPlaceholder": "your@email.com",
    "sendOtp": "Send Code",
    "otpTitle": "Enter verification code",
    "otpDescription": "We sent a one-time code to your email",
    "otpLabel": "One-time code",
    "verify": "Verify",
    "backToLogin": "Back to login",
    "loggingIn": "Signing in...",
    "sending": "Sending..."
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "edit": "Edit",
    "delete": "Delete",
    "add": "Add",
    "search": "Search",
    "loading": "Loading...",
    "welcome": "Welcome"
  },
  "timesheet": {
    "daily": "Daily Timesheet",
    "periodic": "Periodic Timesheet",
    "project": "Project",
    "hours": "Hours",
    "notes": "Notes",
    "employeeNotes": "Your note",
    "managerNotes": "Manager note",
    "addRow": "Add row",
    "submit": "Submit for approval",
    "save": "Save",
    "status": {
      "draft": "Draft",
      "submitted": "Pending approval",
      "approved": "Approved",
      "rejected": "Rejected"
    }
  }
}
```

- [ ] **Step 4: Update next.config.ts**

```typescript
// next.config.ts
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {}

export default withNextIntl(nextConfig)
```

- [ ] **Step 5: Write unit test for locale resolution**

```typescript
// i18n/__tests__/locale.test.ts
import { describe, it, expect } from 'vitest'

function resolveLocale(cookieValue: string | undefined): string {
  const locale = cookieValue ?? 'he'
  return ['he', 'en'].includes(locale) ? locale : 'he'
}

describe('locale resolution', () => {
  it('defaults to Hebrew when no cookie', () => {
    expect(resolveLocale(undefined)).toBe('he')
  })

  it('respects Hebrew cookie', () => {
    expect(resolveLocale('he')).toBe('he')
  })

  it('respects English cookie', () => {
    expect(resolveLocale('en')).toBe('en')
  })

  it('falls back to Hebrew for unknown locale', () => {
    expect(resolveLocale('fr')).toBe('he')
  })
})
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: All tests pass (including previous 7 + new 4 = 11 total).

- [ ] **Step 7: Commit**

```bash
git add i18n/ messages/ next.config.ts
git commit -m "feat: configure next-intl with Hebrew and English message files"
```

---

## Task 9: Root app layout

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/api/locale/route.ts`

- [ ] **Step 1: Update app/layout.tsx**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'

export const metadata: Metadata = {
  title: 'Clocki',
  description: 'HR Time Tracking — Attenix',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} dir={locale === 'he' ? 'rtl' : 'ltr'}>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create API route to switch locale**

```typescript
// app/api/locale/route.ts
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { locale } = await request.json()

  if (!['he', 'en'].includes(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 })
  }

  const response = NextResponse.json({ locale })
  response.cookies.set('locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
  return response
}
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx app/api/
git commit -m "feat: root layout with next-intl provider and locale switch API"
```

---

## Task 10: Shared layout components

**Files:**
- Create: `components/layout/LanguageToggle.tsx`, `components/layout/TopBar.tsx`, `components/layout/Sidebar.tsx`, `components/layout/AppShell.tsx`

- [ ] **Step 1: Create components/layout/LanguageToggle.tsx**

```tsx
// components/layout/LanguageToggle.tsx
'use client'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

export default function LanguageToggle() {
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const toggle = async () => {
    const next = locale === 'he' ? 'en' : 'he'
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    })
    startTransition(() => router.refresh())
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
      aria-label="Toggle language"
    >
      🌐 {locale === 'he' ? 'EN' : 'עב'}
    </button>
  )
}
```

- [ ] **Step 2: Create components/layout/TopBar.tsx**

```tsx
// components/layout/TopBar.tsx
import { createClient } from '@/lib/supabase/server'
import LanguageToggle from './LanguageToggle'
import LogoutButton from './LogoutButton'

export default async function TopBar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let displayName = user?.email ?? ''
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('full_name_he, full_name_en')
      .eq('id', user.id)
      .single()
    if (profile) displayName = profile.full_name_he || profile.full_name_en || displayName
  }

  return (
    <header className="flex h-12 items-center justify-between border-b border-gray-200 bg-white px-4">
      <div />
      <div className="flex items-center gap-3">
        <LanguageToggle />
        <span className="text-sm text-gray-600">{displayName}</span>
        <LogoutButton />
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Create components/layout/LogoutButton.tsx**

```tsx
// components/layout/LogoutButton.tsx
'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function LogoutButton() {
  const t = useTranslations('nav')
  const router = useRouter()

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={logout}
      className="text-sm text-gray-500 hover:text-gray-800"
    >
      {t('logout')}
    </button>
  )
}
```

- [ ] **Step 4: Create components/layout/Sidebar.tsx**

```tsx
// components/layout/Sidebar.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import type { UserRole } from '@/types/database'

async function getRole(): Promise<UserRole> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'employee'
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  return (data?.role ?? 'employee') as UserRole
}

export default async function Sidebar() {
  const role = await getRole()
  const t = await getTranslations('nav')

  return (
    <nav className="flex w-52 flex-shrink-0 flex-col border-e border-gray-200 bg-white">
      <div className="px-4 py-4">
        <span className="text-lg font-bold text-blue-600">⏱ Clocki</span>
        <div className="text-xs text-gray-400">Attenix</div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 text-sm">
        <NavSection label={t('timesheets')}>
          <NavItem href="/timesheet/daily">{t('daily')}</NavItem>
          <NavItem href="/timesheet/periodic">{t('periodic')}</NavItem>
        </NavSection>

        <NavSection label={t('vacation')}>
          <NavItem href="/absences">{t('absences')}</NavItem>
          <NavItem href="/vacation/requests">{t('vacationRequests')}</NavItem>
        </NavSection>

        <NavSection label={t('documents')}>
          <NavItem href="/documents">{t('documents')}</NavItem>
        </NavSection>

        {(role === 'manager' || role === 'admin') && (
          <NavSection label={t('approvals')}>
            <NavItem href="/manager/approvals">{t('approvals')}</NavItem>
            <NavItem href="/manager/team">{t('team')}</NavItem>
            <NavItem href="/manager/reports">{t('reports')}</NavItem>
          </NavSection>
        )}

        {role === 'admin' && (
          <NavSection label="Admin">
            <NavItem href="/admin/projects">{t('adminProjects')}</NavItem>
            <NavItem href="/admin/users">{t('adminUsers')}</NavItem>
            <NavItem href="/admin/departments">{t('adminDepartments')}</NavItem>
            <NavItem href="/admin/settings">{t('adminSettings')}</NavItem>
          </NavSection>
        )}
      </div>
    </nav>
  )
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </div>
      {children}
    </div>
  )
}

function NavItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
    >
      {children}
    </Link>
  )
}
```

- [ ] **Step 5: Create components/layout/AppShell.tsx**

```tsx
// components/layout/AppShell.tsx
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/
git commit -m "feat: add shared layout components (AppShell, Sidebar, TopBar, LanguageToggle)"
```

---

## Task 11: Auth pages

**Files:**
- Create: `app/(auth)/login/page.tsx`, `app/(auth)/login/otp/page.tsx`

- [ ] **Step 1: Create app/(auth)/login/page.tsx**

```tsx
// app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'

export default function LoginPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    // Store email in sessionStorage so OTP page can use it
    sessionStorage.setItem('clocki_otp_email', email)
    router.push('/login/otp')
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#16213d]"
      dir={locale === 'he' ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="text-3xl font-bold text-blue-600">⏱ Clocki</div>
          <div className="mt-1 text-sm text-gray-500">Attenix</div>
        </div>

        <h1 className="mb-6 text-center text-xl font-semibold text-gray-800">
          {t('title')}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('emailLabel')}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('sending') : t('sendOtp')}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create app/(auth)/login/otp/page.tsx**

```tsx
// app/(auth)/login/otp/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'

export default function OtpPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const [otp, setOtp] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const stored = sessionStorage.getItem('clocki_otp_email')
    if (!stored) { router.push('/login'); return }
    setEmail(stored)
  }, [router])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    sessionStorage.removeItem('clocki_otp_email')
    router.push('/timesheet/daily')
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#16213d]"
      dir={locale === 'he' ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="text-3xl font-bold text-blue-600">⏱ Clocki</div>
        </div>

        <h1 className="mb-2 text-center text-xl font-semibold text-gray-800">
          {t('otpTitle')}
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">{t('otpDescription')}</p>
        {email && (
          <p className="mb-4 text-center text-sm font-medium text-blue-600">{email}</p>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('otpLabel')}
            </label>
            <input
              type="text"
              required
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-2xl font-bold tracking-[0.5em] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="000000"
              maxLength={6}
              inputMode="numeric"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || otp.length < 6}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('loggingIn') : t('verify')}
          </button>
        </form>

        <button
          onClick={() => router.push('/login')}
          className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700"
        >
          {t('backToLogin')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(auth\)/
git commit -m "feat: add login and OTP verification pages"
```

---

## Task 12: Employee layout + daily timesheet placeholder

**Files:**
- Create: `app/(employee)/layout.tsx`, `app/(employee)/timesheet/daily/page.tsx`

- [ ] **Step 1: Create app/(employee)/layout.tsx**

```tsx
// app/(employee)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <AppShell>{children}</AppShell>
}
```

- [ ] **Step 2: Create app/(employee)/timesheet/daily/page.tsx** (placeholder)

```tsx
// app/(employee)/timesheet/daily/page.tsx
import { getTranslations } from 'next-intl/server'

export default async function DailyTimesheetPage() {
  const t = await getTranslations('timesheet')
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-800">{t('daily')}</h1>
      <p className="mt-2 text-gray-500">Coming in Plan 2.</p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(employee\)/
git commit -m "feat: add employee layout guard and daily timesheet placeholder"
```

---

## Task 13: Seed data

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: In Supabase, create the admin user via Authentication → Users → Invite**

Invite: `idan.rbel@gmail.com`

After the user is created, copy their UUID from the users table.

- [ ] **Step 2: Create supabase/seed.sql**

```sql
-- supabase/seed.sql
-- Run after creating users via Supabase Auth dashboard
-- Replace <IDAN_UUID> with the actual UUID of idan.rbel@gmail.com

-- Promote Idan to admin
update public.users
set
  full_name_he = 'ארבל, עידן',
  full_name_en = 'Arbel, Idan',
  employee_number = '207',
  role = 'admin'
where email = 'idan.rbel@gmail.com';

-- Create a department
insert into departments (name_he, name_en)
values ('מחלקת פיתוח', 'R&D');

-- Set department for Idan
update public.users
set department_id = (select id from departments where name_en = 'R&D')
where email = 'idan.rbel@gmail.com';

-- Create sample projects
insert into projects (name_he, name_en, code, billing_type, created_by)
values
  ('פרויקט אטניקס', 'Attenix Core', 'ATX-01', 'billable',
    (select id from public.users where email = 'idan.rbel@gmail.com')),
  ('תשתיות', 'Infrastructure', 'INF-02', 'internal',
    (select id from public.users where email = 'idan.rbel@gmail.com')),
  ('מחקר ופיתוח', 'R&D Research', 'RND-03', 'internal',
    (select id from public.users where email = 'idan.rbel@gmail.com'));

-- Assign all projects to Idan
insert into user_projects (user_id, project_id, assigned_by)
select
  (select id from public.users where email = 'idan.rbel@gmail.com'),
  p.id,
  (select id from public.users where email = 'idan.rbel@gmail.com')
from projects p;
```

- [ ] **Step 3: Run seed.sql in Supabase SQL Editor**

Paste and run. Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "chore: add development seed data"
```

---

## Task 14: End-to-end verification

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test the redirect chain**

Open `http://localhost:3000`.

Expected: Redirects to `http://localhost:3000/login` (not authenticated).

- [ ] **Step 3: Test OTP login**

1. Enter `idan.rbel@gmail.com` on the login page → click Send Code
2. Check your email for the Supabase OTP
3. Enter the 6-digit code on `/login/otp`
4. Expected: Redirects to `/timesheet/daily` showing the placeholder with sidebar and top bar

- [ ] **Step 4: Test language toggle**

Click the 🌐 toggle in the top bar.

Expected: Page reloads with Hebrew sidebar labels and `dir="rtl"` (or English if already in Hebrew).

- [ ] **Step 5: Test role guard (admin)**

In the browser address bar, navigate to `http://localhost:3000/admin/projects`.

Expected: Loads (Idan is admin). If you test with an employee account, expected: redirect to `/timesheet/daily`.

- [ ] **Step 6: Commit any final cleanup**

```bash
git status
git add -A
git commit -m "chore: Plan 1 complete — foundation, auth, layout, i18n, RLS"
```

---

## Plan 1 Complete

The app now has:
- Working Next.js 15 project deployed locally
- Full Supabase schema with RLS
- OTP authentication flow
- Bilingual RTL/LTR layout
- Role-based middleware guard
- Sidebar with role-filtered navigation
- Seed data (Idan as admin, 3 projects)

**Next:** Plan 2 — Employee Features (daily timesheet + notes drawer, periodic view, absences, vacation requests, file uploads)
