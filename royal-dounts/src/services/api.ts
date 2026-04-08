// Royal Dounts API Service
// Base URL for the API - matches http://royal-donuts.labs.cloudjet.org/proc.php
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://royal-donuts.labs.cloudjet.org/proc.php'

// Get token from localStorage (client-side only)
const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('royal-dounts-token')
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
      localStorage.setItem('royal-dounts-token', token)
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
    localStorage.removeItem('royal-dounts-token')
    localStorage.removeItem('royal-dounts-admin')
    console.log('Token and admin data removed from localStorage')
  }
}

// Get stored admin info
export const getStoredAdmin = () => {
  if (typeof window !== 'undefined') {
    try {
      const admin = localStorage.getItem('royal-dounts-admin')
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
      localStorage.setItem('royal-dounts-admin', JSON.stringify(admin))
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
    
    const text = await response.text()
    
    let data
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0])
      } else {
        data = JSON.parse(text)
      }
    } catch (parseError) {
      console.error(`[API] ${action} - Failed to parse response:`, text)
      return {
        status: 'error',
        message: 'Invalid response from server'
      }
    }
    
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
  
  logout: (closingCash?: number, notes?: string) =>
    apiCall('logout', closingCash !== undefined ? { closing_cash: closingCash, notes } : {}),
  
  validateSession: () => apiCall('validateSession'),
  
  getProfile: () => apiCall('getProfile'),
}

// ==================== USER MANAGEMENT (Admin Only) ====================

export const userApi = {
  add: (data: { name: string; email: string; password: string; role: string }) =>
    apiCall('addUser', data),
  
  getAll: () => apiCall('getUsers'),
  
  list: () => apiCall('getUsers'),
  
  update: (id: number, data: { name?: string; email?: string; password?: string; role?: string }) =>
    apiCall('updateUser', { id, ...data }),
  
  delete: (id: number) => apiCall('deleteUser', { id }),
}

// ==================== SHIFT MANAGEMENT ====================

export const shiftApi = {
  start: (data: { opening_cash: number }) =>
    apiCall('startShift', data),
  
  end: (data: { closing_cash: number; notes?: string }) =>
    apiCall('endShift', data),
  
  getCurrent: () => apiCall('getCurrentShift', {}),
  
  getMyHistory: () => apiCall('getMyShiftHistory', {}),
  
  getSummary: (shiftId?: number) =>
    apiCall('getShiftSummary', shiftId ? { shift_id: shiftId } : {}),
  
  addExpense: (data: { amount: number; reason: string }) =>
    apiCall('addShiftExpense', data),
  
  getExpenses: () => apiCall('getShiftExpenses', {}),
  
  deleteExpense: (id: number) => apiCall('deleteShiftExpense', { id }),
  
  // Admin only
  getAll: () => apiCall('getAllShifts', {}),
  
  getReport: (shiftId: number) =>
    apiCall('getShiftReport', { shift_id: shiftId }),
}

// ==================== PAYMENT MANAGEMENT ====================

export const paymentApi = {
  process: (data: { order_id: number; payment_method: 'cash' | 'card'; amount: number }) =>
    apiCall('processPayment', data),
  
  getOrderPayments: (orderId: number) =>
    apiCall('getOrderPayments', { order_id: orderId }),
  
  getOrderReceipt: (orderId: number) =>
    apiCall('getOrderReceipt', { order_id: orderId }),
}

// ==================== TABLE MANAGEMENT ====================

export const tableApi = {
  getAll: () => apiCall('getTables'),
  
  list: () => apiCall('getTables'),
  
  add: (data: { table_number: number }) =>
    apiCall('addTable', data),
  
  update: (id: number, data: { table_number?: number; status?: 'available' | 'occupied' }) =>
    apiCall('updateTable', { id, ...data }),
  
  delete: (id: number) => apiCall('deleteTable', { id }),
  
  getAvailable: () => apiCall('getAvailableTables'),
  
  getProfitByDate: (data?: { start_date?: string; end_date?: string }) =>
    apiCall('getTablesProfitByDate', data || {}),
  
  getOrdersAnalysis: (tableId: number, data?: { start_date?: string; end_date?: string }) =>
    apiCall('getTableOrdersAnalysis', { table_id: tableId, ...data }),
  
  checkoutOrder: (orderId: number, data?: { table_tax?: number; hourly_rate?: number }) =>
    apiCall('checkoutTableOrder', { order_id: orderId, ...data }),
  
  getOrderTime: (orderId: number, hourlyRate?: number) =>
    apiCall('getTableOrderTime', { order_id: orderId, hourly_rate: hourlyRate || 0 }),
}

