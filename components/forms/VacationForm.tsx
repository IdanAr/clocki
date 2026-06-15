'use client'
import { useState, useTransition } from 'react'
import { createVacationRequest } from '@/lib/actions/vacation'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function VacationForm({ defaultType = 'periodic' }: { defaultType?: 'periodic' | 'continuous' }) {
  const t = useTranslations('vacation')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    date_start: '',
    date_end: '',
    type: defaultType,
    employee_notes: '',
  })

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await createVacationRequest(form)
      if (result.success) {
        router.push('/vacation/requests')
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-lg">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t('type')}</label>
        <select
          value={form.type}
          onChange={e => set('type', e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="periodic">{t('types.periodic')}</option>
          <option value="continuous">{t('types.continuous')}</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('dateStart')}</label>
          <input
            type="date"
            value={form.date_start}
            onChange={e => set('date_start', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('dateEnd')}</label>
          <input
            type="date"
            value={form.date_end}
            onChange={e => set('date_end', e.target.value)}
            min={form.date_start}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t('notes')}</label>
        <textarea
          value={form.employee_notes}
          onChange={e => set('employee_notes', e.target.value)}
          rows={3}
          placeholder="הערות (אופציונלי)"
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-6 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? '...' : t('submit')}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
