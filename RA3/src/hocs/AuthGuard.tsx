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
  const { isAuthenticated, isLoading, isAdmin, isEngineer } = useAuth()

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated) {
      router.replace(getLocalizedUrl(`/login?redirectTo=${pathname}`, locale))

      return
    }

    // Role-based section guard: keep each role inside their own area.
    // Strip the locale prefix to inspect the route segments.
    const localePrefix = `/${locale}`
    const path = pathname.startsWith(localePrefix) ? pathname.slice(localePrefix.length) || '/' : pathname

    if (path.startsWith('/admin') && !isAdmin) {
      router.replace(getLocalizedUrl('/engineer/dashboard', locale))
    } else if (path.startsWith('/engineer') && !isEngineer) {
      router.replace(getLocalizedUrl('/admin/dashboard', locale))
    }
  }, [isAuthenticated, isLoading, isAdmin, isEngineer, router, pathname, locale])

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
