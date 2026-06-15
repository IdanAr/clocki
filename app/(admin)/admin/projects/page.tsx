import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import ToggleProjectButton from '@/components/admin/ToggleProjectButton'

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; billing?: string }>
}) {
  const { q, billing } = await searchParams
  const t = await getTranslations('admin')
  const supabase = await createClient()

  let query = supabase.from('projects').select('*').order('name_he')
  if (billing === 'billable' || billing === 'internal') {
    query = query.eq('billing_type', billing)
  }

  const { data: projects } = await query

  const filtered = (projects ?? []).filter(p =>
    !q ||
    p.name_he.includes(q) ||
    p.name_en.toLowerCase().includes(q.toLowerCase()) ||
    p.code.toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">{t('projects')}</h1>
        <Link
          href="/admin/projects/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + {t('newProject')}
        </Link>
      </div>

      <form className="flex gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="חיפוש..."
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
        />
        <select
          name="billing"
          defaultValue={billing ?? ''}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
        >
          <option value="">כל הסוגים</option>
          <option value="billable">{t('billable')}</option>
          <option value="internal">{t('internal')}</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200"
        >
          חפש
        </button>
      </form>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-16">
          <p className="text-gray-400">{t('noProjects')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">שם</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('code')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">{t('billingType')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">סטטוס</th>
                <th className="px-4 py-3 text-end font-medium text-gray-500">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{p.name_he}</div>
                    <div className="text-xs text-gray-400">{p.name_en}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.code}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      p.billing_type === 'billable'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {p.billing_type === 'billable' ? t('billable') : t('internal')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      p.is_active ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {p.is_active ? t('active') : t('inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/admin/projects/${p.id}/edit`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        ערוך
                      </Link>
                      <ToggleProjectButton id={p.id} isActive={p.is_active} />
                    </div>
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
