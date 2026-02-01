'use client'

// Next Imports
import { redirect, usePathname } from 'next/navigation'

// Config Imports
import { i18n } from '@configs/i18n'
import type { Locale } from '@configs/i18n'

const LangRedirect = () => {
  const pathname = usePathname()

  // Try to get locale from cookie
  let locale = i18n.defaultLocale
  if (typeof document !== 'undefined') {
    const cookieLocale = document.cookie
      .split('; ')
      .find(row => row.startsWith('NEXT_LOCALE='))
      ?.split('=')[1] as Locale | undefined
    
    if (cookieLocale && i18n.locales.includes(cookieLocale)) {
      locale = cookieLocale
    }
  }

  const redirectUrl = `/${locale}${pathname}`

  redirect(redirectUrl)
}

export default LangRedirect
