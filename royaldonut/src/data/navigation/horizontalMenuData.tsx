// Type Imports
import type { HorizontalMenuDataType } from '@/types/menuTypes'
import type { getDictionary } from '@/utils/getDictionary'

const horizontalMenuData = (
  dictionary: Awaited<ReturnType<typeof getDictionary>>,
  params: { isAdmin?: boolean; isCashier?: boolean; isKitchen?: boolean }
): HorizontalMenuDataType[] => {
  const { isAdmin = false, isCashier = false, isKitchen = false } = params
  const nav = dictionary['navigation']
  const menuItems: HorizontalMenuDataType[] = []

  if (isAdmin) {
    menuItems.push({
      label: nav.dashboard,
      icon: 'tabler-smart-home',
      href: '/dashboard'
    })
  }

  if (isAdmin || isCashier) {
    menuItems.push({
      label: nav.pos,
      icon: 'tabler-cash-register',
      href: '/pos'
    })
  }

  if (isAdmin) {
    menuItems.push(
      { label: nav.products, icon: 'tabler-cookie', href: '/products' },
      { label: nav.categories, icon: 'tabler-category', href: '/categories' }
    )
  }

  if (isAdmin || isCashier) {
    menuItems.push({ label: nav.orders, icon: 'tabler-receipt', href: '/orders' })
  }

  if (isAdmin || isKitchen) {
    menuItems.push({
      label: nav.kitchen,
      icon: 'tabler-chef-hat',
      children: [
        { label: nav.kitchenOrders, href: '/kitchen' },
        { label: nav.kitchenLogs, href: '/kitchen/logs' }
      ]
    })
  }

  if (isAdmin) {
    menuItems.push(
      {
        label: nav.analytics,
        icon: 'tabler-chart-bar',
        children: [
          { label: nav.overview, href: '/analytics' },
          { label: nav.salesAnalytics, href: '/analytics/sales' },
          { label: nav.topProducts, href: '/analytics/top-products' },
          { label: nav.cashierPerformance, href: '/analytics/cashier-performance' }
        ]
      },
      { label: nav.shifts, icon: 'tabler-clock', href: '/shifts' },
      { label: nav.users, icon: 'tabler-users', href: '/users' },
      { label: nav.inventory, icon: 'tabler-packages', href: '/inventory' },
      { label: nav.refunds, icon: 'tabler-receipt-refund', href: '/refunds' }
    )
  }

  return menuItems
}

export default horizontalMenuData
