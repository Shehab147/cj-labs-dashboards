// X-Station API Types

// ==================== COMMON ====================

export type AdminRole = 'superadmin' | 'admin'
export type AdminStatus = 'active' | 'inactive'
export type LoyaltyTier = 'VIP' | 'Gold' | 'Silver' | 'Bronze' | 'New' | 'platinum' | 'gold' | 'silver' | 'bronze' | 'new'

// ==================== ADMIN ====================

export interface Admin {
  id: number
  name: string
  email: string
  role: AdminRole
  status: AdminStatus
  is_active?: boolean
  last_login?: string
  created_at?: string
}

export interface AdminWithAttendance extends Admin {
  sessions: AdminSession[]
  total_hours: number
  last_login?: string
}

export interface AdminSession {
  login_time: string
  logout_time?: string
  duration_hours?: number
}

// ==================== CUSTOMER ====================

export interface Customer {
  id: number
  name: string
  phone: string
  email?: string
  created_at?: string
}

export interface CustomerWithStats extends Customer {
  order_count: number
  order_spent: number
  booking_count: number
  booking_spent: number
  total_spent: number
  // Aliases for convenience
  loyalty_tier?: LoyaltyTier
  loyalty_points?: number
  total_bookings?: number
  total_hours?: number
  discount_percentage?: number
}

export interface CustomerLookup extends Customer {
  total_spent: number
  total_transactions: number
  loyalty_tier: LoyaltyTier
  discount_percent: number
}

export interface CustomerLoyaltyInfo {
  customer: Customer
  total_orders: number
  total_bookings: number
  total_transactions: number
  total_spent: number
  loyalty_tier: LoyaltyTier
  suggested_discount_percent: number
  loyalty_label: string
}

// ==================== ROOM ====================

export interface Room {
  id: number
  name: string
  ps: string
  hour_cost: string | number
  multi_hour_cost?: string | number
  capacity: number
  is_booked: number | string | boolean
}

export interface RoomWithAnalytics extends Room {
  analytics?: {
    total_bookings: number
    total_revenue: number
    avg_duration: number
    monthly_bookings: Array<{ month: string; count: number; revenue: number }>
  }
}

export interface RoomStatus extends Room {
  current_booking?: {
    id: number
    customer_name: string
    started_at: string
    elapsed_hours: number
    estimated_price: number
  }
}

export interface RoomsStatusSummary {
  rooms: RoomStatus[]
  summary: {
    total: number
    available: number
    occupied: number
  }
}

// ==================== BOOKING ====================

export type BookingStatus = 'pending' | 'active' | 'completed' | 'cancelled'
export type BookingType = 'scheduled' | 'open_session'

export interface Booking {
  id: number
  customer_id: number
  room_id: number
  started_at: string
  finished_at?: string | null
  start_time?: string
  end_time?: string | null
  price?: string | number
  total_price?: string | number
  room_name: string
  ps: string
  hour_cost: string | number
  customer_name: string
  customer_phone: string
  is_active: boolean
  status?: BookingStatus
  booking_type?: BookingType
  current_duration_hours?: number
  estimated_price?: number
  remaining_hours?: number
}

export interface ActiveBooking extends Booking {
  elapsed_hours?: number
  current_duration_hours: number
  estimated_price: number
  remaining_hours?: number
  booking_type: BookingType
  status: 'active'
}

export interface BookingSummary {
  bookings: Booking[]
  summary: {
    total: number
    active: number
    completed: number
    completed_revenue: number
  }
}

export interface UpcomingBookings {
  in_progress: ActiveBooking[]
  upcoming: Booking[]
  total_active: number
  total_upcoming: number
}

// ==================== CAFETERIA ====================

export interface CafeteriaItem {
  id: number
  name: string
  cost: string | number
  price: string | number
  photo?: string
  stock: number
  created_at?: string
}

