import { getTranslations } from 'next-intl/server'

export default async function DailyTimesheetPage() {
  const t = await getTranslations('timesheet')
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-800">{t('daily')}</h1>
      <p className="mt-2 text-gray-500">Coming in Plan 2.</p>
    </div>
  )
}
