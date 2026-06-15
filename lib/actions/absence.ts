'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const AbsenceSchema = z.object({
  type: z.enum(['sick', 'vacation', 'military', 'spouse_sick', 'parent_sick', 'child_sick', 'pregnancy_test']),
  date_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().min(0.5).max(744),
  notes: z.string().optional(),
})

export type AbsenceInput = z.infer<typeof AbsenceSchema>
export type AbsenceResult = { success: true } | { success: false; error: string }

export async function createAbsence(input: AbsenceInput): Promise<AbsenceResult> {
  const parsed = AbsenceSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.from('absences').insert({
    employee_id: user.id,
    type: parsed.data.type,
    date_start: parsed.data.date_start,
    date_end: parsed.data.date_end,
    hours: parsed.data.hours,
    notes: parsed.data.notes ?? null,
    document_url: null,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/absences')
  return { success: true }
}
