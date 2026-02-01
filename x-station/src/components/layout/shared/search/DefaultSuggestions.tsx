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

type SuggestionItem = {
  labelKey: string
  href: string
  icon?: string
}

type SuggestionSection = {
  sectionKey: string
  items: SuggestionItem[]
}

const suggestionStructure: SuggestionSection[] = [
  {
    sectionKey: 'main',
    items: [
      { labelKey: 'dashboard', href: '/dashboard', icon: 'tabler-smart-home' },
      { labelKey: 'frontDesk', href: '/front-desk', icon: 'tabler-device-desktop' }
    ]
  },
  {
    sectionKey: 'roomManagement',
    items: [
      { labelKey: 'roomsList', href: '/rooms/list', icon: 'tabler-list' },
      { labelKey: 'roomsStatus', href: '/rooms/status', icon: 'tabler-chart-dots' },
      { labelKey: 'bookings', href: '/bookings', icon: 'tabler-calendar-event' }
    ]
  },
  {
    sectionKey: 'customerOrders',
    items: [
      { labelKey: 'customers', href: '/customers', icon: 'tabler-users' },
      { labelKey: 'cafeteria', href: '/cafeteria', icon: 'tabler-coffee' },
      { labelKey: 'orders', href: '/orders', icon: 'tabler-receipt' }
    ]
  },
  {
    sectionKey: 'management',
    items: [
      { labelKey: 'analytics', href: '/analytics', icon: 'tabler-chart-bar' },
      { labelKey: 'admins', href: '/admins', icon: 'tabler-user-cog' }
    ]
  }
]

const DefaultSuggestions = ({ setOpen }: { setOpen: (value: boolean) => void }) => {
  // Hooks
  const { lang: locale } = useParams()
  const currentLocale = (locale as Locale) || 'en'
  const dict = dictionaries[currentLocale] || dictionaries.en
  const nav = dict.navigation

  return (
    <div className='flex grow flex-wrap gap-x-[48px] gap-y-8 plb-14 pli-16 overflow-y-auto overflow-x-hidden bs-full'>
      {suggestionStructure.map((section, index) => (
        <div
          key={index}
          className='flex flex-col justify-center overflow-x-hidden gap-4 basis-full sm:basis-[calc((100%-3rem)/2)]'
        >
          <p className='text-xs leading-[1.16667] uppercase text-textDisabled tracking-[0.8px]'>
            {nav[section.sectionKey as keyof typeof nav] || section.sectionKey}
          </p>
          <ul className='flex flex-col gap-4'>
            {section.items.map((item, i) => (
              <li key={i} className='flex'>
                <Link
                  href={getLocalizedUrl(item.href, currentLocale)}
                  className='flex items-center overflow-x-hidden cursor-pointer gap-2 hover:text-primary focus-visible:text-primary focus-visible:outline-0'
                  onClick={() => setOpen(false)}
                >
                  {item.icon && <i className={classnames(item.icon, 'flex text-xl shrink-0')} />}
                  <p className='text-[15px] leading-[1.4667] truncate'>
                    {nav[item.labelKey as keyof typeof nav] || item.labelKey}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default DefaultSuggestions
