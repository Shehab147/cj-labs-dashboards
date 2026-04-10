// Royal Doughnuts API Service
// Base URL: https://royal-dounuts.labs.cloudjet.org/processor.php
// Auth: Session-based (PHP sessions via cookies)
// All requests: POST with ?action=<action_name>

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://royal-donuts.labs.cloudjet.org/processor.php'

export interface ApiResponse<T = any> {
  status: 'success' | 'error'
  data?: T
  message?: string
}

// Core fetch wrapper - translates {success: true, ...} → {status: 'success', data: {...}}
async function apiCall<T = any>(
  action: string,
  body?: object,
  params?: Record<string, string>
): Promise<ApiResponse<T>> {
  try {
    const url = new URL(BASE_URL)

    url.searchParams.set('action', action)

    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    }

    const res = await fetch(url.toString(), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    const json = await res.json()

    if (json.success === true) {
      const { message, ...rest } = json

      return { status: 'success', data: rest as T, message }
    } else {
      return { status: 'error', message: json.message || 'حدث خطأ غير متوقع' }
    }
  } catch (error) {
    console.error(`[API] ${action} failed:`, error)

    return { status: 'error', message: 'خطأ في الاتصال بالشبكة. يرجى المحاولة مرة أخرى.' }
  }
}

// ==================== AUTH ====================

export const authApi = {
  login: (username: string, password: string) =>
    apiCall('login', { username, password }),

  logout: () => apiCall('logout'),

  getProfile: () => apiCall('get_profile'),
}

// ==================== CASHIER SHIFTS ====================

export const cashierShiftApi = {
  start: (data: { opening_cash: number; notes?: string }) =>
    apiCall('start_cashier_shift', data),

  end: (data: { closing_cash: number; notes?: string }) =>
    apiCall('end_cashier_shift', data),

  getMy: () => apiCall('get_my_shift'),
}

// ==================== KITCHEN SHIFTS ====================

export const kitchenShiftApi = {
  start: (data?: { notes?: string }) =>
    apiCall('start_kitchen_shift', data || {}),

  end: (data: { notes?: string; closing_stock: Array<{ stock_item_id: number; qty: number }> }) =>
    apiCall('end_kitchen_shift', data),

  getMy: () => apiCall('get_my_kitchen_shift'),

  getDetails: (id: string) =>
    apiCall('get_kitchen_shift_details', undefined, { id }),
}

// ==================== MENU ====================

export const menuApi = {
  getMenu: (active: '0' | '1' = '1') =>
    apiCall('get_menu', undefined, { active }),

  getCategories: () => apiCall('get_menu_categories'),

  getItem: (id: string) =>
    apiCall('get_menu_item', undefined, { id }),

  createCategory: (data: { name: string; sort_order?: number }) =>
    apiCall('create_menu_category', data),

  createItem: (data: {
    category_id: number
    name: string
    description?: string
    price: number
    cost_estimate: number
    prep_time_min?: number
    image_url?: string
  }) => apiCall('create_menu_item', data),

  updateItem: (data: {
    id: number
    category_id: number
    name: string
    description?: string
    price: number
    cost_estimate: number
    prep_time_min?: number
    image_url?: string
  }) => apiCall('update_menu_item', data),

  toggleAvailability: (id: number) =>
    apiCall('toggle_menu_item_availability', { id }),

  toggleActive: (id: number) =>
    apiCall('toggle_menu_item_active', { id }),

  setIngredients: (data: {
    menu_item_id: number
    ingredients: Array<{ stock_item_id: number; qty_needed: number }>
  }) => apiCall('set_menu_item_ingredients', data),
}

// ==================== ORDERS ====================

export const orderApi = {
  place: (data: {
    items: Array<{ menu_item_id: number; quantity: number; special_request?: string }>
    customer_name?: string
    customer_phone?: string
    discount_amount?: number
    tax_amount?: number
    payment_method: 'cash' | 'card' | 'online' | 'other'
    payment_status?: 'pending' | 'paid'
    notes?: string
    type?: 'takeaway' | 'onsite' | 'delivery'
    address?: string
    delivery_cost?: number
  }) => apiCall('place_order', data),

  updateType: (data: {
    order_id: number
    type: 'takeaway' | 'onsite' | 'delivery'
    address?: string
    delivery_cost?: number
  }) => apiCall('update_order_type', data),

  // Cashier: their open shift orders. Admin: filter by shift_id or status
  getOrders: (params?: { shift_id?: string; status?: string }) =>
    apiCall('get_orders', undefined, params as Record<string, string>),

  getOrder: (id: string) =>
    apiCall('get_order', undefined, { id }),

  updatePayment: (data: {
    order_id: number
    payment_status: 'pending' | 'paid' | 'refunded' | 'partially_refunded'
    payment_method?: 'cash' | 'card' | 'online' | 'other'
  }) => apiCall('update_order_payment', data),

  cancel: (order_id: number) =>
    apiCall('cancel_order', { order_id }),

  // Kitchen/cashier/admin: active orders queue
  getActive: (params?: { statuses?: string }) =>
    apiCall('get_active_orders', undefined, params as Record<string, string>),

  updateStatus: (order_id: number, order_status: 'preparing' | 'ready' | 'picked_up' | 'cancelled') =>
    apiCall('update_order_status', { order_id, order_status }),

  // Admin: all orders with date range
  getAll: (params?: { from?: string; to?: string; status?: string }) =>
    apiCall('get_all_orders', undefined, params as Record<string, string>),
}

