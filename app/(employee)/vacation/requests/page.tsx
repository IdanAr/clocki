import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function VacationRequestsPage() {
  const t = await getTranslations('vacation')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: requests } = await supabase
    .from('vacation_requests')
    .select('*')
    .eq('employee_id', user.id)
    .order('created_at', { ascending: false })

  const statusColours: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">{t('title')}</h1>
        <Link
          href="/vacation/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + {t('newRequest')}
        </Link>
      </div>

      {!requests || requests.length === 0 ? (
        <p className="text-gray-400">{t('noRequests')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('type')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('dateStart')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('dateEnd')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">סטטוס</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('managerNotes')}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">{t(`types.${r.type}`)}</td>
                  <td className="px-4 py-3">{r.date_start}</td>
                  <td className="px-4 py-3">{r.date_end}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${statusColours[r.status] ?? ''}`}>
                      {t(`status.${r.status as 'pending' | 'approved' | 'rejected'}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 italic">{r.manager_notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
