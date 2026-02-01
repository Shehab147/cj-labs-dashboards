'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { authApi, setToken, removeToken, getStoredAdmin, setStoredAdmin } from '@/services/api'
import type { Admin, AdminRole } from '@/types/xstation'
import { getLocalizedUrl } from '@/utils/i18n'
import type { Locale } from '@/configs/i18n'

interface AuthContextType {
  admin: Admin | null
  isLoading: boolean
  isAuthenticated: boolean
  isSuperadmin: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
  logout: () => Promise<void>
  validateSession: () => Promise<boolean>
  updateProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as Locale) || 'en'

  const isAuthenticated = !!admin
  const isSuperadmin = admin?.role === 'superadmin'

  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      const storedAdmin = getStoredAdmin()
      if (!storedAdmin) {
        setIsLoading(false)
        return false
      }

      const response = await authApi.validateSession()
      if (response.status === 'success' && response.data?.valid) {
        setAdmin(response.data.admin)
        setStoredAdmin(response.data.admin)
        setIsLoading(false)
        return true
      } else {
        removeToken()
        setAdmin(null)
        setIsLoading(false)
        return false
      }
    } catch (error) {
      console.error('Session validation error:', error)
      removeToken()
      setAdmin(null)
      setIsLoading(false)
      return false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true)
      const response = await authApi.login(email, password)
      
      if (response.status === 'success' && response.data) {
        setToken(response.data.token)
        setStoredAdmin(response.data.admin)
        setAdmin(response.data.admin)
        setIsLoading(false)
        return { success: true }
      } else {
        setIsLoading(false)
        return { success: false, message: response.message || 'Login failed' }
      }
    } catch (error) {
      console.error('Login error:', error)
      setIsLoading(false)
      return { success: false, message: 'Network error occurred' }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      removeToken()
      setAdmin(null)
      router.push(getLocalizedUrl('/login', locale))
    }
  }, [router, locale])

  const updateProfile = useCallback(async () => {
    try {
      const response = await authApi.getProfile()
      if (response.status === 'success' && response.data) {
        setAdmin(response.data)
        setStoredAdmin(response.data)
      }
    } catch (error) {
      console.error('Profile update error:', error)
    }
  }, [])

  useEffect(() => {
    validateSession()
  }, [validateSession])

  return (
    <AuthContext.Provider
      value={{
        admin,
        isLoading,
        isAuthenticated,
        isSuperadmin,
        login,
        logout,
        validateSession,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// HOC for protecting routes
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: { requireSuperadmin?: boolean }
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isSuperadmin, isLoading } = useAuth()
    const router = useRouter()
    const { lang } = useParams()
    const locale = (lang as Locale) || 'en'

    useEffect(() => {
      if (!isLoading) {
        if (!isAuthenticated) {
          router.push(getLocalizedUrl('/login', locale))
        } else if (options?.requireSuperadmin && !isSuperadmin) {
          router.push(getLocalizedUrl('/dashboard', locale))
        }
      }
    }, [isAuthenticated, isSuperadmin, isLoading, router, locale])

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )
    }

    if (!isAuthenticated) {
      return null
    }

    if (options?.requireSuperadmin && !isSuperadmin) {
      return null
    }

    return <WrappedComponent {...props} />
  }
}
