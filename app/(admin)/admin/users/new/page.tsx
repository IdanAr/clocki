import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import InviteUserForm from '@/components/admin/InviteUserForm'

export default async function NewUserPage() {
  const t = await getTranslations('admin')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="text-sm text-blue-600 hover:underline">
          ← {t('users')}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-800">{t('newUser')}</h1>
      </div>
      <InviteUserForm />
    </div>
  )
}
