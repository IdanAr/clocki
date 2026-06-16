// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'
import type { User } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'recovery' | 'invite' | 'email' | 'magiclink' | null
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  let user: User | null = null

  if (code) {
    const { data, error: err } = await supabase.auth.exchangeCodeForSession(code)
    if (err) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(err.message)}`)
    }
    user = data.user
  } else if (tokenHash && type) {
    const { data, error: err } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (err) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(err.message)}`)
    }
    user = data.user ?? null
  }

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('password_set')
      .eq('id', user.id)
      .single()

    if (!profile?.password_set) {
      return NextResponse.redirect(`${origin}/login/set-password`)
    }
    return NextResponse.redirect(`${origin}/timesheet/daily`)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
