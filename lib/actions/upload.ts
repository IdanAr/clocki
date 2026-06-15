'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DocumentType } from '@/types/database'

export type SaveDocumentResult = { success: true } | { success: false; error: string }

export async function saveDocument(
  fileUrl: string,
  fileName: string,
  type: DocumentType,
  absenceId?: string
): Promise<SaveDocumentResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.from('documents').insert({
    employee_id: user.id,
    type,
    file_url: fileUrl,
    file_name: fileName,
    absence_id: absenceId ?? null,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/documents')
  return { success: true }
}
