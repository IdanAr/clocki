'use client'
import { useState, useTransition } from 'react'
import { assignProjects } from '@/lib/actions/admin'
import { useTranslations } from 'next-intl'

type Project = { id: string; name_he: string; name_en: string; code: string }

export default function AssignProjectsForm({
  userId,
  allProjects,
  assignedIds,
}: {
  userId: string
  allProjects: Project[]
  assignedIds: string[]
}) {
  const t = useTranslations('admin')
  const [checked, setChecked] = useState<Set<string>>(new Set(assignedIds))
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setSaved(false)
  }

  const handleSave = () => {
    setError('')
    setSaved(false)
    startTransition(async () => {
      const result = await assignProjects(userId, [...checked])
      if (result.success) {
        setSaved(true)
      } else {
        setError(result.error ?? 'שגיאה')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
      {saved && <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">הפרויקטים עודכנו בהצלחה.</p>}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {allProjects.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">{t('noProjects')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-12 px-4 py-3"></th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">שם</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('code')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">שיוך</th>
              </tr>
            </thead>
            <tbody>
              {allProjects.map(p => {
                const isChecked = checked.has(p.id)
                return (
                  <tr
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className={`cursor-pointer border-t border-gray-100 hover:bg-blue-50 ${isChecked ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(p.id)}
                        onClick={e => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{p.name_he}</div>
                      <div className="text-xs text-gray-400">{p.name_en}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                    <td className="px-4 py-3 text-center">
                      {isChecked && (
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                          {t('assignedBadge')}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? t('saving') : t('saveChanges')}
        </button>
      </div>
    </div>
  )
}
