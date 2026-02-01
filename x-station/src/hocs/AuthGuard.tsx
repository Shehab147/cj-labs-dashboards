'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// Type Imports
import type { Locale } from '@configs/i18n'
import type { ChildrenType } from '@core/types'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'

// Service Imports
import { authApi } from '@/services/api'

export default function AuthGuard({ children, locale }: ChildrenType & { locale: Locale }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('x-station-token')
      
      if (!token) {
        setIsAuthenticated(false)
        router.replace(getLocalizedUrl(`/login?redirectTo=${pathname}`, locale))
        return
      }

      try {
        const response = await authApi.validateSession()
        
        if (response.status === 'success') {
          setIsAuthenticated(true)
        } else {
          // Token invalid, clear storage and redirect
          localStorage.removeItem('x-station-token')
          localStorage.removeItem('x-station-admin')
          setIsAuthenticated(false)
          router.replace(getLocalizedUrl(`/login?redirectTo=${pathname}`, locale))
        }
      } catch (error) {
        // Network error, redirect to login for security
        console.error('Auth validation error:', error)
        localStorage.removeItem('x-station-token')
        localStorage.removeItem('x-station-admin')
        setIsAuthenticated(false)
        router.replace(getLocalizedUrl(`/login?redirectTo=${pathname}`, locale))
      }
    }

    checkAuth()

    // Listen for storage changes (e.g., logout in another tab or manual clearing)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'x-station-token' && !e.newValue) {
        setIsAuthenticated(false)
        router.replace(getLocalizedUrl('/login', locale))
      }
    }

    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [router, pathname, locale])

  // Show nothing while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary'></div>
      </div>
    )
  }

  return isAuthenticated ? <>{children}</> : null
}
