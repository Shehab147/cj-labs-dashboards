// Type Imports
import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { getDictionary } from '@/utils/getDictionary'

const verticalMenuData = (
  dictionary: Awaited<ReturnType<typeof getDictionary>>,
  isSuperadmin: boolean = false
): VerticalMenuDataType[] => {
  const menuItems: VerticalMenuDataType[] = [
    // Dashboard
    {
      label: dictionary['navigation'].dashboard,
      icon: 'tabler-smart-home',
      href: '/dashboard'
    },
    // Front Desk
    {
      label: dictionary['navigation'].frontDesk,
      icon: 'tabler-device-desktop',
      href: '/front-desk'
    },
    // Rooms Section
    {
      label: dictionary['navigation'].rooms,
      icon: 'tabler-door',
      children: [
        {
          label: dictionary['navigation'].roomsList,
          icon: 'tabler-list',
          href: '/rooms/list'
        },
        {
          label: dictionary['navigation'].roomsStatus,
          icon: 'tabler-activity',
          href: '/rooms/status'
        }
      ]
    },
    // Bookings Section
    {
      label: dictionary['navigation'].bookings,
      icon: 'tabler-calendar-event',
      children: [
        {
          label: dictionary['navigation'].activeBookings,
          icon: 'tabler-player-play',
          href: '/bookings/active'
        },
        {
          label: dictionary['navigation'].allBookings,
          icon: 'tabler-list',
          href: '/bookings/list'
        },
        {
          label: dictionary['navigation'].todaysBookings,
          icon: 'tabler-calendar-time',
          href: '/bookings/today'
        }
      ]
    },
    // Customers Section
    {
      label: dictionary['navigation'].customers,
      icon: 'tabler-users',
      href: '/customers'
    },
    // Cafeteria Section
    {
      label: dictionary['navigation'].cafeteria,
      icon: 'tabler-coffee',
      children: [
        {
          label: dictionary['navigation'].items,
          icon: 'tabler-package',
          href: '/cafeteria/items'
        },
        {
          label: dictionary['navigation'].lowStock,
          icon: 'tabler-alert-triangle',
          href: '/cafeteria/low-stock'
        }
      ]
    },
    // Orders Section
    {
      label: dictionary['navigation'].orders,
      icon: 'tabler-shopping-cart',
      children: [
        {
          label: dictionary['navigation'].newOrder,
          icon: 'tabler-plus',
          href: '/orders/new'
        },
        {
          label: dictionary['navigation'].allOrders,
          icon: 'tabler-list',
          href: '/orders/list'
        },
        {
          label: dictionary['navigation'].todaysOrders,
          icon: 'tabler-calendar-time',
          href: '/orders/today'
        }
      ]
    }
  ]

  // Superadmin-only sections
  if (isSuperadmin) {
    menuItems.push(
      // Analytics Section
      {
        label: dictionary['navigation'].analytics,
        isSection: true,
        children: [
          {
            label: dictionary['navigation'].overview,
            icon: 'tabler-chart-pie',
            href: '/analytics/overview'
          },
          {
            label: dictionary['navigation'].revenue,
            icon: 'tabler-currency-dollar',
            href: '/analytics/revenue'
          },
          {
            label: dictionary['navigation'].roomAnalytics,
            icon: 'tabler-door',
            href: '/analytics/rooms'
          },
          {
            label: dictionary['navigation'].cafeteriaAnalytics,
            icon: 'tabler-coffee',
            href: '/analytics/cafeteria'
          },
          {
            label: dictionary['navigation'].customerAnalytics,
            icon: 'tabler-users',
            href: '/analytics/customers'
          },
          {
            label: dictionary['navigation'].staffAnalytics,
            icon: 'tabler-user-check',
            href: '/analytics/staff'
          }
        ]
      },
      // Administration Section
      {
        label: dictionary['navigation'].administration,
        isSection: true,
        children: [
          {
            label: dictionary['navigation'].adminsList,
            icon: 'tabler-user-shield',
            href: '/admins/list'
          },
          {
            label: dictionary['navigation'].attendance,
            icon: 'tabler-clock-check',
            href: '/admins/attendance'
          }
        ]
      }
    )
  }

  // Settings (for all users)
  menuItems.push({
    label: dictionary['navigation'].settings,
    icon: 'tabler-settings',
    href: '/settings'
  })

  return menuItems
}

export default verticalMenuData
