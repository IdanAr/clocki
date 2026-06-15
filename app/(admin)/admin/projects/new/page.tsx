import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import ProjectForm from '@/components/admin/ProjectForm'

export default async function NewProjectPage() {
  const t = await getTranslations('admin')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/projects" className="text-sm text-blue-600 hover:underline">
          ← {t('projects')}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-800">{t('newProject')}</h1>
      </div>
      <ProjectForm />
    </div>
  )
}
