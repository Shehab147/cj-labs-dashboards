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
    nameKey: 'pos',
    url: '/pos',
    icon: 'tabler-cash-register',
    sectionKey: 'main'
  },

  // Shop Management
  {
    id: '3',
    nameKey: 'products',
    url: '/products',
    icon: 'tabler-cookie',
    sectionKey: 'shopManagement'
  },
  {
    id: '4',
    nameKey: 'categories',
    url: '/categories',
    icon: 'tabler-category',
    sectionKey: 'shopManagement'
  },

  // Order Management
  {
    id: '6',
    nameKey: 'orders',
    url: '/orders',
    icon: 'tabler-receipt',
    sectionKey: 'orderManagement'
  },
  {
    id: '7',
    nameKey: 'kitchenOrders',
    url: '/kitchen',
    icon: 'tabler-chef-hat',
    sectionKey: 'orderManagement'
  },
  {
    id: '8',
    nameKey: 'kitchenLogs',
    url: '/kitchen/logs',
    icon: 'tabler-file-text',
    sectionKey: 'orderManagement'
  },

  // Analytics
  {
    id: '9',
    nameKey: 'analytics',
    url: '/analytics',
    icon: 'tabler-chart-bar',
    sectionKey: 'management'
  },
  {
    id: '10',
    nameKey: 'salesAnalytics',
    url: '/analytics/sales',
    icon: 'tabler-chart-line',
    sectionKey: 'management'
  },
  {
    id: '11',
    nameKey: 'topProducts',
    url: '/analytics/top-products',
    icon: 'tabler-star',
    sectionKey: 'management'
  },
  {
    id: '12',
    nameKey: 'cashierPerformance',
    url: '/analytics/cashier-performance',
    icon: 'tabler-user-check',
    sectionKey: 'management'
  },

  // Management
  {
    id: '13',
    nameKey: 'shifts',
    url: '/shifts',
    icon: 'tabler-clock',
    sectionKey: 'management'
  },
  {
    id: '14',
    nameKey: 'users',
    url: '/users',
    icon: 'tabler-users',
    sectionKey: 'management'
  },
  {
    id: '15',
    nameKey: 'inventory',
    url: '/inventory',
    icon: 'tabler-packages',
    sectionKey: 'management'
  },
  {
    id: '16',
    nameKey: 'refunds',
    url: '/refunds',
    icon: 'tabler-receipt-refund',
    sectionKey: 'management'
  }
]

export default data
