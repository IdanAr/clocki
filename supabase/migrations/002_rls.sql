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

-- Helper: is the given employee a direct report of the current user?
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
