# Auth & Onboarding Flow — Design Spec
**Date:** 2026-06-16
**Scope:** Replace magic-link OTP login with email+password; add mandatory password-creation step for new users; add admin-initiated password reset.

---

## 1. Overview

The current login flow uses Supabase magic-link OTP exclusively. This spec replaces it with:

1. **Onboarding:** Admin invites user (unchanged) → user clicks OTP link → mandatory password-creation screen → email+password login from then on.
2. **Standard login:** Email + password form (replaces OTP entry).
3. **Admin reset:** Admin button (user list + user edit page) → invalidates session immediately → sends Supabase recovery email → user repeats password-creation step.

No self-service "Forgot password" — reset is admin-only.

---

## 2. Database Change

```sql
ALTER TABLE users ADD COLUMN password_set boolean NOT NULL DEFAULT false;
```

- `false` = user has never set a password (or admin has reset it).
- `true` = user has completed password creation.
- Existing users start as `false`; this only matters if an admin ever resets them — they will not be routed to the set-password screen on regular login.

---

## 3. Auth Flows

### 3.1 Initial Onboarding

1. Admin calls `inviteUserByEmail` (unchanged) → Supabase sends OTP email.
2. User clicks link → `/auth/callback` exchanges code for session.
3. Callback queries `users.password_set` for the authenticated user.
   - If `false` → redirect to `/login/set-password`.
   - If `true` → redirect to `/timesheet/daily` (normal flow).
4. User fills in password + confirm password on `/login/set-password`.
5. On submit: server validates complexity → `supabase.auth.updateUser({ password })` → set `users.password_set = true` → redirect to `/timesheet/daily`.

### 3.2 Standard Login

1. User opens `/login` — shows email + password fields.
2. Submit calls `supabase.auth.signInWithPassword({ email, password })`.
3. On success → redirect to `/timesheet/daily`.
4. On error → display Supabase error message inline (invalid credentials, etc.).
5. No "Forgot password" link on the login page.

### 3.3 Admin Password Reset

1. Admin clicks "Reset Password" on the user list row **or** user edit page.
2. Confirmation dialog shown before action runs.
3. Server action `resetUserPassword(userId)` (admin-only):
   a. Set `users.password_set = false` for the target user.
   b. Revoke all active sessions via `POST /auth/v1/admin/users/{userId}/logout` (service role key).
   c. Call `serviceClient.auth.admin.generateLink({ type: 'recovery', email })` to trigger the reset email.
4. User is logged out immediately (session revoked in step b).
5. User clicks recovery link → `/auth/callback` → `password_set = false` → `/login/set-password` → repeats onboarding flow.

---

## 4. Routes

| Route | Status | Notes |
|---|---|---|
| `/login` | Modified | Email + password form; `signInWithPassword` |
| `/login/otp` | Removed | No longer needed |
| `/login/set-password` | New | Password creation screen (onboarding + reset) |
| `/auth/callback` | Modified | After code exchange, check `password_set` and route accordingly |

---

## 5. New Page: `/login/set-password`

### UI
- Same card style as existing `/login` page (dark `#16213d` background, white card, Clocki logo).
- Two fields: **Password** and **Confirm password**, each with an eye-toggle for visibility.
- Live complexity checklist below the fields, updating as the user types.
- **Set password** button disabled until all conditions are met.
- Bilingual (he/en) with RTL/LTR support via `dir` attribute, matching existing auth pages.

### Password Requirements
- Length: 8–16 characters.
- Must satisfy **at least 3 of these 4** rules:
  - ≥1 uppercase letter `[A-Z]`
  - ≥1 lowercase letter `[a-z]`
  - ≥1 number `[0-9]`
  - ≥1 special character (e.g. `!@#$%^&*`)
- The checklist shows each rule as green (✓) or grey (○) in real time.
- Length indicator shows current character count alongside the 8–16 rule.

### Validation
- Client-side: live feedback in the checklist; button disabled until valid.
- Server-side: `setPassword` action re-validates length and complexity before calling Supabase. Never trust client-only validation.

### Access guard
- Accessible to **authenticated** users only (they need a live session to call `updateUser`).
- Unauthenticated visitors → redirect to `/login`.
- Middleware carve-out: authenticated users are **not** redirected away from `/login/set-password` (unlike other `/login/*` routes).

---

## 6. Server Actions

### `lib/actions/auth.ts` (new file)

```ts
setPassword(password: string): Promise<{ success: boolean; error?: string }>
```
- Validates length (8–16) and that ≥3 of 4 complexity rules pass.
- Calls `supabase.auth.updateUser({ password })`.
- On success: sets `users.password_set = true` for `auth.uid()`.
- Returns `{ success: true }` or `{ success: false, error }`.

