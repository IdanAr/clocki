import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function AdminDepartmentsPage() {
  const t = await getTranslations('admin')
  const supabase = await createClient()

  const { data: departments } = await supabase
    .from('departments')
    .select('*, users!departments_manager_id_fkey(full_name_he)')
    .order('name_he')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">{t('departments')}</h1>
        <Link
          href="/admin/departments/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + {t('newDepartment')}
        </Link>
      </div>

      {!departments || departments.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-16">
          <p className="text-gray-400">{t('noDepartments')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('deptNameHe')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('deptNameEn')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('manager')}</th>
                <th className="px-4 py-3 text-end font-medium text-gray-500">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {departments.map(d => {
                const mgr = d.users as unknown as { full_name_he: string } | null
                return (
                  <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{d.name_he}</td>
                    <td className="px-4 py-3 text-gray-600">{d.name_en}</td>
                    <td className="px-4 py-3 text-gray-600">{mgr?.full_name_he ?? '—'}</td>
                    <td className="px-4 py-3 text-end">
                      <Link
                        href={`/admin/departments/${d.id}/edit`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        ערוך
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
