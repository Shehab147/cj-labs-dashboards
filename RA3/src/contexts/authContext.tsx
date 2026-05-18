'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useRouter, useParams } from 'next/navigation'

import { adminAuthApi, engineerAuthApi } from '@/services/api'
import { getLocalizedUrl } from '@/utils/i18n'
import type { Locale } from '@/configs/i18n'
import type { AdminAccount, EngineerAccount } from '@/types/maintenance'

export type SessionRole = 'admin' | 'engineer' | null

interface AuthContextType {
  admin: AdminAccount | null
  engineer: EngineerAccount | null
  role: SessionRole
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  isEngineer: boolean
  loginAdmin: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
  loginEngineer: (phone: string, password: string) => Promise<{ success: boolean; message?: string }>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminAccount | null>(null)
  const [engineer, setEngineer] = useState<EngineerAccount | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as Locale) || 'ar'

  const role: SessionRole = admin ? 'admin' : engineer ? 'engineer' : null
  const isAuthenticated = !!admin || !!engineer
  const isAdmin = !!admin
  const isSuperAdmin = admin?.role === 'super_admin'
  const isEngineer = !!engineer

  const refresh = useCallback(async () => {
    try {
      const a = await adminAuthApi.me()

      if (a.status === 'success' && a.data?.admin) {
        setAdmin(a.data.admin)
        setEngineer(null)
        setIsLoading(false)

        return
      }
    } catch {
      /* ignore */
    }

    try {
      const e = await engineerAuthApi.me()

      if (e.status === 'success' && e.data?.engineer) {
        setEngineer(e.data.engineer)
        setAdmin(null)
        setIsLoading(false)

        return
      }
    } catch {
      /* ignore */
    }

    setAdmin(null)
    setEngineer(null)
    setIsLoading(false)
  }, [])

  const loginAdmin = useCallback(async (email: string, password: string) => {
    setIsLoading(true)

    try {
      const res = await adminAuthApi.login(email, password)

      if (res.status === 'success' && res.data?.admin) {
        setAdmin(res.data.admin)
        setEngineer(null)
        setIsLoading(false)

        return { success: true }
      }

      setIsLoading(false)

      return { success: false, message: res.message || 'بيانات الدخول غير صحيحة' }
    } catch {
      setIsLoading(false)

      return { success: false, message: 'خطأ في الاتصال بالشبكة' }
    }
  }, [])

  const loginEngineer = useCallback(async (phone: string, password: string) => {
    setIsLoading(true)

    try {
      const res = await engineerAuthApi.login(phone, password)

      if (res.status === 'success' && res.data?.engineer) {
        setEngineer(res.data.engineer)
        setAdmin(null)
        setIsLoading(false)

        return { success: true }
      }

      setIsLoading(false)

      return { success: false, message: res.message || 'بيانات الدخول غير صحيحة' }
    } catch {
      setIsLoading(false)

      return { success: false, message: 'خطأ في الاتصال بالشبكة' }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      if (admin) await adminAuthApi.logout()
      else if (engineer) await engineerAuthApi.logout()
    } catch {
      /* ignore */
    } finally {
      setAdmin(null)
      setEngineer(null)
      router.push(getLocalizedUrl('/login', locale))
    }
  }, [admin, engineer, router, locale])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <AuthContext.Provider
      value={{
        admin,
        engineer,
        role,
        isLoading,
        isAuthenticated,
        isAdmin,
        isSuperAdmin,
        isEngineer,
        loginAdmin,
        loginEngineer,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)

  if (!ctx) throw new Error('useAuth must be used within AuthProvider')

  return ctx
}
