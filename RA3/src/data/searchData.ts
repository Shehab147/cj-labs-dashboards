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
  { id: 'a1', nameKey: 'dashboard', url: '/admin/dashboard', icon: 'tabler-smart-home', sectionKey: 'main' },
  { id: 'a2', nameKey: 'requests', url: '/admin/requests', icon: 'tabler-clipboard-list', sectionKey: 'operations' },
  { id: 'a3', nameKey: 'engineers', url: '/admin/engineers', icon: 'tabler-tool', sectionKey: 'operations' },
  { id: 'a4', nameKey: 'geoZones', url: '/admin/zones', icon: 'tabler-map-pin', sectionKey: 'operations' },
  { id: 'a5', nameKey: 'admins', url: '/admin/admins', icon: 'tabler-shield-lock', sectionKey: 'management' },
  { id: 'a6', nameKey: 'auditLogs', url: '/admin/logs', icon: 'tabler-history', sectionKey: 'management' },
  { id: 'e1', nameKey: 'dashboard', url: '/engineer/dashboard', icon: 'tabler-smart-home', sectionKey: 'main' },
  { id: 'e2', nameKey: 'myRequests', url: '/engineer/requests', icon: 'tabler-clipboard-list', sectionKey: 'main' }
]

export default data
