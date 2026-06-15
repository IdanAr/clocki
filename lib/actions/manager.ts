'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function assertManagerOf(supabase: Awaited<ReturnType<typeof createClient>>, timesheetId: string, userId: string) {
  const { data: ts } = await supabase
    .from('timesheets')
    .select('employee_id, status')
    .eq('id', timesheetId)
    .single()

  if (!ts) throw new Error('Timesheet not found')

  const { data: emp } = await supabase
    .from('users')
    .select('manager_id')
    .eq('id', ts.employee_id)
    .single()

  if (!emp || emp.manager_id !== userId) throw new Error('Forbidden')
  return ts
}

export async function approveTimesheet(timesheetId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  try {
    const ts = await assertManagerOf(supabase, timesheetId, user.id)
    if (ts.status !== 'submitted') return { success: false, error: 'Timesheet is not in submitted state' }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Forbidden' }
  }

  const { error } = await supabase
    .from('timesheets')
    .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', timesheetId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/manager/approvals')
  return { success: true }
}

export async function rejectTimesheet(timesheetId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  try {
    const ts = await assertManagerOf(supabase, timesheetId, user.id)
    if (ts.status !== 'submitted') return { success: false, error: 'Timesheet is not in submitted state' }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Forbidden' }
  }

  const { error } = await supabase
    .from('timesheets')
    .update({ status: 'rejected', approved_by: null, approved_at: null })
    .eq('id', timesheetId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/manager/approvals')
  return { success: true }
}

export async function saveManagerEntryNote(entryId: string, note: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: entry } = await supabase
    .from('timesheet_entries')
    .select('timesheet_id')
    .eq('id', entryId)
    .single()

  if (!entry) return { success: false, error: 'Entry not found' }

  try {
    await assertManagerOf(supabase, entry.timesheet_id, user.id)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Forbidden' }
  }

  const { error } = await supabase
    .from('timesheet_entries')
    .update({ manager_notes: note || null })
    .eq('id', entryId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
