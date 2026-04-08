import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { i18n } from '@/configs/i18n'
import type { Locale } from '@/configs/i18n'

const COOKIE_NAME = 'NEXT_LOCALE'

function getLocale(request: NextRequest): Locale {
  // Check cookie first
  const cookieLocale = request.cookies.get(COOKIE_NAME)?.value as Locale | undefined
  if (cookieLocale && i18n.locales.includes(cookieLocale)) {
    return cookieLocale
  }

  // Check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language')
  if (acceptLanguage) {
    const preferredLocale = acceptLanguage
      .split(',')
      .map(lang => lang.split(';')[0].trim().substring(0, 2))
      .find(lang => i18n.locales.includes(lang as Locale)) as Locale | undefined
    
    if (preferredLocale) {
      return preferredLocale
    }
  }

  return i18n.defaultLocale
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // files with extensions
  ) {
    return NextResponse.next()
  }

  // Check if pathname has a valid locale
  const pathnameHasLocale = i18n.locales.some(
    locale => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) {
    // Extract locale from pathname and set cookie
    const localeFromPath = pathname.split('/')[1] as Locale
    const response = NextResponse.next()
    
    // Set cookie to remember the language preference
    response.cookies.set(COOKIE_NAME, localeFromPath, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax'
    })
    
    return response
  }

  // Redirect to locale-prefixed path
  const locale = getLocale(request)
  const newUrl = new URL(`/${locale}${pathname}`, request.url)
  newUrl.search = request.nextUrl.search

  const response = NextResponse.redirect(newUrl)
  
  // Set cookie
  response.cookies.set(COOKIE_NAME, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax'
  })

  return response
}

export const config = {
  matcher: [
    // Skip all internal paths (_next, api, static, etc.)
    '/((?!_next|api|static|.*\\..*).*)',
  ],
}
