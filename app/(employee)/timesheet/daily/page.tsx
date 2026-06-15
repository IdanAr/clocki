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
    .map(r => r.projects as unknown as { id: string; name_he: string; name_en: string; code: string } | null)
    .filter((p): p is { id: string; name_he: string; name_en: string; code: string } => p !== null)

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
            {t(`status.${timesheet.status as 'draft' | 'submitted' | 'approved' | 'rejected'}`)}
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
