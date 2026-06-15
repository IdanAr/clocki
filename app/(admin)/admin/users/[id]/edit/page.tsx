import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import UserForm from '@/components/admin/UserForm'

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations('admin')
  const supabase = await createClient()

  const [{ data: user }, { data: departments }, { data: managers }] = await Promise.all([
    supabase.from('users').select('*').eq('id', id).single(),
    supabase.from('departments').select('id, name_he').order('name_he'),
    supabase.from('users').select('id, full_name_he').in('role', ['manager', 'admin']).order('full_name_he'),
  ])

  if (!user) notFound()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="text-sm text-blue-600 hover:underline">
          ← {t('users')}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-800">{t('editUser')}</h1>
      </div>
      <UserForm
        user={user}
        departments={departments ?? []}
        managers={(managers ?? []).filter(m => m.id !== id)}
      />
    </div>
  )
}
