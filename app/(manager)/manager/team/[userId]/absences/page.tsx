import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function TeamMemberAbsencesPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const t = await getTranslations('absences')
  const tm = await getTranslations('manager')
  const supabase = await createClient()

  const { data: member } = await supabase
    .from('users')
    .select('full_name_he, employee_number')
    .eq('id', userId)
    .single()

  if (!member) notFound()

  const { data: absences } = await supabase
    .from('absences')
    .select('*')
    .eq('employee_id', userId)
    .order('date_start', { ascending: false })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/manager/team" className="text-sm text-blue-600 hover:underline">
          ← {tm('team')}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-800">
          {member.full_name_he}
          {member.employee_number && (
            <span className="ms-2 text-base font-normal text-gray-400">#{member.employee_number}</span>
          )}
          <span className="ms-3 text-base font-normal text-gray-500">— {t('title')}</span>
        </h1>
      </div>

      {!absences || absences.length === 0 ? (
        <p className="text-gray-400">{t('noAbsences')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('type')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('dateStart')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('dateEnd')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 w-20">{t('hours')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('notes')}</th>
              </tr>
            </thead>
            <tbody>
              {absences.map(ab => (
                <tr key={ab.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {t(`types.${ab.type as 'sick' | 'vacation' | 'military' | 'spouse_sick' | 'parent_sick' | 'child_sick' | 'pregnancy_test'}`)}
                  </td>
                  <td className="px-4 py-3">{ab.date_start}</td>
                  <td className="px-4 py-3">{ab.date_end}</td>
                  <td className="px-4 py-3 text-center">{ab.hours}</td>
                  <td className="px-4 py-3 text-gray-500 italic">{ab.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