// ==================== KITCHEN MANAGEMENT ====================

export const kitchenApi = {
  addLog: (data: { product_id: number; quantity: number }) =>
    apiCall('addKitchenLog', data),
  
  addLogs: (data: { product_id: number; quantity: number }) =>
    apiCall('addkitchenlogs', data),
  
  getLogs: (data?: { start_date?: string; end_date?: string; product_id?: number }) =>
    apiCall('getKitchenLogs', data || {}),
  
  quickStockUpdate: (data: { product_id: number; quantity: number }) =>
    apiCall('quickStockUpdate', data),
  
  getLowStockProducts: (threshold?: number) =>
    apiCall('getLowStockProducts', threshold ? { threshold } : {}),
  
  getDailySummary: (date?: string) =>
    apiCall('getKitchenDailySummary', date ? { date } : {}),
  
  getOrders: () => apiCall('getKitchenOrders', {}),
}

// ==================== CATEGORY MANAGEMENT ====================

export const categoryApi = {
  getAll: () => apiCall('getCategory'),
  
  list: () => apiCall('getCategory'),
  
  add: (data: { name: string }) =>
    apiCall('addCategory', data),
  
  update: (id: number, data: { name: string }) =>
    apiCall('updateCategory', { id, ...data }),
  
  delete: (id: number) => apiCall('deleteCategory', { id }),
}

// ==================== PRODUCT MANAGEMENT ====================

export const productApi = {
  getAll: () => apiCall('getProducts'),
  
  list: () => apiCall('getProducts'),
  
  add: (data: { name: string; price: number; cost: number; category_id: number; stock?: number; description?: string }) =>
    apiCall('addProduct', data),
  
  update: (id: number, data: { name?: string; price?: number; cost?: number; category_id?: number; stock?: number; description?: string }) =>
    apiCall('updateProduct', { id, ...data }),
  
  delete: (id: number) => apiCall('deleteProduct', { id }),
}

// ==================== REFUND MANAGEMENT ====================

export const refundApi = {
  add: (data: { order_id: number; amount: number; reason: string }) =>
    apiCall('addRefund', data),
  
  getAll: (data?: { start_date?: string; end_date?: string }) =>
    apiCall('getRefunds', data || {}),
  
  list: (data?: { start_date?: string; end_date?: string }) =>
    apiCall('getRefunds', data || {}),
}

// ==================== ORDER MANAGEMENT ====================

export const orderApi = {
  create: (data: {
    order_type: 'dine_in' | 'takeaway' | 'delivery'
    table_id?: number
    customer_name?: string
    customer_phone?: string
    address?: string
    delivery_cost?: number
    items: Array<{ product_id: number; quantity: number; price?: number }>
  }) => apiCall('createOrder', data),
  
  getAll: (data?: { start_date?: string; end_date?: string; status?: string; order_type?: string }) =>
    apiCall('getOrders', data || {}),
  
  list: (data?: { start_date?: string; end_date?: string; status?: string; order_type?: string }) =>
    apiCall('getOrders', data || {}),
  
  getById: (id: number) => apiCall('getOrderById', { id }),
  
  update: (id: number, data: {
    customer_name?: string
    customer_phone?: string
    address?: string
    delivery_cost?: number
    status?: 'pending' | 'preparing' | 'done' | 'cancelled'
  }) => apiCall('updateOrder', { id, ...data }),
  
  delete: (id: number) => apiCall('deleteOrder', { id }),
  
  addItem: (data: { order_id: number; product_id: number; quantity: number; price?: number }) =>
    apiCall('addOrderItem', data),
  
  updateItem: (id: number, data: { quantity?: number; price?: number }) =>
    apiCall('updateOrderItem', { id, ...data }),
  
  deleteItem: (id: number) => apiCall('deleteOrderItem', { id }),
  
  updateStatus: (id: number, status: 'pending' | 'preparing' | 'done' | 'cancelled') =>
    apiCall('updateOrderStatus', { id, status }),
}

// ==================== REPORTS & ANALYTICS (Admin Only) ====================

