import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'

export default async function ProfilePage() {
  const t = await getTranslations('profile')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*, departments(name_he, name_en)')
    .eq('id', user.id)
    .single()

  const { data: manager } = profile?.manager_id
    ? await supabase
        .from('users')
        .select('full_name_he, full_name_en, email')
        .eq('id', profile.manager_id)
        .single()
    : { data: null }

  const dept = profile?.departments as unknown as { name_he: string; name_en: string } | null

  const rows = [
    { label: t('fullNameHe'), value: profile?.full_name_he || '—' },
    { label: t('fullNameEn'), value: profile?.full_name_en || '—' },
    { label: t('employeeNumber'), value: profile?.employee_number || '—' },
    { label: t('email'), value: user.email ?? '—' },
    { label: t('role'), value: profile?.role ? t(`roles.${profile.role}`) : '—' },
    { label: t('department'), value: dept?.name_he || dept?.name_en || '—' },
    { label: t('manager'), value: manager?.full_name_he || manager?.full_name_en || manager?.email || '—' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-800">{t('title')}</h1>

      <div className="max-w-lg overflow-hidden rounded-lg border border-gray-200 bg-white">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex border-b border-gray-100 last:border-0">
            <div className="w-44 flex-shrink-0 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
              {label}
            </div>
            <div className="flex-1 px-4 py-3 text-sm text-gray-800">{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
