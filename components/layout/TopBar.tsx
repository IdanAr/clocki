import { createClient } from '@/lib/supabase/server'
import LanguageToggle from './LanguageToggle'
import LogoutButton from './LogoutButton'

export default async function TopBar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let displayName = user?.email ?? ''
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('full_name_he, full_name_en')
      .eq('id', user.id)
      .single()
    if (profile) displayName = profile.full_name_he || profile.full_name_en || displayName
  }

  return (
    <header className="flex h-12 items-center justify-between border-b border-gray-200 bg-white px-4">
      <div />
      <div className="flex items-center gap-3">
        <LanguageToggle />
        <span className="text-sm text-gray-600">{displayName}</span>
        <LogoutButton />
      </div>
    </header>
  )
}
