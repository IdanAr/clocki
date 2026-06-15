import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ProjectForm from '@/components/admin/ProjectForm'

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations('admin')
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (!project) notFound()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/projects" className="text-sm text-blue-600 hover:underline">
          ← {t('projects')}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-800">{t('editProject')}</h1>
      </div>
      <ProjectForm project={project} />
    </div>
  )
}
