import { createClient } from '@/lib/supabase/server'
import { getTranslations, getLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function TimesheetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations('timesheet')
  const locale = await getLocale()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: ts } = await supabase
    .from('timesheets')
    .select('*')
    .eq('id', id)
    .eq('employee_id', user.id)
    .single()

  if (!ts) notFound()

  const { data: entries } = await supabase
    .from('timesheet_entries')
    .select('*, projects(name_he, name_en, code)')
    .eq('timesheet_id', id)
    .order('work_date')

  const statusColours: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    submitted: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  }

  const totalHours = (entries ?? []).reduce((s, e) => s + Number(e.hours), 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/timesheet/periodic" className="text-sm text-blue-600 hover:underline">
          ← {t('periodic')}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-800">
          {t('detail')} · {ts.period_start} – {ts.period_end}
        </h1>
        <span className={`rounded px-2 py-1 text-xs font-semibold ${statusColours[ts.status] ?? ''}`}>
          {t(`status.${ts.status as 'draft' | 'submitted' | 'approved' | 'rejected'}`)}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-start font-medium text-gray-500">תאריך</th>
              <th className="px-4 py-3 text-start font-medium text-gray-500">{t('project')}</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 w-20">{t('hours')}</th>
              <th className="px-4 py-3 text-start font-medium text-gray-500">{t('employeeNotes')}</th>
              <th className="px-4 py-3 text-start font-medium text-gray-500">{t('managerNotes')}</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map(e => {
              const proj = e.projects as unknown as { name_he: string; name_en: string; code: string } | null
              return (
                <tr key={e.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium">{e.work_date}</td>
                  <td className="px-4 py-3">{proj ? (locale === 'he' ? proj.name_he : proj.name_en) : '—'}</td>
                  <td className="px-4 py-3 text-center">{e.hours}</td>
                  <td className="px-4 py-3 text-gray-600 italic">{e.employee_notes ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 italic">{e.manager_notes ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td colSpan={2} className="px-4 py-3 font-semibold">{t('totalHours')}</td>
              <td className="px-4 py-3 text-center font-bold">{totalHours}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
