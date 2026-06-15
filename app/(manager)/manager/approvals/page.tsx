import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function ApprovalsPage() {
  const t = await getTranslations('manager')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: timesheets } = await supabase
    .from('timesheets')
    .select('*, users!timesheets_employee_id_fkey(full_name_he, full_name_en, employee_number)')
    .eq('status', 'submitted')
    .order('created_at', { ascending: true })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-800">{t('approvals')}</h1>

      {!timesheets || timesheets.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-16">
          <p className="text-gray-400">{t('approvalsEmpty')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('employee')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('periodLabel')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('submittedAt')}</th>
                <th className="px-4 py-3 text-end font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {timesheets.map(ts => {
                const emp = ts.users as unknown as { full_name_he: string; full_name_en: string; employee_number: string | null } | null
                return (
                  <tr key={ts.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{emp?.full_name_he ?? '—'}</div>
                      {emp?.employee_number && (
                        <div className="text-xs text-gray-400">#{emp.employee_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {ts.period_start} – {ts.period_end}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(ts.created_at).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Link
                        href={`/manager/approvals/${ts.id}`}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                      >
                        סקור →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
