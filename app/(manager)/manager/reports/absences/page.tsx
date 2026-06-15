import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function TeamAbsencesReportPage() {
  const t = await getTranslations('absences')
  const tm = await getTranslations('manager')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: teamMembers } = await supabase
    .from('users')
    .select('id')
    .eq('manager_id', user.id)

  const memberIds = (teamMembers ?? []).map(m => m.id)

  const { data: absences } = memberIds.length > 0
    ? await supabase
        .from('absences')
        .select('*, users!absences_employee_id_fkey(full_name_he, employee_number)')
        .in('employee_id', memberIds)
        .order('date_start', { ascending: false })
    : { data: [] }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/manager/reports" className="text-sm text-blue-600 hover:underline">← {tm('reports')}</Link>
        <h1 className="text-2xl font-semibold text-gray-800">{tm('reportAbsences')}</h1>
      </div>

      {!absences || absences.length === 0 ? (
        <p className="text-gray-400">{t('noAbsences')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{tm('employee')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('type')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('dateStart')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('dateEnd')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 w-20">{t('hours')}</th>
              </tr>
            </thead>
            <tbody>
              {absences.map(ab => {
                const emp = ab.users as unknown as { full_name_he: string; employee_number: string | null } | null
                return (
                  <tr key={ab.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{emp?.full_name_he ?? '—'}</div>
                      {emp?.employee_number && <div className="text-xs text-gray-400">#{emp.employee_number}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {t(`types.${ab.type as 'sick' | 'vacation' | 'military' | 'spouse_sick' | 'parent_sick' | 'child_sick' | 'pregnancy_test'}`)}
                    </td>
                    <td className="px-4 py-3">{ab.date_start}</td>
                    <td className="px-4 py-3">{ab.date_end}</td>
                    <td className="px-4 py-3 text-center">{ab.hours}</td>
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
