import { getTranslations } from 'next-intl/server'

export default async function SettingsPage() {
  const t = await getTranslations('admin')

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-800">{t('settings')}</h1>

      <div className="rounded-lg border border-gray-200 bg-white px-6 py-8 text-center text-gray-400">
        <p>הגדרות חברה יתווספו בגרסה הבאה.</p>
        <p className="mt-1 text-sm">Company settings — coming in the next release.</p>
      </div>
    </div>
  )
}