export interface CafeteriaItemWithAnalytics extends CafeteriaItem {
  analytics?: {
    total_sold: number
    total_revenue: number
    total_profit: number
    monthly_sales: Array<{ month: string; quantity: number; revenue: number }>
  }
}

// ==================== ORDER ====================

export interface OrderItem {
  item_id: number
  item_name: string
  quantity: number
  unit_price: string | number
  total_price: string | number
}

export interface Order {
  id: number
  customer_id: number
  price: string | number
  discount: string | number
  discount_percent?: number
  discount_type?: 'none' | 'fixed' | 'percent' | 'loyalty'
  created_at: string
  customer_name: string
  customer_phone: string
  items: OrderItem[]
  status?: 'pending' | 'completed' | 'cancelled'
  total_amount?: string | number
  items_count?: number
}

export interface OrderWithAnalytics extends Order {
  analytics?: {
    subtotal: number
    total_cost: number
    profit: number
    profit_margin: number
    customer_total_spent: number
  }
}

export interface OrdersListWithAnalytics {
  orders: Order[]
  analytics?: {
    total_orders: number
    total_revenue: number
    total_cost: number
    total_profit: number
    avg_order_value: number
    top_items: Array<{ name: string; quantity: number; revenue: number }>
  }
}

export interface TodaysOrders {
  orders: Order[]
  summary: {
    total_orders: number
    total_revenue: number
    total_discount: number
  }
}

// ==================== FRONT DESK ====================

export interface FrontDeskDashboard {
  rooms: {
    total: number
    available: number
    occupied?: number
    list: RoomStatus[]
  }
  active_bookings: ActiveBooking[]
  stock_alerts: {
    low_stock_count: number
    items: CafeteriaItem[]
    low_stock_items?: CafeteriaItem[]
  }
  today: {
    orders_count: number
    orders_revenue: number
    bookings_count: number
    bookings_revenue: number
    total_revenue: number
  }
  recent_bookings: Booking[]
}

// ==================== ANALYTICS ====================

export interface DashboardAnalytics {
  total_customers: number
  total_orders: number
  total_order_revenue: number
  total_bookings: number
  total_booking_revenue: number
  total_revenue?: number
}

// Alias for Analytics view
export type AnalyticsDashboard = DashboardAnalytics

export interface DateRange {
  start_date: string
  end_date: string
}

export interface FullDashboardAnalytics {
  date_range: DateRange
  summary: {
    total_customers: number
    new_customers: number
    total_orders: number
    order_revenue: number
    total_bookings: number
    booking_revenue: number
    total_revenue: number
    cafeteria_profit: number
  }
  daily_revenue: Array<{ date: string; orders: number; bookings: number; total: number }>
  top_products: Array<{ name: string; quantity: number; revenue: number }>
  top_rooms: Array<{ name: string; bookings: number; revenue: number }>
  top_customers: Array<{ name: string; spent: number; transactions: number }>
}

export interface OrdersAnalytics {
  daily_revenue: Array<{ date: string; orders: number; revenue: number; cost: number; profit: number }>
  top_items: Array<{ name: string; quantity: number; revenue: number; profit: number }>
  summary: {
    total_orders: number
    total_revenue: number
    total_cost: number
    total_profit: number
    profit_margin: number
  }
}

