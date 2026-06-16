// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient, getRedirectForRole } from '@/lib/supabase/middleware-client'
import type { UserRole } from '@/types/database'

export async function middleware(request: NextRequest) {
  const { supabase, response } = await createMiddlewareClient(request)
  const { pathname } = request.nextUrl

  const { data: { user } } = await supabase.auth.getUser()

  // Unauthenticated user on set-password has no session → send to login
  if (!user && pathname === '/login/set-password') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Not authenticated → send to login (except if already on login pages)
  if (!user && !pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Already authenticated → skip login pages, but allow through to set-password and confirm
  if (
    user &&
    pathname.startsWith('/login') &&
    pathname !== '/login/set-password' &&
    pathname !== '/login/confirm'
  ) {
    return NextResponse.redirect(new URL('/timesheet/daily', request.url))
  }

  // Role-based guard (only for authenticated users on guarded paths)
  if (user && (pathname.startsWith('/admin') || pathname.startsWith('/manager'))) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = (profile?.role ?? 'employee') as UserRole
    const redirectPath = getRedirectForRole(role, pathname)

    if (redirectPath) {
      return NextResponse.redirect(new URL(redirectPath, request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/callback).*)',
  ],
}
