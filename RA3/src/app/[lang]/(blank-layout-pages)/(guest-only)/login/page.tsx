// Next Imports
import type { Metadata } from 'next'

// Type Imports
import type { Locale } from '@configs/i18n'

// Component Imports
import Login from '@views/Login'

// Config Imports
import { i18n } from '@configs/i18n'

// Server Action Imports
import { getServerMode } from '@core/utils/serverHelpers'

// Util Imports
import { getDictionary } from '@/utils/getDictionary'

export const metadata: Metadata = {
  title: 'Login',
  description: 'Login to your account'
}

type Props = {
  params: Promise<{ lang: string }>
}

const LoginPage = async ({ params }: Props) => {
  const { lang } = await params
  
  // Type guard to ensure lang is a valid Locale
  const locale: Locale = i18n.locales.includes(lang as Locale) ? (lang as Locale) : i18n.defaultLocale
  
  // Vars
  const mode = await getServerMode()
  const dictionary = await getDictionary(locale)

  return <Login mode={mode} dictionary={dictionary} />
}

export default LoginPage
