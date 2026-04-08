// Next Imports
import Link from 'next/link'
import { useParams } from 'next/navigation'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { Locale } from '@configs/i18n'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'

// Data Imports
import enDict from '@/data/dictionaries/en.json'
import arDict from '@/data/dictionaries/ar.json'

const dictionaries = { en: enDict, ar: arDict }

type NoResultData = {
  labelKey: string
  href: string
  icon: string
}

const noResultData: NoResultData[] = [
  {
    labelKey: 'dashboard',
    href: '/dashboard',
    icon: 'tabler-smart-home'
  },
  {
    labelKey: 'bookings',
    href: '/bookings',
    icon: 'tabler-calendar-event'
  },
  {
    labelKey: 'customers',
    href: '/customers',
    icon: 'tabler-users'
  }
]

const NoResult = ({ searchValue, setOpen }: { searchValue: string; setOpen: (value: boolean) => void }) => {
  // Hooks
  const { lang: locale } = useParams()
  const currentLocale = (locale as Locale) || 'en'
  const dict = dictionaries[currentLocale] || dictionaries.en
  const nav = dict.navigation
  const t = dict.search

  return (
    <div className='flex items-center justify-center grow flex-wrap plb-14 pli-16 overflow-y-auto overflow-x-hidden bs-full'>
      <div className='flex flex-col items-center'>
        <i className='tabler-file-alert text-[64px] mbe-2.5' />
        <p className='text-lg font-medium leading-[1.55556] mbe-11'>{`${t.noResults} "${searchValue}"`}</p>
        <p className='text-[15px] leading-[1.4667] mbe-4 text-textDisabled'>{t.tryDifferent}</p>
        <ul className='flex flex-col self-start gap-[18px]'>
          {noResultData.map((item, index) => (
            <li key={index} className='flex items-center'>
              <Link
                href={getLocalizedUrl(item.href, currentLocale)}
                className='flex items-center gap-2 hover:text-primary focus-visible:text-primary focus-visible:outline-0'
                onClick={() => setOpen(false)}
              >
                <i className={classnames(item.icon, 'text-xl shrink-0')} />
                <p className='text-[15px] leading-[1.4667] truncate'>
                  {nav[item.labelKey as keyof typeof nav] || item.labelKey}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default NoResult
