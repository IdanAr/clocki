'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import AbsenceForm from '@/components/forms/AbsenceForm'

type Absence = {
  id: string
  type: string
  date_start: string
  date_end: string
  hours: number
  notes: string | null
}

export default function AbsencesPage() {
  const t = useTranslations('absences')
  const tc = useTranslations('common')
  const [absences, setAbsences] = useState<Absence[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchAbsences = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('absences')
      .select('id, type, date_start, date_end, hours, notes')
      .order('date_start', { ascending: false })
    setAbsences(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchAbsences() }, [])

  const handleFormDone = () => {
    setShowForm(false)
    fetchAbsences()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">{t('title')}</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            + {t('newAbsence')}
          </button>
        )}
      </div>

      {showForm && <AbsenceForm onDone={handleFormDone} />}

      {loading ? (
        <p className="text-sm text-gray-400">{tc('loading')}</p>
      ) : absences.length === 0 ? (
        <p className="text-gray-400">{t('noAbsences')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('type')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('dateStart')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('dateEnd')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 w-20">{t('hours')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('notes')}</th>
              </tr>
            </thead>
            <tbody>
              {absences.map(ab => (
                <tr key={ab.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{t(`types.${ab.type as 'sick' | 'vacation' | 'military' | 'spouse_sick' | 'parent_sick' | 'child_sick' | 'pregnancy_test'}`)}</td>
                  <td className="px-4 py-3">{ab.date_start}</td>
                  <td className="px-4 py-3">{ab.date_end}</td>
                  <td className="px-4 py-3 text-center">{ab.hours}</td>
                  <td className="px-4 py-3 text-gray-500 italic">{ab.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
