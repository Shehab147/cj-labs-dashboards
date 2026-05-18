// SS Maintenance API Service
// Base: https://Solarsector.net/api/maintenance/engineers-ap/proc.php
// Auth: HttpOnly cookie ('token') set by server on login. All requests must use credentials.

import type {
  AdminAccount,
  AdminDashboardData,
  AdminRole,
  AuditLogEntry,
  EngineerAccount,
  EngineerDashboardData,
  ExperienceLevel,
  GeoZone,
  MaintenanceRequest,
  MaintenanceRequestDetails,
  RequestStatus,
} from '@/types/maintenance'

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  // Default to same-origin proxy (configured in next.config.ts rewrites)
  // to avoid browser CORS preflight failures against the upstream API.
  (typeof window !== 'undefined' ? '/maintenance-api' : 'https://Solarsector.net/api/maintenance/engineers-ap/proc.php')

export interface ApiResponse<T = any> {
  status: 'success' | 'error'
  data?: T
  message?: string
}

type HttpMethod = 'GET' | 'POST'

async function apiCall<T = any>(
  action: string,
  method: HttpMethod,
  body?: Record<string, any>,
  query?: Record<string, string | number | undefined | null>,
): Promise<ApiResponse<T>> {
  try {
    const isAbsolute = /^https?:\/\//i.test(BASE_URL)
    const url = isAbsolute
      ? new URL(BASE_URL)
      : new URL(BASE_URL, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')

    url.searchParams.set('action', action)

    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== '') {
          url.searchParams.set(k, String(v))
        }
      }
    }

    const target = isAbsolute ? url.toString() : `${url.pathname}${url.search}`

    const res = await fetch(target, {
      method,
      credentials: 'include',
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    })

    let json: any = null

    try {
      json = await res.json()
    } catch {
      // empty / non-json body
    }

    if (res.ok && json && json.success === true) {
      const { success, message, ...rest } = json

      void success

      return { status: 'success', data: rest as T, message }
    }

    return {
      status: 'error',
      message:
        (json && (json.message || json.error)) ||
        `HTTP ${res.status}: ${res.statusText || 'Request failed'}`,
    }
  } catch (err) {
    // Network-level failure (offline, DNS, CORS). Use console.warn so it does
    // not trigger the Next.js dev error overlay; the caller still receives a
    // typed error response and can display its own message.
    if (typeof console !== 'undefined') console.warn(`[API] ${action} failed:`, err)

    return { status: 'error', message: 'خطأ في الاتصال بالشبكة' }
  }
}

const get = <T = any>(action: string, query?: Record<string, any>) =>
  apiCall<T>(action, 'GET', undefined, query)
const post = <T = any>(action: string, body?: Record<string, any>) =>
  apiCall<T>(action, 'POST', body)

// ==================== ADMIN AUTH ====================

export const adminAuthApi = {
  login: (email: string, password: string) =>
    post<{ admin: AdminAccount; token?: string }>('admin_login', { email, password }),
  logout: () => post('admin_logout'),
  me: () => get<{ admin: AdminAccount }>('admin_me'),
}

// ==================== ENGINEER AUTH ====================

export const engineerAuthApi = {
  login: (phone: string, password: string) =>
    post<{ engineer: EngineerAccount; token?: string }>('engineer_login', { phone, password }),
  logout: () => post('engineer_logout'),
  me: () => get<{ engineer: EngineerAccount }>('engineer_me'),
}

// ==================== GEO ZONES ====================

export const geoZoneApi = {
  list: () => get<{ zones: GeoZone[] }>('get_geo_zones'),
  create: (data: { name: string; description?: string }) => post('create_geo_zone', data),
  update: (data: { id: number; name: string; description?: string }) =>
    post('update_geo_zone', data),
  delete: (id: number) => post('delete_geo_zone', { id }),
}

// ==================== ADMINS (super_admin only) ====================

