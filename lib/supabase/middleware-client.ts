// lib/supabase/middleware-client.ts
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/database'
import type { UserRole } from '@/types/database'

export async function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  return { supabase, response }
}

export function getRedirectForRole(role: UserRole, pathname: string): string | null {
  if (pathname.startsWith('/admin') && role !== 'admin') return '/timesheet/daily'
  if (pathname.startsWith('/manager') && role === 'employee') return '/timesheet/daily'
  return null
}
