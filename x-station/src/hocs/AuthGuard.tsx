'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// Type Imports
import type { Locale } from '@configs/i18n'
import type { ChildrenType } from '@core/types'

// Hook Imports
import { useAuth } from '@/contexts/authContext'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'

export default function AuthGuard({ children, locale }: ChildrenType & { locale: Locale }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // User is not authenticated, redirect to login with return URL
      router.replace(getLocalizedUrl(`/login?redirectTo=${pathname}`, locale))
    }
  }, [isAuthenticated, isLoading, router, pathname, locale])

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary'></div>
      </div>
    )
  }

  // Show content only if authenticated
  return isAuthenticated ? <>{children}</> : null
}
