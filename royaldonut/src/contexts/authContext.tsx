'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { authApi } from '@/services/api'
import { getLocalizedUrl } from '@/utils/i18n'
import type { Locale } from '@/configs/i18n'

interface User {
  id: number
  full_name: string
  username: string
  role: 'cashier' | 'kitchen' | 'super_admin'
}

// Keep Admin alias for backward compat with views that use admin.name etc.
interface Admin {
  id: number
  name: string
  username: string
  role: 'cashier' | 'kitchen' | 'super_admin' | 'admin'
}

interface AuthContextType {
  admin: Admin | null
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  isCashier: boolean
  isKitchen: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>
  logout: () => Promise<void>
  validateSession: () => Promise<boolean>
  updateProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function userToAdmin(user: User): Admin {
  return {
    id: user.id,
    name: user.full_name,
    username: user.username,
    role: user.role === 'super_admin' ? 'admin' : user.role,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as Locale) || 'ar'

  const isAuthenticated = !!user
  const isAdmin = user?.role === 'super_admin'
  const isCashier = user?.role === 'cashier'
  const isKitchen = user?.role === 'kitchen'

  // Derived admin object for backward compat
  const admin = user ? userToAdmin(user) : null

  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      const response = await authApi.getProfile()
      if (response.status === 'success' && response.data?.user) {
        setUser(response.data.user)
        setIsLoading(false)
        return true
      } else {
        setUser(null)
        setIsLoading(false)
        return false
      }
    } catch {
      setUser(null)
      setIsLoading(false)
      return false
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    try {
      setIsLoading(true)
      const response = await authApi.login(username, password)

      if (response.status === 'success' && response.data?.user) {
        setUser(response.data.user)
        setIsLoading(false)
        return { success: true }
      } else {
        setIsLoading(false)
        return { success: false, message: response.message || 'اسم المستخدم أو كلمة المرور غير صحيحة' }
      }
    } catch {
      setIsLoading(false)
      return { success: false, message: 'خطأ في الاتصال بالشبكة' }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore
    } finally {
      setUser(null)
      router.push(getLocalizedUrl('/login', locale))
    }
  }, [router, locale])

  const updateProfile = useCallback(async () => {
    try {
      const response = await authApi.getProfile()
      if (response.status === 'success' && response.data?.user) {
        setUser(response.data.user)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    validateSession()
  }, [validateSession])

  return (
    <AuthContext.Provider
      value={{
        admin,
        user,
        isLoading,
        isAuthenticated,
        isAdmin,
        isCashier,
        isKitchen,
        login,
        logout,
        validateSession,
        updateProfile,
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
  options?: { requireAdmin?: boolean }
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isAdmin, isLoading } = useAuth()
    const router = useRouter()
    const { lang } = useParams()
    const locale = (lang as Locale) || 'ar'

    useEffect(() => {
      if (!isLoading) {
        if (!isAuthenticated) {
          router.push(getLocalizedUrl('/login', locale))
        } else if (options?.requireAdmin && !isAdmin) {
          router.push(getLocalizedUrl('/dashboard', locale))
        }
      }
    }, [isAuthenticated, isAdmin, isLoading, router, locale])

    if (isLoading) {
      return (
        <div className='flex items-center justify-center min-h-screen'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary'></div>
        </div>
      )
    }

    if (!isAuthenticated) return null
    if (options?.requireAdmin && !isAdmin) return null

    return <WrappedComponent {...props} />
  }
}
