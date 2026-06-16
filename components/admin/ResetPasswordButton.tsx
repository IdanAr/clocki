'use client'
import { useTransition, useState } from 'react'
import { useTranslations } from 'next-intl'
import { resetUserPassword } from '@/lib/actions/admin'

export default function ResetPasswordButton({ userId }: { userId: string }) {
  const t = useTranslations('admin')
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleClick = () => {
    if (!confirm(t('resetPasswordConfirm'))) return
    startTransition(async () => {
      setError('')
      const result = await resetUserPassword(userId)
      if (result.success) {
        setDone(true)
      } else {
        setError(result.error ?? 'Error')
      }
    })
  }

  if (done) {
    return <span className="text-sm text-green-600">{t('resetPasswordSent')}</span>
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="text-sm text-red-600 hover:underline disabled:opacity-40"
      >
        {isPending ? '...' : t('resetPassword')}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
