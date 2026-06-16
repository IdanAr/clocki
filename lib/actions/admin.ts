'use server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')
  return { supabase, user }
}

// ── PROJECTS ──────────────────────────────────────────────────────────────────

const ProjectSchema = z.object({
  name_he: z.string().min(1, 'שם בעברית נדרש'),
  name_en: z.string().min(1, 'שם באנגלית נדרש'),
  code: z.string().min(1, 'קוד נדרש'),
  billing_type: z.enum(['billable', 'internal']),
  is_active: z.boolean(),
})

export async function createProject(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await assertAdmin()
    const parsed = ProjectSchema.safeParse({
      name_he: formData.get('name_he'),
      name_en: formData.get('name_en'),
      code: formData.get('code'),
      billing_type: formData.get('billing_type'),
      is_active: formData.get('is_active') === 'true',
    })
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    const { error } = await supabase.from('projects').insert({ ...parsed.data, created_by: user.id })
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/projects')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function updateProject(id: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await assertAdmin()
    const parsed = ProjectSchema.safeParse({
      name_he: formData.get('name_he'),
      name_en: formData.get('name_en'),
      code: formData.get('code'),
      billing_type: formData.get('billing_type'),
      is_active: formData.get('is_active') === 'true',
    })
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    const { error } = await supabase.from('projects').update(parsed.data).eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/projects')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function toggleProjectActive(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await assertAdmin()
    const { error } = await supabase.from('projects').update({ is_active: isActive }).eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/projects')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

// ── USERS ─────────────────────────────────────────────────────────────────────

const UserUpdateSchema = z.object({
  full_name_he: z.string().min(1, 'שם בעברית נדרש'),
  full_name_en: z.string().min(1, 'שם באנגלית נדרש'),
  employee_number: z.string().nullable(),
  role: z.enum(['employee', 'manager', 'admin']),
  department_id: z.string().nullable(),
  manager_id: z.string().nullable(),
})

export async function inviteUser(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdmin()
    const email = (formData.get('email') as string | null)?.trim()
    if (!email) return { success: false, error: 'Email is required' }
    const serviceClient = createServiceClient()
    const { error } = await serviceClient.auth.admin.inviteUserByEmail(email)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function updateUser(id: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await assertAdmin()
    const parsed = UserUpdateSchema.safeParse({
      full_name_he: formData.get('full_name_he'),
      full_name_en: formData.get('full_name_en'),
      employee_number: (formData.get('employee_number') as string) || null,
      role: formData.get('role'),
      department_id: (formData.get('department_id') as string) || null,
      manager_id: (formData.get('manager_id') as string) || null,
    })
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    const { error } = await supabase.from('users').update(parsed.data).eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/users')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function assignProjects(userId: string, projectIds: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await assertAdmin()
    const { error: delError } = await supabase.from('user_projects').delete().eq('user_id', userId)
    if (delError) return { success: false, error: delError.message }
    if (projectIds.length > 0) {
      const { error: insError } = await supabase.from('user_projects').insert(
        projectIds.map(pid => ({ user_id: userId, project_id: pid, assigned_by: user.id }))
      )
      if (insError) return { success: false, error: insError.message }
    }
    revalidatePath(`/admin/users/${userId}/assign-projects`)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

// ── DEPARTMENTS ───────────────────────────────────────────────────────────────

const DeptSchema = z.object({
  name_he: z.string().min(1, 'שם בעברית נדרש'),
  name_en: z.string().min(1, 'שם באנגלית נדרש'),
  manager_id: z.string().nullable(),
})

export async function createDepartment(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await assertAdmin()
    const parsed = DeptSchema.safeParse({
      name_he: formData.get('name_he'),
      name_en: formData.get('name_en'),
      manager_id: (formData.get('manager_id') as string) || null,
    })
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    const { error } = await supabase.from('departments').insert(parsed.data)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/departments')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function updateDepartment(id: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await assertAdmin()
    const parsed = DeptSchema.safeParse({
      name_he: formData.get('name_he'),
      name_en: formData.get('name_en'),
      manager_id: (formData.get('manager_id') as string) || null,
    })
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    const { error } = await supabase.from('departments').update(parsed.data).eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/departments')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

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

    // Revoke all active sessions for the user immediately
    const logoutRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${userId}/logout`,
      {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    )
    if (!logoutRes.ok) {
      return { success: false, error: 'Failed to revoke user sessions' }
    }

    // Mark password as unset so the callback routes them to set-password
    const { error: updateError } = await serviceClient
      .from('users')
      .update({ password_set: false })
      .eq('id', userId)
    if (updateError) return { success: false, error: updateError.message }

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
