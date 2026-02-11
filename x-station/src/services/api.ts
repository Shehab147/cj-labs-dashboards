// X-Station API Service
// Base URL for the API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://x-station-api.labs.cloudjet.org/processor.php'

// Get token from localStorage (client-side only)
const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('x-station-token')
    return token && token !== 'undefined' && token !== 'null' ? token : null
  }
  return null
}

// Export getToken for use in other files
export { getToken }

// Set token in localStorage
export const setToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    if (token && token !== 'undefined' && token !== 'null') {
      localStorage.setItem('x-station-token', token)
      console.log('Token saved to localStorage')
    } else {
      console.error('Invalid token provided to setToken:', token)
      removeToken()
    }
  }
}

// Remove token from localStorage
export const removeToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('x-station-token')
    localStorage.removeItem('x-station-admin')
    console.log('Token and admin data removed from localStorage')
  }
}

// Get stored admin info
export const getStoredAdmin = () => {
  if (typeof window !== 'undefined') {
    try {
      const admin = localStorage.getItem('x-station-admin')
      if (!admin || admin === 'undefined' || admin === 'null') {
        return null
      }
      return JSON.parse(admin)
    } catch (error) {
      console.error('Error parsing stored admin data:', error)
      return null
    }
  }
  return null
}

// Set admin info
export const setStoredAdmin = (admin: any): void => {
  if (typeof window !== 'undefined') {
    if (admin && typeof admin === 'object') {
      localStorage.setItem('x-station-admin', JSON.stringify(admin))
      console.log('Admin data saved to localStorage')
    } else {
      console.error('Invalid admin data provided to setStoredAdmin:', admin)
    }
  }
}

// API Response Types
export interface ApiResponse<T = any> {
  status: 'success' | 'error'
  data?: T
  message?: string
}

