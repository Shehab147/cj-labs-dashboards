'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/authContext'
import { getLocalizedUrl } from '@/utils/i18n'
import type { Locale } from '@/configs/i18n'

export default function DashboardRedirectPage() {
  const router = useRouter()
  const { lang } = useParams()
  const { isLoading, isAdmin, isEngineer } = useAuth()

  useEffect(() => {
    if (isLoading) return
    const dest = isAdmin ? '/admin/dashboard' : isEngineer ? '/engineer/dashboard' : '/login'

    router.replace(getLocalizedUrl(dest, (lang as Locale) || 'ar'))
  }, [isLoading, isAdmin, isEngineer, router, lang])

  return (
    <div className='flex items-center justify-center min-h-[50vh]'>
      <div className='animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary'></div>
    </div>
  )
}