export const adminApi = {
  list: () => get<{ admins: AdminAccount[] }>('get_admins'),
  create: (data: { name: string; email: string; password: string; role?: AdminRole }) =>
    post('create_admin', data),
  update: (data: {
    id: number
    name?: string
    email?: string
    role?: AdminRole
    password?: string
  }) => post('update_admin', data),
  toggleStatus: (id: number) => post('toggle_admin_status', { id }),
}

// ==================== ENGINEERS (admin) ====================

export const engineerApi = {
  list: (filters?: { zone_id?: number; status?: 'active' | 'inactive' | 'all' }) =>
    get<{ engineers: EngineerAccount[] }>('get_engineers', filters),
  get: (id: number) => get<{ engineer: EngineerAccount }>('get_engineer', { id }),
  create: (data: {
    full_name: string
    phone: string
    password: string
    geo_zone_id: number
    experience_level?: ExperienceLevel
    id_card_url?: string
    bio?: string
  }) => post('create_engineer', data),
  update: (data: {
    id: number
    full_name?: string
    phone?: string
    geo_zone_id?: number
    experience_level?: ExperienceLevel
    id_card_url?: string
    bio?: string
    password?: string
  }) => post('update_engineer', data),
  toggleStatus: (id: number) => post('toggle_engineer_status', { id }),
}

// ==================== REQUESTS — ADMIN ====================

export const adminRequestApi = {
  create: (data: {
    customer_name: string
    customer_phone: string
    full_address: string
    geo_zone_id: number
    summary: string
    full_description?: string
  }) => post('create_request', data),

  list: (filters?: {
    status?: RequestStatus | ''
    zone_id?: number
    engineer_id?: number
    from?: string
    to?: string
  }) => get<{ requests: MaintenanceRequest[] }>('get_requests', filters),

  get: (id: number) => get<{ request: MaintenanceRequestDetails }>('get_request', { id }),

  setPriceRange: (data: {
    id: number
    price_range_from: number
    price_range_to: number
    admin_notes?: string
  }) => post('set_price_range', data),

  markAccepted: (id: number) => post('mark_request_accepted', { id }),
  markRejected: (id: number, comment?: string) =>
    post('mark_request_rejected', { id, comment }),
  reassignEngineer: (id: number, engineer_id?: number) =>
    post('reassign_engineer', { id, engineer_id }),
  cancel: (id: number, comment?: string) => post('cancel_request', { id, comment }),
  updateAdminNotes: (id: number, admin_notes: string) =>
    post('update_admin_notes', { id, admin_notes }),

  addFile: (data: { request_id: number; file_type: string; url: string }) =>
    post('add_request_file', data),
  deleteFile: (id: number) => post('delete_request_file', { id }),
}

// ==================== REQUESTS — ENGINEER ====================

export const engineerRequestApi = {
  myRequests: (status?: RequestStatus | '') =>
    get<{ requests: MaintenanceRequest[] }>('engineer_my_requests', { status }),
  details: (id: number) =>
    get<{ request: MaintenanceRequestDetails }>('engineer_request_details', { id }),
  updateStatus: (data: {
    id: number
    status: RequestStatus
    comment?: string
    final_price?: number
  }) => post('engineer_update_status', data),
  addNotes: (id: number, note: string) => post('engineer_add_notes', { id, note }),
}

// ==================== DASHBOARDS & LOGS ====================

export const dashboardApi = {
  admin: () => get<AdminDashboardData>('admin_dashboard'),
  engineer: () => get<EngineerDashboardData>('engineer_dashboard'),
}

export const logsApi = {
  admin: (limit = 100) => get<{ logs: AuditLogEntry[] }>('get_admin_logs', { limit }),
  engineer: (params?: { engineer_id?: number; limit?: number }) =>
    get<{ logs: AuditLogEntry[] }>('get_engineer_logs', params),
}

const apiService = {
  adminAuth: adminAuthApi,
  engineerAuth: engineerAuthApi,
  geoZone: geoZoneApi,
  admin: adminApi,
  engineer: engineerApi,
  adminRequest: adminRequestApi,
  engineerRequest: engineerRequestApi,
  dashboard: dashboardApi,
  logs: logsApi,
}

export default apiService
