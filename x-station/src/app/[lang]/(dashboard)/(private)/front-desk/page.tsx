// Type Imports
import type { Locale } from '@configs/i18n'

// Config Imports
import { i18n } from '@configs/i18n'

// Util Imports
import { getDictionary } from '@/utils/getDictionary'

// View Imports
import { FrontDesk } from '@views/xstation/frontdesk'

const FrontDeskPage = async (props: { params: Promise<{ lang: string }> }) => {
  const params = await props.params
  const lang: Locale = i18n.locales.includes(params.lang as Locale) ? (params.lang as Locale) : i18n.defaultLocale
  const dictionary = await getDictionary(lang)

  return <FrontDesk dictionary={dictionary} />
}

export default FrontDeskPage
