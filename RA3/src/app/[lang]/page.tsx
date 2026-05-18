import { redirect } from 'next/navigation'

import { i18n } from '@configs/i18n'
import type { Locale } from '@configs/i18n'

type Props = {
  params: Promise<{ lang: string }>
}

export default async function RootPage({ params }: Props) {
  const { lang } = await params
  const locale: Locale = i18n.locales.includes(lang as Locale) ? (lang as Locale) : i18n.defaultLocale

  redirect(`/${locale}/dashboard`)
}
