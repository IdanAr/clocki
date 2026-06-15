import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function ReportsPage() {
  const t = await getTranslations('manager')

  const cards = [
    {
      href: '/manager/reports/hours-by-project',
      title: t('reportHours'),
      description: 'סיכום שעות עבודה לפי פרויקט ועובד לתקופה נבחרת',
      icon: '📊',
    },
    {
      href: '/manager/reports/absences',
      title: t('reportAbsences'),
      description: 'רשימת היעדרויות של כל חברי הצוות',
      icon: '📅',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-800">{t('reports')}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-6 transition-all hover:border-blue-300 hover:shadow-sm"
          >
            <div className="text-3xl">{card.icon}</div>
            <div className="text-base font-semibold text-gray-800">{card.title}</div>
            <div className="text-sm text-gray-500">{card.description}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