export interface RoomAnalytics {
  date_range?: DateRange
  summary?: {
    total_bookings: number
    total_revenue: number
    avg_booking_value: number
    avg_duration_hours: number
    active_sessions: number
  }
  room_performance?: Array<{
    id: string
    name: string
    ps: string
    hour_cost: string
    capacity: string
    booking_count: string
    total_revenue: string
    avg_booking_value: string
    avg_duration_minutes: string
    unique_customers: string
    avg_duration_hours: number
  }>
  daily_breakdown?: Array<{
    date: string
    day_name: string
    booking_count: string
    revenue: string
    avg_duration_minutes: string
    avg_duration_hours: number
  }>
  hourly_distribution?: Array<{
    hour: string
    booking_count: string
    revenue: string
  }>
  day_of_week_analysis?: Array<{
    day_name: string
    day_number: string
    booking_count: string
    revenue: string
  }>
  top_customers?: Array<{
    id: string
    name: string
    phone: string
    booking_count: string
    total_spent: string
    avg_duration_minutes: string
    avg_duration_hours: number
  }>
  average_utilization?: number
  rooms?: Array<{
    id: number
    room_id?: number
    name: string
    room_name?: string
    bookings: number
    bookings_count?: number
    revenue: number
    avg_duration: number
    utilization: number
    utilization_rate?: number
    total_hours?: number
  }>
  peak_hours?: Array<{ hour: number; bookings: number }>
}

export interface CafeteriaAnalytics {
  date_range?: DateRange
  summary?: {
    total_items: number
    total_sold: number
    total_revenue: number
    total_profit: number
    profit_margin: number
    low_stock_count: number
  }
  top_items?: Array<{
    id: number
    name: string
    quantity: number
    revenue: number
    profit: number
  }>
  top_performers?: Array<{
    id: number
    name: string
    total_sold: number
    total_revenue: string
  }>
  items?: Array<{
    id: number
    name: string
    stock: number
    sold: number
    revenue: number
    profit: number
  }>
  daily_sales?: Array<{ date: string; items: number; revenue: number; profit: number }>
}

export interface CustomerAnalytics {
  date_range?: DateRange
  summary?: {
    total_customers: number
    new_customers: number
    active_customers: number
    avg_spend: number
  }
  new_customers?: number
  returning_customers?: number
  loyalty_distribution?: Array<{ tier: LoyaltyTier; count: number; percentage: number }>
  top_customers: Array<{
    id: number
    customer_id?: number
    name: string
    customer_name?: string
    phone: string
    orders: number
    bookings: number
    booking_count?: number
    total_spent: number
    tier: LoyaltyTier
  }>
  acquisition?: Array<{ date: string; new_customers: number }>
}

export interface StaffAnalytics {
  date_range: DateRange
  summary: {
    total_staff: number
    total_hours: number
    avg_hours_per_staff: number
  }
  staff: Array<{
    id: number
    name: string
    email: string
    sessions: number
    total_hours: number
    orders_processed: number
    bookings_processed: number
  }>
}

export interface RevenueAnalytics {
  date_range?: DateRange
  summary?: {
    total_revenue: number
    order_revenue: number
    booking_revenue: number
    total_profit: number
    profit_margin: number
    booking_count?: number
    order_count?: number
    gross_profit?: number
  }
  // Convenience fields used by Analytics view
  bookings_count?: number
  bookings_revenue?: number
  orders_count?: number
  orders_revenue?: number
  total_revenue?: number
  profit?: number
  daily?: Array<{
    date: string
    orders: number
    bookings: number
    total: number
    profit: number
  }>
  monthly?: Array<{
    month: string
    orders: number
    bookings: number
    total: number
    profit: number
  }>
  comparison?: {
    vs_previous_period: number
    vs_previous_year: number
  }
}

// ==================== SHIFT ====================

export type ShiftStatus = 'active' | 'completed' | 'cancelled'

export interface Shift {
  id: number
  admin_id: number
  admin_name: string
  admin_role: string
  admin_email?: string
  started_at: string
  ended_at: string | null
  opening_cash: number
  closing_cash: number
  total_revenue: number
  total_orders: number
  total_bookings: number
  total_discount: number
  cash_difference: number
  duration_hours: number
  notes: string
  status: ShiftStatus
}

export interface CurrentShift {
  id: number
  admin_id: number
  admin_name: string
  admin_role: string
  started_at: string
  ended_at: null
  opening_cash: number
  notes: string
  status: 'active'
  current_revenue: number
  current_orders: number
  current_bookings: number
  current_discount: number
  duration_hours: number
}

