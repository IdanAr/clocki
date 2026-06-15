'use client'
import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { approveTimesheet, rejectTimesheet, saveManagerEntryNote } from '@/lib/actions/manager'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

type Entry = {
  id: string
  work_date: string
  hours: number
  employee_notes: string | null
  manager_notes: string | null
  project_id: string
  projects: { name_he: string; name_en: string; code: string } | null
}

type Timesheet = {
  id: string
  status: string
  period_start: string
  period_end: string
  employee_id: string
  users: { full_name_he: string; full_name_en: string; employee_number: string | null } | null
}

export default function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations('manager')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [id, setId] = useState('')
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then(p => setId(p.id))
  }, [params])

  useEffect(() => {
    if (!id) return
    const supabase = createClient()

    Promise.all([
      supabase
        .from('timesheets')
        .select('*, users!timesheets_employee_id_fkey(full_name_he, full_name_en, employee_number)')
        .eq('id', id)
        .single(),
      supabase
        .from('timesheet_entries')
        .select('*, projects(name_he, name_en, code)')
        .eq('timesheet_id', id)
        .order('work_date'),
    ]).then(([tsResult, entriesResult]) => {
      const ts = tsResult.data as unknown as Timesheet
      const ents = (entriesResult.data ?? []) as unknown as Entry[]
      setTimesheet(ts)
      setEntries(ents)
      const initialNotes: Record<string, string> = {}
      ents.forEach(e => { initialNotes[e.id] = e.manager_notes ?? '' })
      setNotes(initialNotes)
      setLoading(false)
    })
  }, [id])

  const handleApprove = () => {
    if (!confirm(t('approveConfirm'))) return
    startTransition(async () => {
      await Promise.all(
        entries
          .filter(e => notes[e.id] !== (e.manager_notes ?? ''))
          .map(e => saveManagerEntryNote(e.id, notes[e.id]))
      )
      const result = await approveTimesheet(id)
      if (result.success) {
        router.push('/manager/approvals')
      } else {
        setError(result.error ?? 'Failed')
      }
    })
  }

  const handleReject = () => {
    if (!confirm(t('rejectConfirm'))) return
    startTransition(async () => {
      const result = await rejectTimesheet(id)
      if (result.success) {
        router.push('/manager/approvals')
      } else {
        setError(result.error ?? 'Failed')
      }
    })
  }

  if (loading) {
    return <div className="p-8 text-gray-400">טוען...</div>
  }

  if (!timesheet) {
    return <div className="p-8 text-red-600">גיליון לא נמצא</div>
  }

  const emp = timesheet.users
  const totalHours = entries.reduce((s, e) => s + Number(e.hours), 0)
  const isSubmitted = timesheet.status === 'submitted'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/manager/approvals" className="text-sm text-blue-600 hover:underline">
            ← {t('approvals')}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-gray-800">
            {emp?.full_name_he ?? '—'}
            {emp?.employee_number && <span className="ms-2 text-base font-normal text-gray-400">#{emp.employee_number}</span>}
          </h1>
          <p className="text-sm text-gray-500">
            {timesheet.period_start} – {timesheet.period_end}
          </p>
        </div>

        {isSubmitted && (
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={isPending}
              className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {t('rejectBtn')}
            </button>
            <button
              onClick={handleApprove}
              disabled={isPending}
              className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              {t('approveBtn')}
            </button>
          </div>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-start font-medium text-gray-500 w-32">תאריך</th>
              <th className="px-4 py-3 text-start font-medium text-gray-500">פרויקט</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 w-16">שעות</th>
              <th className="px-4 py-3 text-start font-medium text-gray-500">הערות עובד</th>
              <th className="px-4 py-3 text-start font-medium text-gray-500">הערות ממונה</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  אין רשומות בגיליון זה
                </td>
              </tr>
            )}
            {entries.map(e => (
              <tr key={e.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium">{e.work_date}</td>
                <td className="px-4 py-3">
                  {e.projects ? `${e.projects.name_he} (${e.projects.code})` : '—'}
                </td>
                <td className="px-4 py-3 text-center">{e.hours}</td>
                <td className="px-4 py-3 text-gray-500 italic">
                  {e.employee_notes ?? '—'}
                </td>
                <td className="px-4 py-3">
                  {isSubmitted ? (
                    <input
                      type="text"
                      value={notes[e.id] ?? ''}
                      onChange={ev => setNotes(prev => ({ ...prev, [e.id]: ev.target.value }))}
                      placeholder={t('addManagerNote')}
                      className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
                    />
                  ) : (
                    <span className="italic text-gray-500">{e.manager_notes ?? '—'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td colSpan={2} className="px-4 py-3 font-semibold">סה״כ</td>
              <td className="px-4 py-3 text-center font-bold">{totalHours}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
