'use client'
import { useState, useTransition } from 'react'
import { createDepartment, updateDepartment } from '@/lib/actions/admin'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

type Dept = { id: string; name_he: string; name_en: string; manager_id: string | null }
type Manager = { id: string; full_name_he: string }

export default function DeptForm({
  dept,
  managers,
}: {
  dept?: Dept
  managers: Manager[]
}) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError('')
    startTransition(async () => {
      const result = dept
        ? await updateDepartment(dept.id, fd)
        : await createDepartment(fd)
      if (result.success) {
        router.push('/admin/departments')
      } else {
        setError(result.error ?? 'שגיאה')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">{t('deptNameHe')} *</span>
        <input name="name_he" defaultValue={dept?.name_he} required
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">{t('deptNameEn')} *</span>
        <input name="name_en" defaultValue={dept?.name_en} required
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">{t('manager')}</span>
        <select name="manager_id" defaultValue={dept?.manager_id ?? ''}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none">
          <option value="">— ללא ממונה —</option>
          {managers.map(m => (
            <option key={m.id} value={m.id}>{m.full_name_he}</option>
          ))}
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
