import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import AssignProjectsForm from '@/components/admin/AssignProjectsForm'

export default async function AssignProjectsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations('admin')
  const supabase = await createClient()

  const [{ data: user }, { data: allProjects }, { data: assigned }] = await Promise.all([
    supabase.from('users').select('full_name_he, employee_number').eq('id', id).single(),
    supabase.from('projects').select('id, name_he, name_en, code').eq('is_active', true).order('name_he'),
    supabase.from('user_projects').select('project_id').eq('user_id', id),
  ])

  if (!user) notFound()

  const assignedIds = (assigned ?? []).map(a => a.project_id)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="text-sm text-blue-600 hover:underline">
          ← {t('users')}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-800">
          {t('assignProjects')} — {user.full_name_he}
          {user.employee_number && (
            <span className="ms-2 text-base font-normal text-gray-400">#{user.employee_number}</span>
          )}
        </h1>
      </div>

      <AssignProjectsForm
        userId={id}
        allProjects={allProjects ?? []}
        assignedIds={assignedIds}
      />
    </div>
  )
}
