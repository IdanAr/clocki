'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type EntryInput = {
  work_date: string
  project_id: string
  hours: number
  employee_notes?: string | null
}

export async function getOrCreateTimesheet(periodStart: string, periodEnd: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: existing } = await supabase
    .from('timesheets')
    .select('*')
    .eq('employee_id', user.id)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .maybeSingle()

  if (existing) return existing

  const { data, error } = await supabase
    .from('timesheets')
    .insert({
      employee_id: user.id,
      period_start: periodStart,
      period_end: periodEnd,
      status: 'draft' as const,
      approved_by: null,
      approved_at: null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function saveEntries(timesheetId: string, entries: EntryInput[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: ts } = await supabase
    .from('timesheets')
    .select('employee_id, status')
    .eq('id', timesheetId)
    .single()

  if (!ts || ts.employee_id !== user.id || ts.status !== 'draft') {
    throw new Error('Cannot edit this timesheet')
  }

  const { error: delError } = await supabase
    .from('timesheet_entries')
    .delete()
    .eq('timesheet_id', timesheetId)

  if (delError) throw new Error(delError.message)

  if (entries.length > 0) {
    const { error: insError } = await supabase
      .from('timesheet_entries')
      .insert(
        entries.map(e => ({
          timesheet_id: timesheetId,
          project_id: e.project_id,
          work_date: e.work_date,
          hours: e.hours,
          employee_notes: e.employee_notes ?? null,
          manager_notes: null,
        }))
      )
    if (insError) throw new Error(insError.message)
  }

  revalidatePath('/timesheet/daily')
}

export async function updateEntryNotes(entryId: string, employeeNotes: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: entry } = await supabase
    .from('timesheet_entries')
    .select('id, timesheet_id')
    .eq('id', entryId)
    .single()

  if (!entry) throw new Error('Entry not found')

  const { data: ts } = await supabase
    .from('timesheets')
    .select('employee_id')
    .eq('id', entry.timesheet_id)
    .single()

  if (!ts || ts.employee_id !== user.id) throw new Error('Forbidden')

  const { error } = await supabase
    .from('timesheet_entries')
    .update({ employee_notes: employeeNotes })
    .eq('id', entryId)

  if (error) throw new Error(error.message)
  revalidatePath('/timesheet/daily')
}

export async function submitTimesheet(timesheetId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('timesheets')
    .update({ status: 'submitted' })
    .eq('id', timesheetId)
    .eq('employee_id', user.id)
    .eq('status', 'draft')

  if (error) throw new Error(error.message)
  revalidatePath('/timesheet/daily')
  revalidatePath('/timesheet/periodic')
}