### `lib/actions/admin.ts` (addition)

```ts
resetUserPassword(userId: string): Promise<{ success: boolean; error?: string }>
```
- Calls `assertAdmin()` guard.
- Fetches the target user's email from `users` table using `userId`.
- Sets `users.password_set = false` for `userId`.
- Calls Supabase Auth Admin REST endpoint to revoke all sessions for `userId`.
- Calls `serviceClient.auth.admin.generateLink({ type: 'recovery', email })` (using the fetched email) to send the reset email.
- Returns `{ success: true }` or `{ success: false, error }`.

---

## 7. Middleware Changes

Current behaviour: any authenticated user hitting `/login/*` is redirected to `/timesheet/daily`.

Two changes required:

1. Unauthenticated users hitting `/login/set-password` must be redirected to `/login` (currently all `/login/*` paths pass through for unauthenticated users, which would let them see the page despite having no session to call `updateUser`).
2. Authenticated users must **not** be redirected away from `/login/set-password` (unlike all other `/login/*` routes).

```ts
// Add before the existing unauthenticated guard:
if (!user && pathname === '/login/set-password') {
  return NextResponse.redirect(new URL('/login', request.url))
}

// Modify existing authenticated redirect:
// Current
if (user && pathname.startsWith('/login')) {
  return NextResponse.redirect(new URL('/timesheet/daily', request.url))
}
// New
if (user && pathname.startsWith('/login') && pathname !== '/login/set-password') {
  return NextResponse.redirect(new URL('/timesheet/daily', request.url))
}
```

---

## 8. i18n Additions

### `auth` namespace (both `en.json` and `he.json`)

| Key | EN | HE |
|---|---|---|
| `setPasswordTitle` | Create your password | צור סיסמה |
| `setPasswordSubtitle` | Choose a password to access Clocki | בחר סיסמה לכניסה למערכת |
| `passwordLabel` | Password | סיסמה |
| `confirmPasswordLabel` | Confirm password | אימות סיסמה |
| `setPasswordBtn` | Set password | קבע סיסמה |
| `settingPassword` | Saving... | שומר... |
| `passwordMismatch` | Passwords do not match | הסיסמאות אינן תואמות |
| `passwordTooShort` | Password must be 8–16 characters | הסיסמה חייבת להכיל 8–16 תווים |
| `passwordTooWeak` | Password must meet at least 3 complexity rules | הסיסמה חייבת לעמוד בלפחות 3 כללי מורכבות |
| `rulesHeader` | Password must satisfy 3 of 4: | הסיסמה חייבת לעמוד ב-3 מתוך 4: |
| `ruleUppercase` | Uppercase letter | אות גדולה |
| `ruleLowercase` | Lowercase letter | אות קטנה |
| `ruleNumber` | Number | ספרה |
| `ruleSpecial` | Special character | תו מיוחד |
| `passwordLength` | 8–16 characters | 8–16 תווים |

### `admin` namespace (both `en.json` and `he.json`)

| Key | EN | HE |
|---|---|---|
| `resetPassword` | Reset Password | איפוס סיסמה |
| `resetPasswordConfirm` | Reset this user's password? They will be logged out and receive a reset email. | לאפס את סיסמת המשתמש? הוא יתנתק ויקבל מייל לאיפוס. |
| `resetPasswordSent` | Password reset email sent. | מייל לאיפוס סיסמה נשלח. |

---

## 9. Files Changed / Created

| File | Action |
|---|---|
| `app/(auth)/login/page.tsx` | Modified — email+password form |
| `app/(auth)/login/otp/page.tsx` | Deleted |
| `app/(auth)/login/set-password/page.tsx` | Created |
| `app/auth/callback/route.ts` | Modified — check `password_set` after code exchange |
| `lib/actions/auth.ts` | Created — `setPassword` action |
| `lib/actions/admin.ts` | Modified — add `resetUserPassword` action |
| `middleware.ts` | Modified — carve-out for `/login/set-password` |
| `messages/en.json` | Modified — new `auth` and `admin` keys |
| `messages/he.json` | Modified — new `auth` and `admin` keys |
| `app/(admin)/admin/users/page.tsx` | Modified — add Reset Password button per row |
| `app/(admin)/admin/users/[id]/edit/page.tsx` | Modified — add Reset Password button |

---

## 10. Out of Scope

- Self-service "Forgot password" — admin reset only.
- Password change by the user themselves post-onboarding (v2 if needed).
- Session invalidation of other devices on password creation (only admin-reset revokes sessions).
