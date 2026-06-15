'use client'
import { useState, useTransition } from 'react'
import { inviteUser } from '@/lib/actions/admin'
import { useTranslations } from 'next-intl'

export default function InviteUserForm() {
  const t = useTranslations('admin')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError('')
    setSuccess(false)
    startTransition(async () => {
      const result = await inviteUser(fd)
      if (result.success) {
        setSuccess(true)
        ;(e.target as HTMLFormElement).reset()
      } else {
        setError(result.error ?? 'שגיאה')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
      {success && <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{t('inviteSent')}</p>}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">{t('inviteEmail')} *</span>
        <input name="email" type="email" required placeholder="user@example.com"
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
      </label>

      <div>
        <button type="submit" disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
          {isPending ? t('saving') : t('sendInvite')}
        </button>
      </div>

      <p className="text-xs text-gray-400">
        לאחר קבלת ההזמנה, עבור לעריכת פרופיל המשתמש כדי להגדיר תפקיד, מחלקה וממונה.
      </p>
    </form>
  )
}
