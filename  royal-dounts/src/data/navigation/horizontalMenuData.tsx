// Type Imports
import type { HorizontalMenuDataType } from '@/types/menuTypes'
import type { getDictionary } from '@/utils/getDictionary'

const horizontalMenuData = (
  dictionary: Awaited<ReturnType<typeof getDictionary>>,
  isSuperadmin: boolean = false
): HorizontalMenuDataType[] => {
  const menuItems: HorizontalMenuDataType[] = [
    {
      label: dictionary['navigation'].dashboard,
      icon: 'tabler-smart-home',
      href: '/dashboard'
    },
    {
      label: dictionary['navigation'].frontDesk,
      icon: 'tabler-device-desktop',
      href: '/front-desk'
    },
    {
      label: dictionary['navigation'].rooms,
      icon: 'tabler-door',
      children: [
        {
          label: dictionary['navigation'].roomsList,
          href: '/rooms/list'
        },
        {
          label: dictionary['navigation'].roomsStatus,
          href: '/rooms/status'
        }
      ]
    },
    {
      label: dictionary['navigation'].bookings,
      icon: 'tabler-calendar-event',
      children: [
        {
          label: dictionary['navigation'].activeBookings,
          href: '/bookings/active'
        },
        {
          label: dictionary['navigation'].allBookings,
          href: '/bookings/list'
        }
      ]
    },
    {
      label: dictionary['navigation'].customers,
      icon: 'tabler-users',
      href: '/customers'
    },
    {
      label: dictionary['navigation'].cafeteria,
      icon: 'tabler-coffee',
      children: [
        {
          label: dictionary['navigation'].items,
          href: '/cafeteria/items'
        },
        {
          label: dictionary['navigation'].lowStock,
          href: '/cafeteria/low-stock'
        }
      ]
    },
    {
      label: dictionary['navigation'].orders,
      icon: 'tabler-shopping-cart',
      children: [
        {
          label: dictionary['navigation'].newOrder,
          href: '/orders/new'
        },
        {
          label: dictionary['navigation'].allOrders,
          href: '/orders/list'
        }
      ]
    }
  ]

  if (isSuperadmin) {
    menuItems.push(
      {
        label: dictionary['navigation'].analytics,
        icon: 'tabler-chart-pie',
        children: [
          {
            label: dictionary['navigation'].overview,
            href: '/analytics/overview'
          },
          {
            label: dictionary['navigation'].revenue,
            href: '/analytics/revenue'
          },
          {
            label: dictionary['navigation'].roomAnalytics,
            href: '/analytics/rooms'
          },
          {
            label: dictionary['navigation'].cafeteriaAnalytics,
            href: '/analytics/cafeteria'
          },
          {
            label: dictionary['navigation'].staffAnalytics,
            href: '/analytics/staff'
          }
        ]
      },
      {
        label: dictionary['navigation'].admins,
        icon: 'tabler-user-shield',
        children: [
          {
            label: dictionary['navigation'].adminsList,
            href: '/admins/list'
          },
          {
            label: dictionary['navigation'].attendance,
            href: '/admins/attendance'
          }
        ]
      }
    )
  }

  return menuItems
}

export default horizontalMenuData
