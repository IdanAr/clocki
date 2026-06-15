'use client'
import { useState, useTransition } from 'react'
import { updateUser } from '@/lib/actions/admin'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

type User = {
  id: string
  full_name_he: string
  full_name_en: string
  email: string
  employee_number: string | null
  role: 'employee' | 'manager' | 'admin'
  department_id: string | null
  manager_id: string | null
}

type Dept = { id: string; name_he: string }
type Manager = { id: string; full_name_he: string }

export default function UserForm({
  user,
  departments,
  managers,
}: {
  user: User
  departments: Dept[]
  managers: Manager[]
}) {
  const t = useTranslations('admin')
  const profileT = useTranslations('profile')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError('')
    startTransition(async () => {
      const result = await updateUser(user.id, fd)
      if (result.success) {
        router.push('/admin/users')
      } else {
        setError(result.error ?? 'שגיאה')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">
        {t('email')}: <span className="font-medium text-gray-700">{user.email}</span>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">{t('fullNameHe')} *</span>
        <input name="full_name_he" defaultValue={user.full_name_he} required
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">{t('fullNameEn')} *</span>
        <input name="full_name_en" defaultValue={user.full_name_en} required
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">{t('employeeNumber')}</span>
        <input name="employee_number" defaultValue={user.employee_number ?? ''}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">{t('role')} *</span>
        <select name="role" defaultValue={user.role}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none">
          <option value="employee">{profileT('roles.employee')}</option>
          <option value="manager">{profileT('roles.manager')}</option>
          <option value="admin">{profileT('roles.admin')}</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">{t('department')}</span>
        <select name="department_id" defaultValue={user.department_id ?? ''}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none">
          <option value="">— ללא מחלקה —</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name_he}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">{t('manager')}</span>
        <select name="manager_id" defaultValue={user.manager_id ?? ''}
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
