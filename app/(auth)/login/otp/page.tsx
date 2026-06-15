'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'

export default function OtpPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const [otp, setOtp] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const stored = sessionStorage.getItem('clocki_otp_email')
    if (!stored) { router.push('/login'); return }
    setEmail(stored)
  }, [router])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    sessionStorage.removeItem('clocki_otp_email')
    router.push('/timesheet/daily')
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#16213d]"
      dir={locale === 'he' ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="text-3xl font-bold text-blue-600">⏱ Clocki</div>
        </div>

        <h1 className="mb-2 text-center text-xl font-semibold text-gray-800">
          {t('otpTitle')}
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">{t('otpDescription')}</p>
        {email && (
          <p className="mb-4 text-center text-sm font-medium text-blue-600">{email}</p>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('otpLabel')}
            </label>
            <input
              type="text"
              required
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-2xl font-bold tracking-[0.5em] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="000000"
              maxLength={6}
              inputMode="numeric"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || otp.length < 6}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('loggingIn') : t('verify')}
          </button>
        </form>

        <button
          onClick={() => router.push('/login')}
          className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700"
        >
          {t('backToLogin')}
        </button>
      </div>
    </div>
  )
}
