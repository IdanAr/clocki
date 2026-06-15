import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

const roleColours: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  manager: 'bg-blue-100 text-blue-800',
  employee: 'bg-gray-100 text-gray-600',
}

export default async function AdminUsersPage() {
  const t = await getTranslations('admin')
  const profileT = await getTranslations('profile')
  const supabase = await createClient()

  const { data: users } = await supabase
    .from('users')
    .select('*, departments(name_he)')
    .order('full_name_he')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">{t('users')}</h1>
        <Link
          href="/admin/users/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + {t('newUser')}
        </Link>
      </div>

      {!users || users.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-16">
          <p className="text-gray-400">{t('noUsers')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">שם</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('email')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">{t('role')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('department')}</th>
                <th className="px-4 py-3 text-end font-medium text-gray-500">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const dept = u.departments as unknown as { name_he: string } | null
                return (
                  <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{u.full_name_he}</div>
                      {u.employee_number && (
                        <div className="text-xs text-gray-400">#{u.employee_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${roleColours[u.role] ?? ''}`}>
                        {profileT(`roles.${u.role as 'employee' | 'manager' | 'admin'}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{dept?.name_he ?? '—'}</td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex justify-end gap-3">
                        <Link
                          href={`/admin/users/${u.id}/edit`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          ערוך
                        </Link>
                        <Link
                          href={`/admin/users/${u.id}/assign-projects`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {t('assignProjects')}
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
