'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const VacationSchema = z.object({
  date_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['periodic', 'continuous']),
  employee_notes: z.string().optional(),
})

export type VacationInput = z.infer<typeof VacationSchema>
export type VacationResult = { success: true } | { success: false; error: string }

export async function createVacationRequest(input: VacationInput): Promise<VacationResult> {
  const parsed = VacationSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.from('vacation_requests').insert({
    employee_id: user.id,
    date_start: parsed.data.date_start,
    date_end: parsed.data.date_end,
    type: parsed.data.type,
    status: 'pending',
    employee_notes: parsed.data.employee_notes ?? null,
    manager_notes: null,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/vacation/requests')
  return { success: true }
}