export interface CurrentShiftResponse {
  has_active_shift: boolean
  shift: CurrentShift | null
}

export interface ShiftIncomeSummary {
  total_revenue: number
  order_revenue: number
  booking_revenue: number
  total_discount: number
  total_orders: number
  total_bookings: number
  total_transactions: number
}

export interface ShiftEndResponse {
  message: string
  shift_id: number
  admin: {
    id: number
    name: string
    role: string
  }
  started_at: string
  ended_at: string
  duration_hours: number
  opening_cash: number
  closing_cash: number
  expected_cash: number
  cash_difference: number
  income_summary: ShiftIncomeSummary
}

export interface ShiftOrder {
  id: number
  customer_id: number
  customer_name: string
  customer_phone: string
  price: number
  discount: number
  created_at: string
}

export interface ShiftBooking {
  id: number
  room_id: number
  room_name: string
  customer_id: number
  customer_name: string
  customer_phone: string
  price: number
  started_at: string
  finished_at: string
  createdAt: string
}

export interface HourlyBreakdown {
  hour: number
  hour_label?: string
  order_count?: number
  booking_count?: number
  order_revenue?: number
  booking_revenue?: number
  revenue?: number
  total_revenue?: number
  total_transactions?: number
}

export interface ShiftReport extends Shift {
  orders: ShiftOrder[]
  bookings: ShiftBooking[]
  hourly_breakdown: HourlyBreakdown[]
}

// ==================== DAILY INCOME ANALYSIS ====================

export interface TopSellingItem {
  id: number
  name: string
  price: number
  cost: number
  quantity_sold: number
  revenue: number
}

export interface RoomUtilization {
  id: number
  name: string
  ps: string
  booking_count: number
  revenue: number
  total_minutes: number
  total_hours: number
}

export interface PeakHour {
  hour: number
  hour_label: string
  revenue: number
}

export interface DailyIncomeShiftSummary {
  count: number
  total_shift_revenue: number
  details: Array<{
    id: number
    admin_name: string
    started_at: string
    ended_at: string
    total_revenue: number
  }>
}

export interface DailyIncomeSummary {
  total_revenue: number
  order_revenue: number
  booking_revenue: number
  total_cost: number
  total_profit: number
  profit_margin: number
  total_discount: number
  total_orders: number
  total_bookings: number
  total_transactions: number
  avg_order_value: number
  avg_booking_value: number
}

export interface DailyIncomeAnalysis {
  date: string
  summary: DailyIncomeSummary
  shifts: DailyIncomeShiftSummary
  orders: ShiftOrder[]
  bookings: ShiftBooking[]
  top_selling_items: TopSellingItem[]
  room_utilization: RoomUtilization[]
  hourly_breakdown: HourlyBreakdown[]
  peak_hour: PeakHour
  report_generated_at: string
  report_generated_by: {
    id: number
    name: string
    role: string
  }
}

export interface PrintableDailyReport {
  business_name: string
  report_title: string
  date: string
  date_short: string
  print_time: string
  printed_by: string
  summary: {
    total_revenue: number
    order_revenue: number
    booking_revenue: number
    total_discount: number
    net_revenue: number
    total_orders: number
    total_bookings: number
    total_transactions: number
  }
  shifts: {
    count: number
    total_opening_cash: number
    total_closing_cash: number
    shift_revenue: number
  }
  formatted_for_print: boolean
}

export interface MonthlyShiftSummary {
  month: string
  month_name: string
  summary: {
    total_revenue: number
    total_days: number
    avg_daily_revenue: number
  }
  daily_summary: Array<{
    date: string
    shift_count: number
    revenue: number
    orders: number
    bookings: number
    total_hours: number
  }>
  staff_performance: Array<{
    id: number
    name: string
    role: string
    shift_count: number
    revenue: number
    hours_worked: number
  }>
}
