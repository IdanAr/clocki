import { getTranslations } from 'next-intl/server'
import VacationForm from '@/components/forms/VacationForm'

export default async function NewVacationPage() {
  const t = await getTranslations('vacation')
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-800">{t('newRequest')}</h1>
      <VacationForm defaultType="periodic" />
    </div>
  )
}
