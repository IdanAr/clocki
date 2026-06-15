import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import DeptForm from '@/components/admin/DeptForm'

export default async function NewDepartmentPage() {
  const t = await getTranslations('admin')
  const supabase = await createClient()

  const { data: managers } = await supabase
    .from('users')
    .select('id, full_name_he')
    .in('role', ['manager', 'admin'])
    .order('full_name_he')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/departments" className="text-sm text-blue-600 hover:underline">
          ← {t('departments')}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-800">{t('newDepartment')}</h1>
      </div>
      <DeptForm managers={managers ?? []} />
    </div>
  )
}