// Generic API call function
async function apiCall<T = any>(
  action: string,
  body?: Record<string, any>,
  options?: {
    isFormData?: boolean
    requiresAuth?: boolean
  }
): Promise<ApiResponse<T>> {
  const { isFormData = false, requiresAuth = true } = options || {}
  
  const headers: HeadersInit = {}
  
  if (requiresAuth) {
    const token = getToken()
    if (!token) {
      // If token is required but not available, return error
      console.warn(`[API] ${action} requires authentication but no token found`)
      return {
        status: 'error',
        message: 'Authentication required. Please log in again.'
      }
    }
    headers['X-Authorization'] = `Bearer ${token}`
  }
  
  let requestBody: BodyInit | undefined
  
  if (isFormData && body) {
    const formData = new FormData()
    Object.entries(body).forEach(([key, value]) => {
      if (value instanceof File) {
        formData.append(key, value)
      } else if (value !== undefined && value !== null) {
        formData.append(key, String(value))
      }
    })
    requestBody = formData
  } else if (body && Object.keys(body).length >= 0) {
    headers['Content-Type'] = 'application/json'
    requestBody = JSON.stringify(body)
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}?action=${action}`, {
      method: 'POST',
      headers,
      body: requestBody
    })
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error(`[API] ${action} failed:`, error)
    return {
      status: 'error',
      message: 'Network error occurred. Please try again.'
    }
  }
}

// ==================== AUTHENTICATION ====================

export const authApi = {
  login: (email: string, password: string) =>
    apiCall('login', { email, password }, { requiresAuth: false }),
  
  logout: () => apiCall('logout'),
  
  validateSession: () => apiCall('validateSession'),
  
  getProfile: () => apiCall('getProfile'),
  
  updateProfile: (data: { name?: string; email?: string }) =>
    apiCall('updateProfile', data),
  
  updatePassword: (currentPassword: string, newPassword: string) =>
    apiCall('updatePassword', { current_password: currentPassword, new_password: newPassword })
}

// ==================== ADMIN MANAGEMENT (Superadmin Only) ====================

export const adminApi = {
  add: (data: { name: string; email: string; password: string; role: string }) =>
    apiCall('addAdmin', data),
  
  create: (data: { name: string; email: string; password: string; role: string }) =>
    apiCall('addAdmin', data),
  
  list: () => apiCall('listAdmins'),
  
  getAll: () => apiCall('listAdmins'),
  
  update: (id: number, data: { name?: string; email?: string; role?: string; is_active?: boolean }) =>
    apiCall('updateAdmin', { id, ...data }),
  
  delete: (id: number) => apiCall('deleteAdmin', { id }),
  
  getAttendance: () => apiCall('adminAttendance'),
  
  resetPassword: (id: number, password: string) =>
    apiCall('updateAdmin', { id, password })
}

// ==================== CUSTOMER MANAGEMENT ====================

export const customerApi = {
  add: (data: { name: string; phone: string }) =>
    apiCall('addcustomer', data),
  
  create: (data: { name: string; phone: string; email?: string }) =>
    apiCall('addcustomer', data),
  
  list: () => apiCall('listcustomers'),
  
  getAll: () => apiCall('listcustomers'),
  
  get: (id: number) => apiCall('getCustomer', { id }),
  
  update: (customerId: number, data: { name?: string; email?: string; phone?: string }) =>
    apiCall('updatecustomer', { id: customerId, ...data }),
  
  delete: (id: number) => apiCall('deletecustomer', { id }),
  
  search: (query: string) => apiCall('searchCustomers', { query }),
  
  findByPhone: (phone: string) => apiCall('findCustomerByPhone', { phone }),
  
  getLoyaltyInfo: (customerId: number) => apiCall('getCustomerLoyaltyInfo', { customer_id: customerId })
}

// ==================== ROOM MANAGEMENT ====================

export const roomApi = {
  add: (data: { name: string; ps: string; hour_cost: number; capacity: number }) =>
    apiCall('addRoom', data),
  
  list: () => apiCall('listRooms'),
  
  get: (id: number) => apiCall('getRoom', { id }),
  
  update: (data: { id: number; name?: string; ps?: string; hour_cost?: number; capacity?: number }) =>
    apiCall('updateRoom', data),
  
  delete: (id: number) => apiCall('deleteRoom', { id }),
  
  getAvailable: () => apiCall('getAvailableRooms'),
  
  getStatus: () => apiCall('getRoomsStatus')
}

// ==================== ROOM BOOKINGS ====================

export const bookingApi = {
  add: (data: { customer_id: number; room_id: number; started_at?: string; finished_at?: string }) =>
    apiCall('addBooking', data),
  
  end: (bookingId: number) => apiCall('endBooking', { booking_id: bookingId }),
  
  list: () => apiCall('listBookings'),
  
  getAll: () => apiCall('getBookings'),
  
  getActive: () => apiCall('getActiveBookings'),
  
  get: (id: number) => apiCall('getBooking', { id }),
  
  cancel: (id: number) => apiCall('cancelBooking', { id }),
  
  delete: (bookingId: number) => apiCall('deleteBooking', { booking_id: bookingId }),
  
  quickStart: (data: { 
    room_id: number; 
    customer_phone: string; 
    customer_name?: string; 
    duration_minutes?: number;
    is_multi?: number;
    discount?: number;
    started_at?: string;
    finished_at?: string;
  }) =>
    apiCall('quickStartBooking', data),
  
  switchRoom: (bookingId: number, newRoomId: number) =>
    apiCall('switchRoom', { booking_id: bookingId, new_room_id: newRoomId }),
  
  timerUpdate: (bookingId: number, newFinishedAt: string) =>
    apiCall('timerUpdate', { booking_id: bookingId, new_finished_at: newFinishedAt }),
  
  updateDiscount: (bookingId: number, discount: number) =>
    apiCall('updateBookingDiscount', { booking_id: bookingId, discount }),
  
  getUpcoming: (days?: number) => apiCall('getUpcomingBookings', days ? { days } : undefined),
  
  getTodays: () => apiCall('getTodaysBookings'),
  
  getRecent: () => apiCall('getRecentBookings'),
  
  updateActive: (data: { booking_id: number; customer_id: number }) =>
    apiCall('updateActiveBooking', data),
  
  getEndingAlerts: () => apiCall('getBookingEndingAlerts')
}

// ==================== CAFETERIA ITEMS ====================

export const cafeteriaApi = {
  add: (data: { name: string; cost: number; price: number; stock: number; photo?: File }) =>
    apiCall('add_cafeteria_item', data, { isFormData: true }),
  
  create: (data: { name: string; cost?: number; price: number; stock: number; photo?: File }) =>
    apiCall('add_cafeteria_item', data, { isFormData: true }),
  
  list: () => apiCall('list_cafeteria_items'),
  
  getAll: () => apiCall('list_cafeteria_items'),
  
  get: (id: number) => apiCall('get_cafeteria_item', { id }),
  
  update: (id: number, data: { name?: string; cost?: number; price?: number; stock?: number; photo?: File }) =>
    apiCall('update_cafeteria_items', { id, ...data }, { isFormData: data.photo ? true : false }),
  
  delete: (id: number) => apiCall('delete_cafeteria_items', { id }),
  
  updateStock: (id: number, stock: number, operation?: 'add' | 'subtract' | 'set') => 
    apiCall('updateStock', { id, stock, operation: operation || 'set' }),
  
  addStock: (id: number, quantity: number) => apiCall('addStock', { id, quantity }),
  
  getLowStock: (threshold?: number) => apiCall('getLowStockItems', threshold ? { threshold } : undefined),
  
  getAvailable: () => apiCall('getAvailableItems')
}

// ==================== ORDERS ====================

export const orderApi = {
  add: (data: {
    customer_id: number
    items: Array<{ item_id: number; quantity: number }>
    discount?: number
    discount_percent?: number
    apply_loyalty_discount?: boolean
  }) => apiCall('addOrder', data),
  
  quick: (data: {
    customer_phone: string
    customer_name?: string
    items: Array<{ item_id: number; quantity: number }>
    booking_id?: number // Optional: link order to an active booking
  }) => apiCall('quickOrder', data),
  
  list: () => apiCall('listOrders'),
  
  getAll: () => apiCall('listOrders'),
  
  get: (id: number) => apiCall('getOrder', { id }),
  
  update: (id: number, data: { discount?: number; customer_id?: number; status?: string }) =>
    apiCall('updateOrder', { id, ...data }),
  
  delete: (id: number) => apiCall('deleteOrder', { id }),
  
  getTodays: () => apiCall('getTodaysOrders'),
  
  // Update order item quantity (superadmin only)
  updateItem: (order_item_id: number, quantity: number) =>
    apiCall('updateOrderItem', { order_item_id, quantity }),
  
  // Delete order item (superadmin only)
  deleteItem: (order_item_id: number) =>
    apiCall('deleteOrderItems', { order_item_id })
}

// ==================== FRONT DESK OPERATIONS ====================

export const frontDeskApi = {
  getDashboard: () => apiCall('getFrontDeskDashboard')
}

// ==================== ANALYTICS (Superadmin Only) ====================

export const analyticsApi = {
  getDashboard: () => apiCall('dashboardAnalyticsForSuperadmin'),
  
  getFullDashboard: (startDate?: string, endDate?: string) =>
    apiCall('getFullDashboardAnalytics', { start_date: startDate, end_date: endDate }),
  
  getOrders: () => apiCall('getOrdersAnalytics'),
  
  getRevenue: (period?: string) => 
    apiCall('getFullRevenueAnalytics', period ? { period } : undefined),
  
  getRooms: (period?: string) => 
    apiCall('getFullRoomAnalytics', period ? { period } : undefined),
  
  getCafeteria: (period?: string) => 
    apiCall('getFullCafeteriaAnalytics', period ? { period } : undefined),
  
  getCustomers: (period?: string) => 
    apiCall('getFullCustomerAnalytics', period ? { period } : undefined),
  
  getStaff: (period?: string) => 
    apiCall('getFullStaffAnalytics', period ? { period } : undefined),
  
  getFullOrders: (startDate?: string, endDate?: string, exportData?: boolean) =>
    apiCall('getFullOrdersAnalytics', { start_date: startDate, end_date: endDate, export: exportData }),
  
  getFullRooms: (startDate?: string, endDate?: string, exportData?: boolean) =>
    apiCall('getFullRoomAnalytics', { start_date: startDate, end_date: endDate, export: exportData }),
  
  getFullCafeteria: (startDate?: string, endDate?: string, exportData?: boolean) =>
    apiCall('getFullCafeteriaAnalytics', { start_date: startDate, end_date: endDate, export: exportData }),
  
  getFullCustomers: (startDate?: string, endDate?: string, exportData?: boolean) =>
    apiCall('getFullCustomerAnalytics', { start_date: startDate, end_date: endDate, export: exportData }),
  
  getFullStaff: (startDate?: string, endDate?: string, exportData?: boolean) =>
    apiCall('getFullStaffAnalytics', { start_date: startDate, end_date: endDate, export: exportData }),
  
  getFullRevenue: (startDate?: string, endDate?: string, exportData?: boolean) =>
    apiCall('getFullRevenueAnalytics', { start_date: startDate, end_date: endDate, export: exportData })
}

// ==================== SHIFT MANAGEMENT ====================

export const shiftApi = {
  // Start a new shift
  start: (data?: { started_at?: string; opening_cash?: number; notes?: string }) =>
    apiCall('startShift', data || {}),
  
  // End the current active shift
  end: (data?: { ended_at?: string; closing_cash?: number; notes?: string }) =>
    apiCall('endShift', data || {}),
  
  // Get current active shift status
  getCurrent: () => apiCall('getCurrentShift', {}),
  
  // List all shifts with optional date filtering
  list: (startDate?: string, endDate?: string) =>
    apiCall('listShifts', { start_date: startDate, end_date: endDate }),
  
  // Get detailed report for a specific shift
  getReport: (shiftId: number) =>
    apiCall('getShiftReport', { shift_id: shiftId }),
  
  // Get daily income analysis (superadmin only) - supports date range
  getDailyIncomeAnalysis: (startDate?: string, endDate?: string) =>
    apiCall('getDailyIncomeAnalysis', startDate ? { start_date: startDate, end_date: endDate || startDate } : {}),
  
  // Get printable daily report (superadmin only)
  getPrintableDailyReport: (date?: string) =>
    apiCall('getPrintableDailyReport', date ? { date } : {}),
  
  // Get monthly shift summary (superadmin only)
  getMonthlyShiftSummary: (month?: string) =>
    apiCall('getMonthlyShiftSummary', month ? { month } : {})
}

export default {
  auth: authApi,
  admin: adminApi,
  customer: customerApi,
  room: roomApi,
  booking: bookingApi,
  cafeteria: cafeteriaApi,
  order: orderApi,
  frontDesk: frontDeskApi,
  analytics: analyticsApi,
  shift: shiftApi
}
