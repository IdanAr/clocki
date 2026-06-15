import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function TeamPage() {
  const t = await getTranslations('manager')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: teamMembers } = await supabase
    .from('users')
    .select('id, full_name_he, full_name_en, employee_number, role, departments(name_he)')
    .eq('manager_id', user.id)
    .order('full_name_he')

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-800">{t('team')}</h1>

      {!teamMembers || teamMembers.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-16">
          <p className="text-gray-400">{t('teamEmpty')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">שם</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">מחלקה</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">תפקיד</th>
                <th className="px-4 py-3 text-end font-medium text-gray-500">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map(member => {
                const dept = member.departments as unknown as { name_he: string } | null
                return (
                  <tr key={member.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{member.full_name_he}</div>
                      {member.employee_number && (
                        <div className="text-xs text-gray-400">#{member.employee_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{dept?.name_he ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {member.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex justify-end gap-3">
                        <Link
                          href={`/manager/team/${member.id}/timesheet`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {t('viewTimesheet')}
                        </Link>
                        <Link
                          href={`/manager/team/${member.id}/absences`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {t('viewAbsences')}
                        </Link>
                      </div>
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
