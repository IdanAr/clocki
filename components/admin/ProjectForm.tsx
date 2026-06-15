'use client'
import { useState, useTransition } from 'react'
import { createProject, updateProject } from '@/lib/actions/admin'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

type Project = {
  id: string
  name_he: string
  name_en: string
  code: string
  billing_type: 'billable' | 'internal'
  is_active: boolean
}

export default function ProjectForm({ project }: { project?: Project }) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError('')
    startTransition(async () => {
      const result = project ? await updateProject(project.id, fd) : await createProject(fd)
      if (result.success) {
        router.push('/admin/projects')
      } else {
        setError(result.error ?? 'שגיאה')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">{t('projectNameHe')} *</span>
        <input name="name_he" defaultValue={project?.name_he} required
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">{t('projectNameEn')} *</span>
        <input name="name_en" defaultValue={project?.name_en} required
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">{t('code')} *</span>
        <input name="code" defaultValue={project?.code} required placeholder="ATX-01"
          className="rounded border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-400 focus:outline-none" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">{t('billingType')} *</span>
        <select name="billing_type" defaultValue={project?.billing_type ?? 'billable'}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none">
          <option value="billable">{t('billable')}</option>
          <option value="internal">{t('internal')}</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">סטטוס</span>
        <select name="is_active" defaultValue={project?.is_active === false ? 'false' : 'true'}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none">
          <option value="true">{t('active')}</option>
          <option value="false">{t('inactive')}</option>
        </select>
      </label>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
          {isPending ? t('saving') : t('saveChanges')}
        </button>
        <button type="button" onClick={() => router.back()}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
          ביטול
        </button>
      </div>
    </form>
  )
}
