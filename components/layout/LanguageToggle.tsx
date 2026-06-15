'use client'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

export default function LanguageToggle() {
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const toggle = async () => {
    const next = locale === 'he' ? 'en' : 'he'
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    })
    startTransition(() => router.refresh())
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
      aria-label="Toggle language"
    >
      🌐 {locale === 'he' ? 'EN' : 'עב'}
    </button>
  )
}
