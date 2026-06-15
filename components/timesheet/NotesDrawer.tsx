'use client'
import { useState, useTransition, useEffect } from 'react'
import { updateEntryNotes } from '@/lib/actions/timesheet'
import { useTranslations } from 'next-intl'

type RowData = {
  key: string
  entryId?: string
  work_date: string
  employee_notes: string
  manager_notes: string
}

export default function NotesDrawer({
  row,
  isEditable,
  onClose,
  onSave,
}: {
  row: RowData
  isEditable: boolean
  onClose: () => void
  onSave: (notes: string) => void
}) {
  const t = useTranslations('timesheet')
  const [notes, setNotes] = useState(row.employee_notes)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  useEffect(() => {
    setNotes(row.employee_notes)
    setError('')
  }, [row.key, row.employee_notes])

  const handleSave = () => {
    if (!row.entryId) {
      onSave(notes)
      return
    }
    startTransition(async () => {
      try {
        await updateEntryNotes(row.entryId!, notes)
        onSave(notes)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden
      />

      <aside
        className="fixed inset-y-0 end-0 z-50 flex w-80 flex-col border-s border-gray-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal
        aria-label={t('notes')}
        onKeyDown={e => e.key === 'Escape' && onClose()}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">📅 {row.work_date}</p>
            <p className="text-xs text-gray-500">{t('notes')}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-auto p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t('employeeNotes')}
            </label>
            {isEditable ? (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={6}
                placeholder="הוסף הערה..."
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <div className="min-h-20 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {notes || <span className="italic text-gray-400">אין הערה</span>}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t('managerNotes')}
            </label>
            <div className="min-h-16 rounded-lg bg-gray-50 px-3 py-2 text-sm italic text-gray-500">
              {row.manager_notes || <span className="text-gray-400">{t('noManagerNote')}</span>}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {isEditable && (
          <div className="border-t border-gray-200 p-4">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? t('saving') : t('save')}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
