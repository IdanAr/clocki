'use client'
import { useState, useTransition } from 'react'
import { createAbsence } from '@/lib/actions/absence'
import { useTranslations } from 'next-intl'
import type { AbsenceType } from '@/types/database'

const ABSENCE_TYPES: AbsenceType[] = [
  'sick', 'vacation', 'military', 'spouse_sick', 'parent_sick', 'child_sick', 'pregnancy_test',
]

export default function AbsenceForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations('absences')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    type: 'sick' as AbsenceType,
    date_start: '',
    date_end: '',
    hours: 8,
    notes: '',
  })

  const set = (field: string, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await createAbsence({ ...form, hours: Number(form.hours) })
      if (result.success) {
        onDone()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">{t('type')}</label>
          <select
            value={form.type}
            onChange={e => set('type', e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            required
          >
            {ABSENCE_TYPES.map(type => (
              <option key={type} value={type}>{t(`types.${type}`)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">{t('dateStart')}</label>
          <input
            type="date"
            value={form.date_start}
            onChange={e => set('date_start', e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">{t('dateEnd')}</label>
          <input
            type="date"
            value={form.date_end}
            onChange={e => set('date_end', e.target.value)}
            min={form.date_start}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">{t('hours')}</label>
          <input
            type="number"
            min="0.5"
            max="744"
            step="0.5"
            value={form.hours}
            onChange={e => set('hours', e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            required
          />
        </div>

        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-600">{t('notes')}</label>
          <input
            type="text"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="הערות (אופציונלי)"
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? '...' : t('save')}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