export const analyticsApi = {
  getDailySalesReport: (date?: string) =>
    apiCall('getDailySalesReport', date ? { date } : {}),
  
  getSalesAnalytics: (data?: { start_date?: string; end_date?: string; period?: string }) =>
    apiCall('getSalesAnalytics', data || {}),
  
  getTopProducts: (data?: { start_date?: string; end_date?: string; limit?: number }) =>
    apiCall('getTopProducts', data || {}),
  
  getCategoryAnalytics: (data?: { start_date?: string; end_date?: string }) =>
    apiCall('getCategoryAnalytics', data || {}),
  
  getCashierPerformance: (data?: { start_date?: string; end_date?: string }) =>
    apiCall('getCashierPerformance', data || {}),
  
  getAdminDashboard: () => apiCall('getAdminDashboard', {}),
  
  getEndOfDayReport: (date?: string) =>
    apiCall('getEndOfDayReport', date ? { date } : {}),
  
  exportReport: (data: { report_type: string; start_date?: string; end_date?: string; format?: string }) =>
    apiCall('exportReport', data),
}

// ==================== INVENTORY MANAGEMENT ====================

export const inventoryApi = {
  adjust: (data: { product_id: number; adjustment_type: 'add' | 'subtract'; quantity: number; reason: string; notes?: string }) =>
    apiCall('adjustInventory', data),
  
  getAdjustments: (data?: { product_id?: number; start_date?: string; end_date?: string }) =>
    apiCall('getInventoryAdjustments', data || {}),
}

// ==================== LEGACY ALIASES (for backward compatibility) ====================

// These map old X-Station API names to new Royal Dounts APIs
export const adminApi = userApi
export const cafeteriaApi = productApi
export const frontDeskApi = {
  getDashboard: () => analyticsApi.getAdminDashboard()
}

// Stubs for X-Station specific APIs that don't exist in Royal Dounts backend
// These will return error responses if called, preventing import errors
const notImplemented = (name: string) => () =>
  Promise.resolve({ status: 'error' as const, message: `${name} is not available in Royal Dounts` })

export const roomApi = {
  add: notImplemented('roomApi.add'),
  list: notImplemented('roomApi.list'),
  get: notImplemented('roomApi.get'),
  update: notImplemented('roomApi.update'),
  delete: notImplemented('roomApi.delete'),
  getAvailable: notImplemented('roomApi.getAvailable'),
  getStatus: notImplemented('roomApi.getStatus'),
}

export const bookingApi = {
  add: notImplemented('bookingApi.add'),
  end: notImplemented('bookingApi.end'),
  list: notImplemented('bookingApi.list'),
  getAll: notImplemented('bookingApi.getAll'),
  getActive: notImplemented('bookingApi.getActive'),
  get: notImplemented('bookingApi.get'),
  cancel: notImplemented('bookingApi.cancel'),
  delete: notImplemented('bookingApi.delete'),
  quickStart: notImplemented('bookingApi.quickStart'),
  switchRoom: notImplemented('bookingApi.switchRoom'),
  timerUpdate: notImplemented('bookingApi.timerUpdate'),
  updateDiscount: notImplemented('bookingApi.updateDiscount'),
  getUpcoming: notImplemented('bookingApi.getUpcoming'),
  getTodays: notImplemented('bookingApi.getTodays'),
  getRecent: notImplemented('bookingApi.getRecent'),
  updateActive: notImplemented('bookingApi.updateActive'),
  getEndingAlerts: notImplemented('bookingApi.getEndingAlerts'),
}

export const customerApi = {
  add: notImplemented('customerApi.add'),
  create: notImplemented('customerApi.create'),
  list: notImplemented('customerApi.list'),
  getAll: notImplemented('customerApi.getAll'),
  get: notImplemented('customerApi.get'),
  update: notImplemented('customerApi.update'),
  delete: notImplemented('customerApi.delete'),
  search: notImplemented('customerApi.search'),
  findByPhone: notImplemented('customerApi.findByPhone'),
  getLoyaltyInfo: notImplemented('customerApi.getLoyaltyInfo'),
}

export default {
  auth: authApi,
  user: userApi,
  shift: shiftApi,
  payment: paymentApi,
  table: tableApi,
  kitchen: kitchenApi,
  category: categoryApi,
  product: productApi,
  refund: refundApi,
  order: orderApi,
  analytics: analyticsApi,
  inventory: inventoryApi,
}
