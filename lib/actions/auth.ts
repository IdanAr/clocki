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
