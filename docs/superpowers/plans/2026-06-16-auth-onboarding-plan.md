# Auth & Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace magic-link OTP login with email+password, add a mandatory password-creation screen for new users, and give admins a password-reset action that invalidates sessions and sends a recovery email.

**Architecture:** A `password_set boolean` column on `users` is the single source of truth for routing. The `/auth/callback` route checks it after any code/token exchange — redirecting to `/login/set-password` when false and to `/timesheet/daily` when true. The login page switches from `signInWithOtp` to `signInWithPassword`. A new `ResetPasswordButton` client component in `components/admin/` handles admin-initiated resets from both the user list and user edit pages.

**Tech Stack:** Next.js 15 App Router, Supabase JS v2 (`@supabase/ssr`), next-intl, Tailwind CSS, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/utils/password.ts` | Create | Pure `validatePassword` function |
| `lib/utils/__tests__/password.test.ts` | Create | Unit tests for password validation |
| `types/database.ts` | Modify | Add `password_set` to `users` Row/Insert/Update |
| `messages/en.json` | Modify | New `auth` and `admin` i18n keys |
| `messages/he.json` | Modify | New `auth` and `admin` i18n keys (Hebrew) |
| `lib/actions/auth.ts` | Create | `setPassword` server action |
| `app/(auth)/login/set-password/page.tsx` | Create | Password creation screen |
| `middleware.ts` | Modify | Carve-out for `/login/set-password` |
| `app/auth/callback/route.ts` | Modify | Check `password_set`; handle `token_hash` flow |
| `app/(auth)/login/page.tsx` | Modify | Email + password form |
| `app/(auth)/login/otp/page.tsx` | Delete | Unused OTP entry screen |
| `lib/actions/admin.ts` | Modify | Add `resetUserPassword` action |
| `components/admin/ResetPasswordButton.tsx` | Create | Admin reset button with confirmation |
| `app/(admin)/admin/users/page.tsx` | Modify | Add `ResetPasswordButton` per row |
| `app/(admin)/admin/users/[id]/edit/page.tsx` | Modify | Add `ResetPasswordButton` section |

---

## Task 1: Password validation utility

**Files:**
- Create: `lib/utils/password.ts`
- Create: `lib/utils/__tests__/password.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/utils/__tests__/password.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validatePassword } from '../password'