// ==================== STOCK ====================

export const stockApi = {
  getStock: () => apiCall('get_stock'),

  getAllStock: () => apiCall('get_all_stock'),

  getLowStock: () => apiCall('get_low_stock'),

  getUnits: () => apiCall('get_stock_units'),

  addTransaction: (data: {
    stock_item_id: number
    type: 'purchase' | 'waste' | 'adjustment'
    qty: number
    unit_cost?: number
    reference_note?: string
  }) => apiCall('add_stock_transaction', data),

  getTransactions: (params?: { stock_item_id?: string; type?: string }) =>
    apiCall('get_stock_transactions', undefined, params as Record<string, string>),

  createItem: (data: {
    name: string
    unit_id: number
    current_qty: number
    min_qty: number
    cost_per_unit: number
  }) => apiCall('create_stock_item', data),

  updateItem: (data: {
    id: number
    name: string
    unit_id: number
    min_qty: number
    cost_per_unit: number
  }) => apiCall('update_stock_item', data),

  toggleItem: (id: number) => apiCall('toggle_stock_item', { id }),
}

// ==================== EXPENSES ====================

export const expenseApi = {
  getCategories: () => apiCall('get_expense_categories'),

  getExpenses: (params?: { from?: string; to?: string }) =>
    apiCall('get_expenses', undefined, params as Record<string, string>),

  add: (data: {
    category_id: number
    amount: number
    description: string
    expense_date?: string
    receipt_url?: string
  }) => apiCall('add_expense', data),

  delete: (id: number) => apiCall('delete_expense', { id }),
}

// ==================== USERS ====================

export const userApi = {
  getAll: () => apiCall('get_users'),

  create: (data: {
    full_name: string
    username: string
    password: string
    role_id: number // 1=cashier, 2=kitchen, 3=super_admin
    phone?: string
  }) => apiCall('create_user', data),

  update: (data: {
    id: number
    full_name: string
    phone?: string
    role_id: number
    password?: string
  }) => apiCall('update_user', data),

  toggleStatus: (id: number) => apiCall('toggle_user_status', { id }),
}

// ==================== REPORTS / ANALYTICS ====================

export const reportsApi = {
  getDashboard: () => apiCall('get_dashboard'),

  getDailyReport: (params: { from: string; to: string }) =>
    apiCall('get_daily_report', undefined, params),

  getIncomeReport: (params: { from: string; to: string }) =>
    apiCall('get_income_report', undefined, params),

  getTopSelling: (params?: { limit?: string; from?: string; to?: string }) =>
    apiCall('get_top_selling', undefined, params as Record<string, string>),

  getCashierShifts: (params?: { from?: string; to?: string; user_id?: string }) =>
    apiCall('get_cashier_shifts', undefined, params as Record<string, string>),

  getKitchenShifts: (params?: { from?: string; to?: string }) =>
    apiCall('get_kitchen_shifts', undefined, params as Record<string, string>),
}

// ==================== LEGACY ALIASES ====================
// Keep these so existing imports don't break during migration

export const analyticsApi = {
  getAdminDashboard: () => reportsApi.getDashboard(),
  getSalesAnalytics: (params?: any) => reportsApi.getDailyReport({
    from: params?.start_date || new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0],
    to: params?.end_date || new Date().toISOString().split('T')[0]
  }),
  getTopProducts: (params?: any) => reportsApi.getTopSelling({
    limit: String(params?.limit || 10),
    from: params?.start_date,
    to: params?.end_date
  }),
  getCashierPerformance: (params?: any) => reportsApi.getCashierShifts({
    from: params?.start_date,
    to: params?.end_date
  }),
  getDailySalesReport: (date?: string) => reportsApi.getDailyReport({
    from: date || new Date().toISOString().split('T')[0],
    to: date || new Date().toISOString().split('T')[0]
  }),
  getEndOfDayReport: (date?: string) => reportsApi.getDailyReport({
    from: date || new Date().toISOString().split('T')[0],
    to: date || new Date().toISOString().split('T')[0]
  }),
  getCategoryAnalytics: () => Promise.resolve({ status: 'error' as const, message: 'غير متاح' }),
  exportReport: () => Promise.resolve({ status: 'error' as const, message: 'غير متاح' }),
}

