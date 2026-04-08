// Type Imports
import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { getDictionary } from '@/utils/getDictionary'

const verticalMenuData = (
  dictionary: Awaited<ReturnType<typeof getDictionary>>,
  params: { isAdmin?: boolean; isCashier?: boolean; isKitchen?: boolean }
): VerticalMenuDataType[] => {
  const { isAdmin = false, isCashier = false, isKitchen = false } = params
  const nav = dictionary['navigation']
  const menuItems: VerticalMenuDataType[] = []

  // Dashboard - admin only
  if (isAdmin) {
    menuItems.push({
      label: nav.dashboard,
      icon: 'tabler-smart-home',
      href: '/dashboard'
    })
  }

  // POS - admin & cashier
  if (isAdmin || isCashier) {
    menuItems.push({
      label: nav.pos,
      icon: 'tabler-cash-register',
      href: '/pos'
    })
  }

  // Shop Management - admin
  if (isAdmin) {
    menuItems.push(
      {
        label: nav.products,
        icon: 'tabler-cookie',
        href: '/products'
      },
      {
        label: nav.categories,
        icon: 'tabler-category',
        href: '/categories'
      },
      {
        label: nav.tables,
        icon: 'tabler-armchair',
        href: '/tables'
      }
    )
  }

  // Orders - admin & cashier
  if (isAdmin || isCashier) {
    menuItems.push({
      label: nav.orders,
      icon: 'tabler-receipt',
      href: '/orders'
    })
  }

  // Kitchen - admin & kitchen
  if (isAdmin || isKitchen) {
    menuItems.push({
      label: nav.kitchen,
      icon: 'tabler-chef-hat',
      children: [
        {
          label: nav.kitchenOrders,
          icon: 'tabler-list-check',
          href: '/kitchen'
        },
        {
          label: nav.kitchenLogs,
          icon: 'tabler-file-text',
          href: '/kitchen/logs'
        }
      ]
    })
  }

  // Analytics - admin only
  if (isAdmin) {
    menuItems.push({
      label: nav.analytics,
      icon: 'tabler-chart-bar',
      children: [
        {
          label: nav.overview,
          icon: 'tabler-chart-pie',
          href: '/analytics'
        },
        {
          label: nav.salesAnalytics,
          icon: 'tabler-chart-line',
          href: '/analytics/sales'
        },
        {
          label: nav.topProducts,
          icon: 'tabler-star',
          href: '/analytics/top-products'
        },
        {
          label: nav.cashierPerformance,
          icon: 'tabler-user-check',
          href: '/analytics/cashier-performance'
        }
      ]
    })
  }

  // Management - admin only
  if (isAdmin) {
    menuItems.push(
      {
        label: nav.shifts,
        icon: 'tabler-clock',
        href: '/shifts'
      },
      {
        label: nav.users,
        icon: 'tabler-users',
        href: '/users'
      },
      {
        label: nav.inventory,
        icon: 'tabler-packages',
        href: '/inventory'
      },
      {
        label: nav.refunds,
        icon: 'tabler-receipt-refund',
        href: '/refunds'
      }
    )
  }

  return menuItems
}

export default verticalMenuData
