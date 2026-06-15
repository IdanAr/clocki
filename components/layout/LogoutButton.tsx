'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function LogoutButton() {
  const t = useTranslations('nav')
  const router = useRouter()

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={logout}
      className="text-sm text-gray-500 hover:text-gray-800"
    >
      {t('logout')}
    </button>
  )
}
