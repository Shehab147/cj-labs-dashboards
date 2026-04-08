type SearchData = {
  id: string
  nameKey: string
  url: string
  excludeLang?: boolean
  icon: string
  sectionKey: string
  shortcut?: string
}

const data: SearchData[] = [
  // Main
  {
    id: '1',
    nameKey: 'dashboard',
    url: '/dashboard',
    icon: 'tabler-smart-home',
    sectionKey: 'main',
    shortcut: '⌘ D'
  },
  {
    id: '2',
    nameKey: 'frontDesk',
    url: '/front-desk',
    icon: 'tabler-device-desktop',
    sectionKey: 'main'
  },
  // Room Management
  {
    id: '3',
    nameKey: 'roomsList',
    url: '/rooms/list',
    icon: 'tabler-list',
    sectionKey: 'roomManagement'
  },
  {
    id: '4',
    nameKey: 'roomsStatus',
    url: '/rooms/status',
    icon: 'tabler-chart-dots',
    sectionKey: 'roomManagement'
  },
  {
    id: '5',
    nameKey: 'bookings',
    url: '/bookings',
    icon: 'tabler-calendar-event',
    sectionKey: 'roomManagement'
  },
  // Customer & Orders
  {
    id: '6',
    nameKey: 'customers',
    url: '/customers',
    icon: 'tabler-users',
    sectionKey: 'customerOrders'
  },
  {
    id: '7',
    nameKey: 'cafeteria',
    url: '/cafeteria',
    icon: 'tabler-coffee',
    sectionKey: 'customerOrders'
  },
  {
    id: '8',
    nameKey: 'orders',
    url: '/orders',
    icon: 'tabler-receipt',
    sectionKey: 'customerOrders'
  },
  // Management (Superadmin)
  {
    id: '9',
    nameKey: 'analytics',
    url: '/analytics',
    icon: 'tabler-chart-bar',
    sectionKey: 'management'
  },
  {
    id: '10',
    nameKey: 'admins',
    url: '/admins',
    icon: 'tabler-user-cog',
    sectionKey: 'management'
  }
]

export default data
