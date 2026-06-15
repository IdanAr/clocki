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
