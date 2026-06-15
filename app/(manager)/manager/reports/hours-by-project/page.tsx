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
          <span className="min-w-36 text-center text-sm font-medium text-gray-700">{periodLabel}</span>
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
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
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
