'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { validatePassword } from '@/lib/utils/password'
import { setPassword } from '@/lib/actions/auth'

export default function SetPasswordPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const router = useRouter()
  const [password, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validation = validatePassword(password)
  const passwordsMatch = password === confirm && password.length > 0
  const canSubmit = validation.valid && passwordsMatch && !loading

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError('')

    const result = await setPassword(password)
    if (!result.success) {
      const msg =
        result.error === 'passwordTooShort' ? t('passwordTooShort')
        : result.error === 'passwordTooWeak' ? t('passwordTooWeak')
        : result.error ?? 'Error'
      setError(msg)
      setLoading(false)
      return
    }

    router.push('/timesheet/daily')
  }

  const rules: [keyof ReturnType<typeof validatePassword>['rules'], string][] = [
    ['uppercase', t('ruleUppercase')],
    ['lowercase', t('ruleLowercase')],
    ['number', t('ruleNumber')],
    ['special', t('ruleSpecial')],
  ]

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

        <h1 className="mb-1 text-center text-xl font-semibold text-gray-800">
          {t('setPasswordTitle')}
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          {t('setPasswordSubtitle')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Password */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('passwordLabel')}
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPass(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pe-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* Confirm */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('confirmPasswordLabel')}
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pe-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showConfirm ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* Complexity checklist */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t('rulesHeader')}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {rules.map(([key, label]) => (
                <span
                  key={key}
                  className={`text-xs ${validation.rules[key] ? 'text-green-600' : 'text-gray-400'}`}
                >
                  {validation.rules[key] ? '✓' : '○'} {label}
                </span>
              ))}
            </div>
            <span
              className={`mt-1 block text-xs ${validation.lengthOk ? 'text-green-600' : 'text-gray-400'}`}
            >
              {validation.lengthOk ? '✓' : '○'} {t('passwordLength')} ({password.length})
            </span>
          </div>

          {/* Mismatch warning */}
          {confirm.length > 0 && !passwordsMatch && (
            <p className="text-sm text-red-600">{t('passwordMismatch')}</p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('settingPassword') : t('setPasswordBtn')}
          </button>
        </form>
      </div>
    </div>
  )
}
