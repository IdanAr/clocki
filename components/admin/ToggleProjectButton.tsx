'use client'
import { useTransition } from 'react'
import { toggleProjectActive } from '@/lib/actions/admin'
import { useTranslations } from 'next-intl'

export default function ToggleProjectButton({ id, isActive }: { id: string; isActive: boolean }) {
  const t = useTranslations('admin')
  const [isPending, startTransition] = useTransition()

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(async () => { await toggleProjectActive(id, !isActive) })}
      className={`text-sm hover:underline disabled:opacity-40 ${isActive ? 'text-red-500' : 'text-green-600'}`}
    >
      {isActive ? t('deactivate') : t('activate')}
    </button>
  )
}