export const shiftApi = {
  start: (data: { opening_cash: number; notes?: string }) => cashierShiftApi.start(data),
  end: (data: { closing_cash: number; notes?: string }) => cashierShiftApi.end(data),
  getCurrent: () => cashierShiftApi.getMy(),
  getAll: (params?: any) => reportsApi.getCashierShifts(params),
  getMyHistory: () => reportsApi.getCashierShifts(),
  getSummary: () => reportsApi.getDashboard(),
  getReport: (shiftId: number) => reportsApi.getCashierShifts({ user_id: String(shiftId) }),
  addExpense: () => Promise.resolve({ status: 'error' as const, message: 'استخدم expenseApi' }),
  getExpenses: () => expenseApi.getExpenses(),
  deleteExpense: (id: number) => expenseApi.delete(id),
}

export const productApi = {
  getAll: () => menuApi.getMenu('0'),
  list: () => menuApi.getMenu('1'),
  add: (data: any) => menuApi.createItem({
    category_id: data.category_id,
    name: data.name,
    description: data.description,
    price: data.price,
    cost_estimate: data.cost || 0,
  }),
  update: (id: number, data: any) => menuApi.updateItem({
    id,
    category_id: data.category_id,
    name: data.name,
    description: data.description,
    price: data.price,
    cost_estimate: data.cost || 0,
  }),
  delete: (id: number) => menuApi.toggleActive(id),
}

export const categoryApi = {
  getAll: () => menuApi.getCategories(),
  list: () => menuApi.getCategories(),
  add: (data: { name: string }) => menuApi.createCategory(data),
  update: () => Promise.resolve({ status: 'error' as const, message: 'تعديل التصنيف غير متاح من الخادم حالياً' }),
  delete: (id: number) => menuApi.toggleActive(id),
}

export const kitchenApi = {
  getOrders: () => orderApi.getActive({ statuses: 'pending,preparing' }),
  getLowStockProducts: () => stockApi.getLowStock(),
  getDailySummary: () => reportsApi.getDashboard(),
  addLog: () => Promise.resolve({ status: 'error' as const, message: 'غير متاح' }),
  addLogs: () => Promise.resolve({ status: 'error' as const, message: 'غير متاح' }),
  getLogs: () => Promise.resolve({ status: 'error' as const, message: 'غير متاح' }),
  quickStockUpdate: () => Promise.resolve({ status: 'error' as const, message: 'غير متاح' }),
}

export const inventoryApi = {
  adjust: (data: any) => stockApi.addTransaction({
    stock_item_id: data.product_id || data.stock_item_id,
    type: data.adjustment_type === 'add' ? 'purchase' : 'waste',
    qty: Math.abs(data.quantity || data.qty || 0),
    reference_note: data.reason || data.notes,
  }),
  getAdjustments: (params?: any) => stockApi.getTransactions(params),
}

export const paymentApi = {
  process: (data: { order_id: number; payment_method: 'cash' | 'card'; amount: number }) =>
    orderApi.updatePayment({
      order_id: data.order_id,
      payment_status: 'paid',
      payment_method: data.payment_method,
    }),
  getOrderPayments: (orderId: number) => orderApi.getOrder(String(orderId)),
  getOrderReceipt: (orderId: number) => orderApi.getOrder(String(orderId)),
}

export const tableApi = {
  getAll: () => Promise.resolve({ status: 'error' as const, message: 'غير متاح' }),
  list: () => Promise.resolve({ status: 'error' as const, message: 'غير متاح' }),
  getAvailable: () => Promise.resolve({ status: 'success' as const, data: [] }),
  add: () => Promise.resolve({ status: 'error' as const, message: 'غير متاح' }),
  update: () => Promise.resolve({ status: 'error' as const, message: 'غير متاح' }),
  delete: () => Promise.resolve({ status: 'error' as const, message: 'غير متاح' }),
  getProfitByDate: () => Promise.resolve({ status: 'error' as const, message: 'غير متاح' }),
  getOrdersAnalysis: () => Promise.resolve({ status: 'error' as const, message: 'غير متاح' }),
  checkoutOrder: () => Promise.resolve({ status: 'error' as const, message: 'غير متاح' }),
  getOrderTime: () => Promise.resolve({ status: 'error' as const, message: 'غير متاح' }),
}

export const refundApi = {
  add: () => Promise.resolve({ status: 'error' as const, message: 'غير متاح' }),
  getAll: () => Promise.resolve({ status: 'success' as const, data: [] }),
  list: () => Promise.resolve({ status: 'success' as const, data: [] }),
}

// Export getToken/setToken/removeToken stubs for backward compat
export const getToken = () => null
export const setToken = (token: string) => { void token }
export const removeToken = () => {}
export const getStoredAdmin = () => null
export const setStoredAdmin = (admin: any) => { void admin }

export const adminApi = userApi

const apiService = {
  auth: authApi,
  cashierShift: cashierShiftApi,
  kitchenShift: kitchenShiftApi,
  menu: menuApi,
  order: orderApi,
  stock: stockApi,
  expense: expenseApi,
  user: userApi,
  reports: reportsApi,
}

export default apiService
