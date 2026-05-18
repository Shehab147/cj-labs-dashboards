// Type Imports
import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { getDictionary } from '@/utils/getDictionary'

const verticalMenuData = (
  dictionary: Awaited<ReturnType<typeof getDictionary>>,
  params: { isAdmin?: boolean; isSuperAdmin?: boolean; isEngineer?: boolean }
): VerticalMenuDataType[] => {
  const { isAdmin = false, isSuperAdmin = false, isEngineer = false } = params
  const nav = dictionary['navigation']
  const items: VerticalMenuDataType[] = []

  if (isAdmin) {
    items.push(
      { label: nav.dashboard, icon: 'tabler-smart-home', href: '/admin/dashboard' },
      { label: nav.requests, icon: 'tabler-clipboard-list', href: '/admin/requests' },
      { label: nav.engineers, icon: 'tabler-tool', href: '/admin/engineers' },
      { label: nav.geoZones, icon: 'tabler-map-pin', href: '/admin/zones' }
    )

    if (isSuperAdmin) {
      items.push(
        { label: nav.admins, icon: 'tabler-shield-lock', href: '/admin/admins' },
        { label: nav.auditLogs, icon: 'tabler-history', href: '/admin/logs' }
      )
    }
  }

  if (isEngineer) {
    items.push(
      { label: nav.dashboard, icon: 'tabler-smart-home', href: '/engineer/dashboard' },
      { label: nav.myRequests, icon: 'tabler-clipboard-list', href: '/engineer/requests' }
    )
  }

  return items
}

export default verticalMenuData