describe('validatePassword', () => {
  it('rejects password shorter than 8 chars', () => {
    const r = validatePassword('Ab1!')
    expect(r.valid).toBe(false)
    expect(r.lengthOk).toBe(false)
  })

  it('rejects password longer than 16 chars', () => {
    const r = validatePassword('Ab1!Ab1!Ab1!Ab1!X')
    expect(r.valid).toBe(false)
    expect(r.lengthOk).toBe(false)
  })

  it('accepts exactly 8 chars with 3 rules met', () => {
    // uppercase + lowercase + number
    expect(validatePassword('Password1').valid).toBe(true)
  })

  it('accepts exactly 16 chars with 3 rules met', () => {
    expect(validatePassword('Password1234567X').valid).toBe(true)
  })

  it('detects uppercase rule', () => {
    expect(validatePassword('password1!').rules.uppercase).toBe(false)
    expect(validatePassword('Password1!').rules.uppercase).toBe(true)
  })

  it('detects lowercase rule', () => {
    expect(validatePassword('PASSWORD1!').rules.lowercase).toBe(false)
    expect(validatePassword('Password1!').rules.lowercase).toBe(true)
  })

  it('detects number rule', () => {
    expect(validatePassword('Password!!').rules.number).toBe(false)
    expect(validatePassword('Password1!').rules.number).toBe(true)
  })

  it('detects special character rule', () => {
    expect(validatePassword('Password12').rules.special).toBe(false)
    expect(validatePassword('Password1!').rules.special).toBe(true)
  })

  it('rejects when only 2 of 4 rules met', () => {
    // lowercase + number only, 8 chars
    const r = validatePassword('password1')
    expect(r.rulesCount).toBe(2)
    expect(r.valid).toBe(false)
  })

  it('accepts when exactly 3 of 4 rules met', () => {
    // uppercase + lowercase + number, no special
    const r = validatePassword('Password12')
    expect(r.rulesCount).toBe(3)
    expect(r.valid).toBe(true)
  })

  it('accepts when all 4 rules met', () => {
    const r = validatePassword('Password1!')
    expect(r.rulesCount).toBe(4)
    expect(r.valid).toBe(true)
  })

  it('returns individual rule booleans correctly', () => {
    const r = validatePassword('Password1!')
    expect(r.rules).toEqual({ uppercase: true, lowercase: true, number: true, special: true })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx vitest run lib/utils/__tests__/password.test.ts
```

Expected: FAIL — `Cannot find module '../password'`

- [ ] **Step 3: Implement the utility**

Create `lib/utils/password.ts`:

```ts
export type PasswordRules = {
  uppercase: boolean
  lowercase: boolean
  number: boolean
  special: boolean
}

export type PasswordValidation = {
  lengthOk: boolean
  rules: PasswordRules
  rulesCount: number
  valid: boolean
}

export function validatePassword(password: string): PasswordValidation {
  const lengthOk = password.length >= 8 && password.length <= 16
  const rules: PasswordRules = {
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
  const rulesCount = Object.values(rules).filter(Boolean).length
  return { lengthOk, rules, rulesCount, valid: lengthOk && rulesCount >= 3 }
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```
npx vitest run lib/utils/__tests__/password.test.ts
```

Expected: 11 tests PASS

- [ ] **Step 5: Commit**

```
git add lib/utils/password.ts lib/utils/__tests__/password.test.ts
git commit -m "feat: add password complexity validation utility"
```

---

## Task 2: Update TypeScript database types

**Files:**
- Modify: `types/database.ts`

The `users` row type needs `password_set` so the Supabase client knows about the column.

- [ ] **Step 1: Add `password_set` to the `users` table definition**

In `types/database.ts`, find the `users` table Row (around line 23) and add `password_set: boolean`:

```ts
users: {
  Row: {
    id: string; email: string
    full_name_he: string; full_name_en: string
    employee_number: string | null
    role: UserRole
    department_id: string | null; manager_id: string | null
    created_at: string
    password_set: boolean
  }
  Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'>
  Update: Partial<Database['public']['Tables']['users']['Row']>
  Relationships: []
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add types/database.ts
git commit -m "feat: add password_set column to users TypeScript type"
```

---

## Task 3: Database migration

**Files:** none (SQL run in Supabase dashboard)

- [ ] **Step 1: Run migration in Supabase SQL Editor**

Go to your Supabase project → SQL Editor → run:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Verify column exists**

In Supabase SQL Editor, run:

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'password_set';
```

Expected: one row — `password_set | boolean | false | NO`

---

## Task 4: i18n additions

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/he.json`

- [ ] **Step 1: Add new keys to `messages/en.json`**

In `messages/en.json`, inside the `"auth"` object, add after `"checkEmailDesc"`:

```json
"signIn": "Sign in",
"passwordLabel": "Password",
"confirmPasswordLabel": "Confirm password",
"setPasswordTitle": "Create your password",
"setPasswordSubtitle": "Choose a password to access Clocki",
"setPasswordBtn": "Set password",
"settingPassword": "Saving...",
"passwordMismatch": "Passwords do not match",
"passwordTooShort": "Password must be 8–16 characters",
"passwordTooWeak": "Password must meet at least 3 complexity rules",
"rulesHeader": "Password must satisfy 3 of 4:",
"ruleUppercase": "Uppercase letter",
"ruleLowercase": "Lowercase letter",
"ruleNumber": "Number",
"ruleSpecial": "Special character",
"passwordLength": "8–16 characters"
```

Inside the `"admin"` object, add after `"saving"`:

```json
"resetPassword": "Reset Password",
"resetPasswordConfirm": "Reset this user's password? They will be logged out immediately and receive a reset email.",
"resetPasswordSent": "Password reset email sent."
```

- [ ] **Step 2: Add new keys to `messages/he.json`**

In `messages/he.json`, inside the `"auth"` object, add after `"checkEmailDesc"`:

```json
"signIn": "כניסה",
"passwordLabel": "סיסמה",
"confirmPasswordLabel": "אימות סיסמה",
"setPasswordTitle": "יצירת סיסמה",
"setPasswordSubtitle": "בחר סיסמה לכניסה למערכת",
"setPasswordBtn": "קבע סיסמה",
"settingPassword": "שומר...",
"passwordMismatch": "הסיסמאות אינן תואמות",
"passwordTooShort": "הסיסמה חייבת להכיל 8–16 תווים",
"passwordTooWeak": "הסיסמה חייבת לעמוד בלפחות 3 כללי מורכבות",
"rulesHeader": "הסיסמה חייבת לעמוד ב-3 מתוך 4:",
"ruleUppercase": "אות גדולה",
"ruleLowercase": "אות קטנה",
"ruleNumber": "ספרה",
"ruleSpecial": "תו מיוחד",
"passwordLength": "8–16 תווים"
```

Inside the `"admin"` object, add after `"saving"`:

```json
"resetPassword": "איפוס סיסמה",
"resetPasswordConfirm": "לאפס את סיסמת המשתמש? הוא יתנתק מיידית ויקבל מייל לאיפוס.",
"resetPasswordSent": "מייל לאיפוס סיסמה נשלח."
```

- [ ] **Step 3: Verify no JSON syntax errors**

```
node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/he.json','utf8')); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```
git add messages/en.json messages/he.json
git commit -m "feat: add i18n keys for password setup and admin reset"
```

---

## Task 5: `setPassword` server action

**Files:**
- Create: `lib/actions/auth.ts`

- [ ] **Step 1: Create the server action**

Create `lib/actions/auth.ts`:

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { validatePassword } from '@/lib/utils/password'

export async function setPassword(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const validation = validatePassword(password)
    if (!validation.lengthOk) return { success: false, error: 'passwordTooShort' }
    if (validation.rulesCount < 3) return { success: false, error: 'passwordTooWeak' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) return { success: false, error: updateError.message }

    const { error: dbError } = await supabase
      .from('users')
      .update({ password_set: true })
      .eq('id', user.id)
    if (dbError) return { success: false, error: dbError.message }

    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add lib/actions/auth.ts
git commit -m "feat: add setPassword server action with complexity validation"
```

---

## Task 6: Set-password page

**Files:**
- Create: `app/(auth)/login/set-password/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/(auth)/login/set-password/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add app/(auth)/login/set-password/page.tsx
git commit -m "feat: add set-password page with live complexity checklist"
```

---

## Task 7: Middleware carve-out for set-password

**Files:**
- Modify: `middleware.ts`

The middleware currently allows all `/login/*` paths through for unauthenticated users, and redirects all authenticated users away from `/login/*`. Both need adjusting for `/login/set-password`.

- [ ] **Step 1: Update middleware**

Replace the two auth redirect blocks in `middleware.ts` (currently lines 13–20):

```ts
// Not authenticated → send to login, except for /login/* (but not set-password)
if (!user && !pathname.startsWith('/login')) {
  return NextResponse.redirect(new URL('/login', request.url))
}

// Unauthenticated users must NOT reach set-password (they have no session)
if (!user && pathname === '/login/set-password') {
  return NextResponse.redirect(new URL('/login', request.url))
}

// Already authenticated → skip login pages, but NOT set-password (needs live session)
if (user && pathname.startsWith('/login') && pathname !== '/login/set-password') {
  return NextResponse.redirect(new URL('/timesheet/daily', request.url))
}
```

Full updated `middleware.ts`:

```ts
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

  // Already authenticated → skip login pages, but allow through to set-password
  if (user && pathname.startsWith('/login') && pathname !== '/login/set-password') {
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add middleware.ts
git commit -m "feat: allow authenticated users through to /login/set-password"
```

---

## Task 8: Update auth callback route

**Files:**
- Modify: `app/auth/callback/route.ts`

The callback now needs to: (a) check `password_set` after session creation, and (b) handle `token_hash` from Supabase recovery emails in addition to the existing `code` (PKCE) param.

- [ ] **Step 1: Replace the callback route**

Overwrite `app/auth/callback/route.ts`:

```ts
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
    if (!err) user = data.user
  } else if (tokenHash && type) {
    const { data, error: err } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!err) user = data.user ?? null
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add app/auth/callback/route.ts
git commit -m "feat: route callback to set-password when password_set is false"
```

---

## Task 9: Update login page to email + password

**Files:**
- Modify: `app/(auth)/login/page.tsx`

Replace the magic-link OTP form with an email + password form using `signInWithPassword`.

- [ ] **Step 1: Replace the login page**

Overwrite `app/(auth)/login/page.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations, useLocale } from 'next-intl'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(searchParams.get('error') ?? '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

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

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('passwordLabel')}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('loggingIn') : t('signIn')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add app/(auth)/login/page.tsx
git commit -m "feat: replace magic-link login with email and password form"
```

---

## Task 10: Remove OTP page

**Files:**
- Delete: `app/(auth)/login/otp/page.tsx`

- [ ] **Step 1: Delete the OTP page**

```
git rm "app/(auth)/login/otp/page.tsx"
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors (nothing should be importing this page)

- [ ] **Step 3: Commit**

```
git commit -m "feat: remove unused OTP entry page"
```

---

## Task 11: `resetUserPassword` admin action

**Files:**
- Modify: `lib/actions/admin.ts`

**Environment variable required:** `NEXT_PUBLIC_SITE_URL` must be set to the app's public URL (e.g. `https://yourapp.vercel.app` in production, `http://localhost:3000` in dev). Add it to `.env.local` and Vercel environment variables.

- [ ] **Step 1: Add the action to `lib/actions/admin.ts`**

At the bottom of `lib/actions/admin.ts`, append:

```ts
export async function resetUserPassword(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdmin()
    const serviceClient = createServiceClient()

    // Fetch the user's email (needed for generateLink)
    const { data: profile, error: profileError } = await serviceClient
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()
    if (profileError || !profile) return { success: false, error: 'User not found' }

    // Mark password as unset so the callback routes them to set-password
    const { error: updateError } = await serviceClient
      .from('users')
      .update({ password_set: false })
      .eq('id', userId)
    if (updateError) return { success: false, error: updateError.message }

    // Revoke all active sessions for the user immediately
    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${userId}/logout`,
      {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    )

    // Send recovery email — link goes through /auth/callback which will
    // detect password_set=false and redirect to /login/set-password
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const { error: linkError } = await serviceClient.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
      options: { redirectTo: `${siteUrl}/auth/callback` },
    })
    if (linkError) return { success: false, error: linkError.message }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add lib/actions/admin.ts
git commit -m "feat: add resetUserPassword admin action"
```

---

## Task 12: `ResetPasswordButton` client component

**Files:**
- Create: `components/admin/ResetPasswordButton.tsx`

Follows the same pattern as the existing `ToggleProjectButton.tsx`.

- [ ] **Step 1: Create the component**

Create `components/admin/ResetPasswordButton.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add components/admin/ResetPasswordButton.tsx
git commit -m "feat: add ResetPasswordButton admin component"
```

---

## Task 13: Add Reset Password button to admin user list

**Files:**
- Modify: `app/(admin)/admin/users/page.tsx`

- [ ] **Step 1: Import `ResetPasswordButton` and add to each row**

In `app/(admin)/admin/users/page.tsx`:

1. Add import at the top (after existing imports):
```tsx
import ResetPasswordButton from '@/components/admin/ResetPasswordButton'
```

2. Replace the actions `<td>` (currently lines 67–82) with:
```tsx
<td className="px-4 py-3 text-end">
  <div className="flex flex-col items-end gap-1">
    <div className="flex gap-3">
      <Link
        href={`/admin/users/${u.id}/edit`}
        className="text-sm text-blue-600 hover:underline"
      >
        ערוך
      </Link>
      <Link
        href={`/admin/users/${u.id}/assign-projects`}
        className="text-sm text-blue-600 hover:underline"
      >
        {t('assignProjects')}
      </Link>
    </div>
    <ResetPasswordButton userId={u.id} />
  </div>
</td>
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add app/(admin)/admin/users/page.tsx
git commit -m "feat: add reset password button to admin user list"
```

---

## Task 14: Add Reset Password section to user edit page

**Files:**
- Modify: `app/(admin)/admin/users/[id]/edit/page.tsx`

- [ ] **Step 1: Import `ResetPasswordButton` and add a danger section**

In `app/(admin)/admin/users/[id]/edit/page.tsx`:

1. Add import at the top (after existing imports):
```tsx
import ResetPasswordButton from '@/components/admin/ResetPasswordButton'
```

2. Replace the return statement:
```tsx
return (
  <div className="flex flex-col gap-4">
    <div className="flex items-center gap-3">
      <Link href="/admin/users" className="text-sm text-blue-600 hover:underline">
        ← {t('users')}
      </Link>
      <h1 className="text-2xl font-semibold text-gray-800">{t('editUser')}</h1>
    </div>
    <UserForm
      user={user}
      departments={departments ?? []}
      managers={(managers ?? []).filter(m => m.id !== id)}
    />
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="mb-2 text-sm font-semibold text-red-800">{t('resetPassword')}</p>
      <ResetPasswordButton userId={id} />
    </div>
  </div>
)
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run all tests**

```
npx vitest run
```

Expected: all tests pass (the new password tests plus any existing ones)

- [ ] **Step 4: Commit**

```
git add app/(admin)/admin/users/[id]/edit/page.tsx
git commit -m "feat: add reset password section to user edit page"
```

---

## Post-implementation checklist

- [ ] Set `NEXT_PUBLIC_SITE_URL` in `.env.local` (e.g. `http://localhost:3000`) and in Vercel environment variables (production URL)
- [ ] In Supabase dashboard → Authentication → Email Templates → verify the **Recovery** email template is enabled and its link uses `{{ .ConfirmationURL }}`
- [ ] Manual test — invite flow: create a new user via admin → receive invite email → click link → land on set-password → set password → log in with email+password
- [ ] Manual test — login: go to `/login` → enter email + password → land on `/timesheet/daily`
- [ ] Manual test — admin reset: admin clicks Reset Password on a user → confirm dialog → user gets email → user clicks link → lands on set-password → sets new password
- [ ] Manual test — session invalidation: have user logged in on one tab → admin resets → verify user's session is revoked (refresh existing tab → redirected to login)
