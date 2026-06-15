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
                      {t(`status.${ts.status as 'draft' | 'submitted' | 'approved' | 'rejected'}`)}
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
