import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DeptForm from '@/components/admin/DeptForm'

export default async function EditDepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations('admin')
  const supabase = await createClient()

  const [{ data: dept }, { data: managers }] = await Promise.all([
    supabase.from('departments').select('*').eq('id', id).single(),
    supabase.from('users').select('id, full_name_he').in('role', ['manager', 'admin']).order('full_name_he'),
  ])

  if (!dept) notFound()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/departments" className="text-sm text-blue-600 hover:underline">
          ← {t('departments')}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-800">{t('editDepartment')}</h1>
      </div>
      <DeptForm dept={dept} managers={managers ?? []} />
    </div>
  )
}
