'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Type Imports
import type { ChildrenType } from '@core/types'
import type { Locale } from '@configs/i18n'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'

const GuestOnlyRoute = ({ children, lang }: ChildrenType & { lang: Locale }) => {
  const router = useRouter()
  const [isGuest, setIsGuest] = useState<boolean | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const admin = localStorage.getItem('admin')

    if (token && admin) {
      // User is logged in, redirect to home page
      router.replace(getLocalizedUrl(themeConfig.homePageUrl, lang))
    } else {
      setIsGuest(true)
    }
  }, [router, lang])

  // Show nothing while checking
  if (isGuest === null) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary'></div>
      </div>
    )
  }

  return isGuest ? <>{children}</> : null
}

export default GuestOnlyRoute
