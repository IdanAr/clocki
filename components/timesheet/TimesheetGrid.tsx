'use client'
import { useState, useTransition } from 'react'
import { saveEntries, submitTimesheet } from '@/lib/actions/timesheet'
import NotesDrawer from './NotesDrawer'
import { useTranslations } from 'next-intl'

export type Project = { id: string; name_he: string; name_en: string; code: string }
export type TimesheetEntry = {
  id: string
  timesheet_id: string
  project_id: string
  work_date: string
  hours: number
  employee_notes: string | null
  manager_notes: string | null
}
export type Absence = {
  id: string
  type: string
  date_start: string
  date_end: string
  hours: number
}
export type Timesheet = {
  id: string
  status: string
  employee_id: string
  period_start: string
  period_end: string
}

type RowData = {
  key: string
  entryId?: string
  work_date: string
  project_id: string
  hours: number
  employee_notes: string
  manager_notes: string
}

let _keyCounter = 0
const newKey = () => `new-${++_keyCounter}`

function entriesToRows(entries: TimesheetEntry[]): RowData[] {
  return entries.map(e => ({
    key: e.id,
    entryId: e.id,
    work_date: e.work_date,
    project_id: e.project_id,
    hours: e.hours,
    employee_notes: e.employee_notes ?? '',
    manager_notes: e.manager_notes ?? '',
  }))
}

export default function TimesheetGrid({
  timesheet,
  entries,
  absences,
  projects,
  periodStart,
  periodEnd,
  locale,
}: {
  timesheet: Timesheet
  entries: TimesheetEntry[]
  absences: Absence[]
  projects: Project[]
  periodStart: string
  periodEnd: string
  locale: string
}) {
  const t = useTranslations('timesheet')
  const [rows, setRows] = useState<RowData[]>(() => entriesToRows(entries))
  const [drawerRow, setDrawerRow] = useState<RowData | null>(null)
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState('')

  const isEditable = timesheet.status === 'draft'

  const addRow = () => {
    setRows(prev => [
      ...prev,
      {
        key: newKey(),
        work_date: periodStart,
        project_id: projects[0]?.id ?? '',
        hours: 8,
        employee_notes: '',
        manager_notes: '',
      },
    ])
  }

  const removeRow = (key: string) => setRows(prev => prev.filter(r => r.key !== key))

  const updateRow = (key: string, field: keyof RowData, value: string | number) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, [field]: value } : r)))
  }

  const updateRowNotes = (key: string, notes: string) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, employee_notes: notes } : r)))
  }

  const currentEntries = () =>
    rows.map(r => ({
      work_date: r.work_date,
      project_id: r.project_id,
      hours: Number(r.hours),
      employee_notes: r.employee_notes || null,
    }))

  const handleSave = () => {
    startTransition(async () => {
      try {
        setSaveError('')
        await saveEntries(timesheet.id, currentEntries())
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  const handleSubmit = () => {
    if (!confirm(t('submitConfirm'))) return
    startTransition(async () => {
      try {
        setSaveError('')
        await saveEntries(timesheet.id, currentEntries())
        await submitTimesheet(timesheet.id)
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Submit failed')
      }
    })
  }

  const totalHours = rows.reduce((sum, r) => sum + Number(r.hours), 0)
  const absenceHours = absences.reduce((sum, a) => sum + Number(a.hours), 0)

  const absenceTypeLabel: Record<string, string> = {
    sick: 'מחלה', vacation: 'חופשה', military: 'מילואים',
    spouse_sick: 'מחלת בן/בת זוג', parent_sick: 'מחלת הורה',
    child_sick: 'מחלת ילד', pregnancy_test: 'בדיקת היריון',
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-start font-medium text-gray-500 w-36">תאריך</th>
              <th className="px-3 py-2 text-start font-medium text-gray-500">{t('project')}</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500 w-20">{t('hours')}</th>
              <th className="px-3 py-2 w-10"></th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  {t('noEntries')}
                </td>
              </tr>
            )}

            {rows.map(row => (
              <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50/50">
                <td className="px-3 py-2">
                  {isEditable ? (
                    <input
                      type="date"
                      value={row.work_date}
                      min={periodStart}
                      max={periodEnd}
                      onChange={e => updateRow(row.key, 'work_date', e.target.value)}
                      className="rounded border border-gray-200 px-2 py-1 text-sm w-34"
                    />
                  ) : (
                    <span className="font-medium">{row.work_date}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {isEditable ? (
                    <select
                      value={row.project_id}
                      onChange={e => updateRow(row.key, 'project_id', e.target.value)}
                      className="rounded border border-gray-200 px-2 py-1 text-sm max-w-52"
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {locale === 'he' ? p.name_he : p.name_en} ({p.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>
                      {projects.find(p => p.id === row.project_id)?.[locale === 'he' ? 'name_he' : 'name_en'] ?? row.project_id}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {isEditable ? (
                    <input
                      type="number"
                      min="0.5"
                      max="24"
                      step="0.5"
                      value={row.hours}
                      onChange={e => updateRow(row.key, 'hours', e.target.value)}
                      className="w-16 rounded border border-gray-200 px-2 py-1 text-center text-sm"
                    />
                  ) : (
                    <span>{row.hours}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => setDrawerRow(row)}
                    className="text-base leading-none"
                    title={t('notes')}
                    aria-label={t('notes')}
                  >
                    {row.employee_notes || row.manager_notes ? '💬' : '🗨️'}
                  </button>
                </td>
                <td className="px-3 py-2 text-center">
                  {isEditable && (
                    <button
                      onClick={() => removeRow(row.key)}
                      className="text-red-400 hover:text-red-600 text-sm"
                      aria-label="Remove row"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {absences.map(ab => (
              <tr key={`absence-${ab.id}`} className="border-t border-gray-100 bg-red-50">
                <td className="px-3 py-2 text-red-700 font-medium">{ab.date_start}</td>
                <td className="px-3 py-2 text-red-600 italic" colSpan={2}>
                  {absenceTypeLabel[ab.type] ?? ab.type} — {ab.hours} שע׳
                </td>
                <td colSpan={2} />
              </tr>
            ))}

            {isEditable && (
              <tr className="border-t border-gray-100">
                <td colSpan={5} className="px-3 py-2">
                  <button
                    onClick={addRow}
                    disabled={projects.length === 0}
                    className="rounded border border-dashed border-blue-300 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                  >
                    + {t('addRow')}
                  </button>
                  {projects.length === 0 && (
                    <span className="ms-2 text-xs text-gray-400">
                      אין פרויקטים מוקצים — פנה לאדמין
                    </span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-gray-200 px-4 py-3">
        {saveError && <p className="mb-2 text-sm text-red-600">{saveError}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-6 text-sm text-gray-500">
            <span>
              {t('totalHours')}: <strong className="text-gray-800">{totalHours}</strong>
            </span>
            {absenceHours > 0 && (
              <span>
                {t('absenceHours')}: <strong className="text-red-600">{absenceHours}</strong>
              </span>
            )}
          </div>

          {isEditable && (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isPending}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {isPending ? t('saving') : t('save')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending || rows.length === 0}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {t('submit')}
              </button>
            </div>
          )}
        </div>
      </div>

      {drawerRow && (
        <NotesDrawer
          row={drawerRow}
          isEditable={isEditable}
          onClose={() => setDrawerRow(null)}
          onSave={(notes) => {
            updateRowNotes(drawerRow.key, notes)
            setDrawerRow(null)
          }}
        />
      )}
    </div>
  )
}
