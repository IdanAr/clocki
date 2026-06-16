'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthConfirmPage() {
  const router = useRouter()
  const done = useRef(false)

  useEffect(() => {
    // Guard against React Strict Mode double-invocation
    if (done.current) return
    done.current = true

    async function handle() {
      const supabase = createClient()

      // Read URL data before any async work
      const code = new URLSearchParams(window.location.search).get('code')
      const hp = new URLSearchParams(window.location.hash.slice(1))
      const accessToken = hp.get('access_token')
      const refreshToken = hp.get('refresh_token')

      let session = null
      let errMsg: string | null = null

      if (code) {
        // PKCE flow: code in query string
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        session = data.session
        errMsg = error?.message ?? null
      } else if (accessToken && refreshToken) {
        // Implicit flow: tokens in hash fragment
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        session = data.session
        errMsg = error?.message ?? null
      } else {
        // Supabase may have auto-detected the session from the URL
        const { data } = await supabase.auth.getSession()
        session = data.session
      }

      if (!session) {
        router.replace(`/login?error=${encodeURIComponent(errMsg ?? 'auth_callback_error')}`)
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('password_set')
        .eq('id', session.user.id)
        .single()

      router.replace(!profile?.password_set ? '/login/set-password' : '/timesheet/daily')
    }

    handle().catch(() => router.replace('/login?error=auth_callback_error'))
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#16213d]">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg text-center">
        <div className="mb-2 text-3xl font-bold text-blue-600">⏱ Clocki</div>
        <p className="text-sm text-gray-500">מאמת...</p>
      </div>
    </div>
  )
}
