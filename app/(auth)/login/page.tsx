'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'

export default function LoginPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    // Store email in sessionStorage so OTP page can use it
    sessionStorage.setItem('clocki_otp_email', email)
    router.push('/login/otp')
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#16213d]"
      dir={locale === 'he' ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="text-3xl font-bold text-blue-600">⏱ Clocki</div>
          <div className="mt-1 text-sm text-gray-500">Attenix</div>
        </div>

        <h1 className="mb-6 text-center text-xl font-semibold text-gray-800">
          {t('title')}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('emailLabel')}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('sending') : t('sendOtp')}
          </button>
        </form>
      </div>
    </div>
  )
}
