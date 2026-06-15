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
