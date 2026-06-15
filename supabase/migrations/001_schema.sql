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
