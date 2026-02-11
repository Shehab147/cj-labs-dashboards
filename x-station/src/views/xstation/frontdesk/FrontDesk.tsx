'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import Autocomplete from '@mui/material/Autocomplete'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import InputAdornment from '@mui/material/InputAdornment'

import { frontDeskApi, roomApi, bookingApi, customerApi, cafeteriaApi, orderApi } from '@/services/api'
import type { FrontDeskDashboard, Room, Customer, CafeteriaItem, ActiveBooking } from '@/types/xstation'
import CustomTextField from '@core/components/mui/TextField'
import CustomAvatar from '@core/components/mui/Avatar'
import { parseServerDateTimeMs, formatLocalTime, formatLocalDate, formatTimerDisplay, toServerDateTime, getLocaleForRtl } from '@/utils/timezone'
import { useParams } from 'next/navigation'
import { i18n } from '@configs/i18n'
import type { Locale } from '@configs/i18n'

// Helper function to convert digits to Arabic numerals
const toArabicDigits = (str: string): string => {
  return str.replace(/\d/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)])
}

interface FrontDeskProps {
  dictionary: any
}

interface QuickBookingData {
  room_id: number
  customer_id?: number
  customer_phone: string
  customer_name: string
  duration_minutes: number // 0 = open-ended, 10-180 minutes
  is_multi: number // 0 = single, 1 = multi
  discount: number // discount in EGP
}

interface OrderItemData {
  item_id: number
  name: string
  price: number
  quantity: number
}

interface QuickOrderData {
  customer_id?: number
  customer_phone: string
  customer_name: string
  items: OrderItemData[]
}

const FrontDesk = ({ dictionary }: FrontDeskProps) => {
  // Get locale for RTL support
  const params = useParams()
  const locale = (params?.lang as Locale) || i18n.defaultLocale
  const isRtl = i18n.langDirection[locale] === 'rtl'

  const [data, setData] = useState<FrontDeskDashboard | null>(null)
  const [availableRooms, setAvailableRooms] = useState<Room[]>([])
  const [availableItems, setAvailableItems] = useState<CafeteriaItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Dialog states
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [endBookingDialogOpen, setEndBookingDialogOpen] = useState(false)
  const [addCustomerDialogOpen, setAddCustomerDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<ActiveBooking | null>(null)

  // Form states
  const [bookingData, setBookingData] = useState<QuickBookingData>({
    room_id: 0,
    customer_phone: '',
    customer_name: '',
    duration_minutes: 0, // 0 = open-ended
    is_multi: 0, // 0 = single, 1 = multi
    discount: 0 // discount in EGP
  })
  
  // Default Guest customer
  const guestCustomer: Customer = { id: -1, name: dictionary?.bookings?.guestCustomer || 'Guest', phone: '0000000000' } as Customer
  
  const [selectedBookingCustomer, setSelectedBookingCustomer] = useState<Customer | null>(guestCustomer)

  const [orderData, setOrderData] = useState<QuickOrderData>({
    customer_phone: '',
    customer_name: '',
    items: []
  })
  const [selectedOrderCustomer, setSelectedOrderCustomer] = useState<Customer | null>(guestCustomer)

  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    phone: ''
  })

  const [orderTab, setOrderTab] = useState(0)
  const [showInlineCustomerForm, setShowInlineCustomerForm] = useState(false)
  const [inlineCustomerData, setInlineCustomerData] = useState({ name: '', phone: '' })
  const [isAddingInlineCustomer, setIsAddingInlineCustomer] = useState(false)
  
  // Timer state for scheduled bookings
  const [currentTime, setCurrentTime] = useState(Date.now())
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Inline customer form for order dialog
  const [showOrderInlineCustomerForm, setShowOrderInlineCustomerForm] = useState(false)
  const [orderInlineCustomerData, setOrderInlineCustomerData] = useState({ name: '', phone: '' })
  const [isAddingOrderInlineCustomer, setIsAddingOrderInlineCustomer] = useState(false)

  // Add Order to Booking Dialog states
  const [addOrderToBookingDialogOpen, setAddOrderToBookingDialogOpen] = useState(false)
  const [selectedBookingForOrder, setSelectedBookingForOrder] = useState<ActiveBooking | null>(null)
  const [bookingOrderItems, setBookingOrderItems] = useState<OrderItemData[]>([])
  const [bookingOrderTab, setBookingOrderTab] = useState(0)

  // View Orders Dialog states
  const [viewOrdersDialogOpen, setViewOrdersDialogOpen] = useState(false)
  const [selectedBookingOrders, setSelectedBookingOrders] = useState<any>(null)

  // Receipt state - for showing receipt option after ending booking
  const [lastEndedBooking, setLastEndedBooking] = useState<any>(null)
  const [showReceiptDialog, setShowReceiptDialog] = useState(false)

  // Recent bookings state
  const [recentBookings, setRecentBookings] = useState<any[]>([])

  // Update Discount Dialog states
  const [updateDiscountDialogOpen, setUpdateDiscountDialogOpen] = useState(false)
  const [selectedBookingForDiscount, setSelectedBookingForDiscount] = useState<ActiveBooking | null>(null)
  const [newDiscount, setNewDiscount] = useState(0)

  const fetchData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setIsLoading(true)
      const [dashboardRes, roomsRes, itemsRes, customersRes, activeBookingsRes, todaysBookingsRes] = await Promise.all([
        frontDeskApi.getDashboard(),
        roomApi.getAvailable(),
        cafeteriaApi.getAvailable(),
        customerApi.getAll(),
        bookingApi.getActive(),
        bookingApi.getTodays() // Use getTodays to get bookings with orders data
      ])

      if (dashboardRes.status === 'success') {
        // Use active bookings from the dedicated endpoint to ensure we get both
        // open sessions and scheduled bookings that are currently active
        const dashboardData = dashboardRes.data
        if (activeBookingsRes.status === 'success' && activeBookingsRes.data) {
          dashboardData.active_bookings = activeBookingsRes.data
        }
        setData(dashboardData)
      }
      if (roomsRes.status === 'success') {
        setAvailableRooms(roomsRes.data || [])
      }
      if (itemsRes.status === 'success') {
        setAvailableItems(itemsRes.data || [])
      }
      if (customersRes.status === 'success') {
        setCustomers(customersRes.data || [])
      }
      // Get last 10 completed bookings with orders data (sorted by end time descending)
      if (todaysBookingsRes.status === 'success') {
        // API returns { data: { bookings: [...], summary: {...} } }
        const bookings = todaysBookingsRes.data?.bookings || todaysBookingsRes.data || []
        const completedBookings = bookings
          .filter((b: any) => b.status === 'completed' || (b.finished_at !== null && b.finished_at !== undefined))
          .sort((a: any, b: any) => {
            const dateA = new Date(a.finished_at || a.end_time).getTime()
            const dateB = new Date(b.finished_at || b.end_time).getTime()
            return dateB - dateA
          })
          .slice(0, 10)
        setRecentBookings(completedBookings)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [dictionary])

  useEffect(() => {
    fetchData(true) // Show loading on initial fetch
    const interval = setInterval(fetchData, 15000) // Refresh every 15 seconds
    return () => clearInterval(interval)
  }, [fetchData])

  // Timer effect for real-time countdown
  useEffect(() => {
    timerIntervalRef.current = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [])

  // Use centralized timezone utilities for proper UTC to local conversion
  const parseDateTime = parseServerDateTimeMs
  const formatTimer = formatTimerDisplay

  // Keyboard shortcuts for quick actions
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return
      }

      // Ctrl/Cmd + B for new booking
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        if (availableRooms.length > 0) {
          setBookingDialogOpen(true)
        }
      }

      // Ctrl/Cmd + O for new order
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        setOrderDialogOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [availableRooms.length])

  const handleAddCustomer = async () => {
    if (!newCustomerData.name || !newCustomerData.phone) {
      setError(dictionary?.customers?.namePhoneRequired || 'Name and phone are required')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await customerApi.create(newCustomerData)

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.customers?.customerAdded || 'Customer added successfully')
        setAddCustomerDialogOpen(false)
        
        // Refresh customers list
        await fetchData()
        
        // Reset form
        setNewCustomerData({ name: '', phone: '' })
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddInlineCustomer = async () => {
    if (!inlineCustomerData.name || !inlineCustomerData.phone) {
      setError(dictionary?.customers?.namePhoneRequired || 'Name and phone are required')
      return
    }

    try {
      setIsAddingInlineCustomer(true)
      const response = await customerApi.create(inlineCustomerData)

      if (response.status === 'success') {
        // Refresh customers list
        const customersRes = await customerApi.getAll()
        if (customersRes.status === 'success') {
          setCustomers(customersRes.data || [])
          // Auto-select the newly created customer
          const newCustomer = customersRes.data?.find(
            (c: Customer) => c.phone === inlineCustomerData.phone
          )
          if (newCustomer) {
            setSelectedBookingCustomer(newCustomer)
          }
        }
        
        // Reset inline form and hide it
        setInlineCustomerData({ name: '', phone: '' })
        setShowInlineCustomerForm(false)
        setSuccessMessage(dictionary?.customers?.customerAdded || 'Customer added successfully')
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsAddingInlineCustomer(false)
    }
  }

  const handleAddOrderInlineCustomer = async () => {
    if (!orderInlineCustomerData.name || !orderInlineCustomerData.phone) {
      setError(dictionary?.customers?.namePhoneRequired || 'Name and phone are required')
      return
    }

    try {
      setIsAddingOrderInlineCustomer(true)
      const response = await customerApi.create(orderInlineCustomerData)

      if (response.status === 'success') {
        // Refresh customers list
        const customersRes = await customerApi.getAll()
        if (customersRes.status === 'success') {
          setCustomers(customersRes.data || [])
          // Auto-select the newly created customer
          const newCustomer = customersRes.data?.find(
            (c: Customer) => c.phone === orderInlineCustomerData.phone
          )
          if (newCustomer) {
            setSelectedOrderCustomer(newCustomer)
          }
        }
        
        // Reset inline form and hide it
        setOrderInlineCustomerData({ name: '', phone: '' })
        setShowOrderInlineCustomerForm(false)
        setSuccessMessage(dictionary?.customers?.customerAdded || 'Customer added successfully')
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsAddingOrderInlineCustomer(false)
    }
  }

  const handleStartBooking = async () => {
    if (!selectedBookingCustomer) {
      setError(dictionary?.customers?.selectCustomer || 'Please select a customer')
      return
    }

    try {
      setIsSubmitting(true)
      
      const durationMinutes = bookingData.duration_minutes
      
      // Calculate started_at and finished_at if duration is set
      let startedAt = null
      let finishedAt = null
      if (durationMinutes > 0) {
        const startTime = new Date()
        const endTime = new Date()
        endTime.setMinutes(endTime.getMinutes() + durationMinutes)
        // Convert to UTC for server (server expects UTC)
        startedAt = toServerDateTime(startTime)
        finishedAt = toServerDateTime(endTime)
      }
      
      const response = await bookingApi.add({
        room_id: bookingData.room_id,
        ...(selectedBookingCustomer.id !== -1 && { customer_id: selectedBookingCustomer.id }),
        is_multi: bookingData.is_multi,
        discount: bookingData.discount,
        ...(startedAt && { started_at: startedAt }),
        ...(finishedAt && { finished_at: finishedAt })
      })

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.bookings?.bookingStarted || 'Booking started successfully')
        setBookingDialogOpen(false)
        setBookingData({ room_id: 0, customer_phone: '', customer_name: '', duration_minutes: 0, is_multi: 0, discount: 0 })
        setSelectedBookingCustomer(guestCustomer)
        fetchData()
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEndBooking = async () => {
    if (!selectedBooking) return

    try {
      setIsSubmitting(true)
      const response = await bookingApi.end(selectedBooking.id)

      if (response.status === 'success') {
        // Store the ended booking for receipt printing
        setLastEndedBooking({
          ...selectedBooking,
          price: response.data?.price || selectedBooking.estimated_price,
          finished_at: response.data?.finished_at || new Date().toISOString()
        })
        setSuccessMessage(dictionary?.bookings?.bookingEnded || 'Booking ended successfully')
        setEndBookingDialogOpen(false)
        setSelectedBooking(null)
        setShowReceiptDialog(true) // Show receipt dialog
        fetchData()
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateDiscount = async () => {
    if (!selectedBookingForDiscount) return

    try {
      setIsSubmitting(true)
      const response = await bookingApi.updateDiscount(selectedBookingForDiscount.id, newDiscount)

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.bookings?.discountUpdated || 'Discount updated successfully')
        setUpdateDiscountDialogOpen(false)
        setSelectedBookingForDiscount(null)
        setNewDiscount(0)
        fetchData()
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Open add order to booking dialog
  const handleOpenAddOrderToBooking = (booking: ActiveBooking) => {
    setSelectedBookingForOrder(booking)
    setBookingOrderItems([])
    setBookingOrderTab(0)
    setAddOrderToBookingDialogOpen(true)
  }

  // Get remaining stock for an item in booking order (stock - quantity already in order)
  const getRemainingStockForBookingOrder = (itemId: number): number => {
    const item = availableItems.find(i => i.id === itemId)
    if (!item) return 0
    const inOrder = bookingOrderItems.find(i => i.item_id === itemId)
    const quantityInOrder = inOrder ? inOrder.quantity : 0
    return Number(item.stock) - quantityInOrder
  }

  // Add item to booking order
  const addItemToBookingOrder = (item: CafeteriaItem) => {
    const remainingStock = getRemainingStockForBookingOrder(item.id)
    if (remainingStock <= 0) return // Don't add if no stock
    
    const existingItem = bookingOrderItems.find(i => i.item_id === item.id)
    if (existingItem) {
      setBookingOrderItems(bookingOrderItems.map(i =>
        i.item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i
      ))
    } else {
      setBookingOrderItems([
        ...bookingOrderItems,
        { item_id: item.id, name: item.name, price: Number(item.price), quantity: 1 }
      ])
    }
  }

  // Update booking order item quantity
  const updateBookingOrderItemQuantity = (itemId: number, quantity: number) => {
    if (quantity <= 0) {
      setBookingOrderItems(bookingOrderItems.filter(i => i.item_id !== itemId))
    } else {
      // Check if increasing and if stock allows
      const currentItem = bookingOrderItems.find(i => i.item_id === itemId)
      if (currentItem && quantity > currentItem.quantity) {
        const remainingStock = getRemainingStockForBookingOrder(itemId)
        if (remainingStock <= 0) return // Don't increase if no stock
      }
      setBookingOrderItems(bookingOrderItems.map(i =>
        i.item_id === itemId ? { ...i, quantity } : i
      ))
    }
  }

  // Calculate booking order total
  const bookingOrderTotal = bookingOrderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  // Create order linked to booking
  const handleCreateBookingOrder = async () => {
    if (!selectedBookingForOrder || bookingOrderItems.length === 0) {
      setError(dictionary?.orders?.addItemsFirst || 'Please add items to the order')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await orderApi.quick({
        customer_phone: selectedBookingForOrder.customer_phone || '0000000000',
        customer_name: selectedBookingForOrder.customer_name || (dictionary?.bookings?.guestCustomer || 'Guest'),
        items: bookingOrderItems.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity
        })),
        booking_id: selectedBookingForOrder.id
      })

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.orders?.orderCreated || 'Order created successfully')
        setAddOrderToBookingDialogOpen(false)
        setSelectedBookingForOrder(null)
        setBookingOrderItems([])
        fetchData()
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Format duration helper
  const formatDuration = (startTime: string, endTime?: string) => {
    const start = parseServerDateTimeMs(startTime)
    const end = endTime ? parseServerDateTimeMs(endTime) : Date.now()
    const diff = (end - start) / (1000 * 60 * 60) // hours
    return diff.toFixed(1)
  }

  // Print booking receipt with room hours and orders
  const printBookingReceipt = (booking: any) => {
    const dir = isRtl ? 'rtl' : 'ltr'
    const duration = formatDuration(booking.started_at || booking.start_time, booking.finished_at || booking.end_time)
    const durationText = Number(duration) < 1 
      ? `${Math.round(Number(duration) * 60)} ${dictionary?.common?.mins || 'mins'}`
      : `${Number(duration).toFixed(1)} ${dictionary?.common?.hours || 'hrs'}`
    
    const roomPrice = Number(booking.price || booking.estimated_price || 0)
    const ordersTotal = Number(booking.orders_total || 0)
    const grandTotal = roomPrice + ordersTotal
    
    // Labels
    const receiptLabel = dictionary?.orders?.receipt || 'Receipt'
    const bookingLabel = dictionary?.navigation?.bookings || 'Booking'
    const roomLabel = dictionary?.bookings?.room || 'Room'
    const customerLabel = dictionary?.bookings?.customer || 'Customer'
    const phoneLabel = dictionary?.customers?.phoneNumber || 'Phone'
    const startTimeLabel = dictionary?.bookings?.startTime || 'Start Time'
    const endTimeLabel = dictionary?.bookings?.endTime || 'End Time'
    const durationLabel = dictionary?.bookings?.duration || 'Duration'
    const roomDurationLabel = dictionary?.bookings?.roomDuration || 'Room Duration'
    const roomCostLabel = dictionary?.bookings?.roomCost || 'Room Cost'
    const ordersLabel = dictionary?.navigation?.orders || 'Orders'
    const itemLabel = dictionary?.orders?.item || 'Item'
    const qtyLabel = dictionary?.orders?.quantity || 'Qty'
    const priceLabel = dictionary?.common?.price || 'Price'
    const subtotalLabel = dictionary?.orders?.subtotal || 'Subtotal'
    const totalLabel = dictionary?.orders?.total || 'Total'
    const thankYouLabel = dictionary?.orders?.thankYou || 'Thank you!'
    const currency = dictionary?.common?.currency || 'EGP'
    
    const startTime = formatLocalTime(booking.started_at || booking.start_time, getLocaleForRtl(isRtl))
    const endTime = formatLocalTime(booking.finished_at || booking.end_time, getLocaleForRtl(isRtl))
    const bookingDate = formatLocalDate(booking.started_at || booking.start_time, getLocaleForRtl(isRtl))
    
    // Build orders HTML
    let ordersHtml = ''
    if (booking.orders && booking.orders.length > 0) {
      ordersHtml = `
        <div class="orders-section">
          <div class="section-title">${ordersLabel}</div>
          ${booking.orders.map((order: any) => `
            <div class="order-block">
              <div class="order-header">#${order.id} - ${formatLocalTime(order.created_at, getLocaleForRtl(isRtl))}</div>
              ${order.items?.map((item: any) => `
                <div class="item">
                  <span class="item-name">${item.item_name || item.name}</span>
                  <span class="item-qty">x${item.quantity || 1}</span>
                  <span class="item-price">${Number(item.total_price || item.unit_price * item.quantity || 0).toFixed(2)}</span>
                </div>
              `).join('') || ''}
              <div class="order-total">
                <span>${subtotalLabel}:</span>
                <span>${Number(order.total_amount || 0).toFixed(2)} ${currency}</span>
              </div>
            </div>
          `).join('')}
          <div class="orders-subtotal">
            <span>${ordersLabel} ${totalLabel}:</span>
            <span>${ordersTotal.toFixed(2)} ${currency}</span>
          </div>
        </div>
      `
    }
    
    const receiptContent = `<!DOCTYPE html>
<html dir="${dir}">
<head>
<meta charset="UTF-8">
<title>${receiptLabel} - ${booking.room_name}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: "Courier New", monospace; padding: 10mm; max-width: 80mm; margin: 0 auto; font-size: 12px; direction: ${dir}; }
.header { text-align: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #000; }
.header h1 { font-size: 18px; margin-bottom: 5px; }
.header p { font-size: 10px; color: #666; }
.info { margin: 10px 0; font-size: 11px; }
.info-row { display: flex; justify-content: space-between; margin: 4px 0; }
.section-title { font-weight: bold; font-size: 12px; margin: 10px 0 5px 0; padding: 5px 0; border-bottom: 1px dashed #000; }
.room-section { margin: 10px 0; padding: 10px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
.room-cost { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin: 5px 0; }
.orders-section { margin: 10px 0; }
.order-block { margin: 8px 0; padding: 8px 0; border-bottom: 1px dotted #ccc; }
.order-header { font-size: 10px; color: #666; margin-bottom: 5px; }
.item { display: flex; justify-content: space-between; margin: 3px 0; font-size: 11px; }
.item-name { flex: 1; }
.item-qty { width: 30px; text-align: center; }
.item-price { width: 50px; text-align: ${isRtl ? 'left' : 'right'}; }
.order-total { display: flex; justify-content: space-between; font-size: 11px; margin-top: 5px; padding-top: 5px; border-top: 1px dotted #ccc; }
.orders-subtotal { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin-top: 10px; padding-top: 5px; border-top: 1px dashed #000; }
.grand-total { margin-top: 15px; padding: 10px 0; border-top: 2px solid #000; border-bottom: 2px solid #000; }
.grand-total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; }
.footer { margin-top: 15px; text-align: center; font-size: 10px; color: #666; }
@media print { body { padding: 0; } @page { size: 80mm auto; margin: 5mm; } }
</style>
</head>
<body>
<div class="header">
<h1>X-Station</h1>
<p>${receiptLabel}</p>
</div>
<div class="info">
<div class="info-row"><span>${bookingLabel} #${booking.id}</span><span>${bookingDate}</span></div>
<div class="info-row"><span>${roomLabel}:</span><span>${booking.room_name}</span></div>
<div class="info-row"><span>${customerLabel}:</span><span>${booking.customer_name || (dictionary?.bookings?.guestCustomer || 'Guest')}</span></div>
<div class="info-row"><span>${phoneLabel}:</span><span>${booking.customer_phone || '-'}</span></div>
</div>
<div class="room-section">
<div class="section-title">${roomDurationLabel}</div>
<div class="info-row"><span>${startTimeLabel}:</span><span>${startTime}</span></div>
<div class="info-row"><span>${endTimeLabel}:</span><span>${endTime}</span></div>
<div class="info-row"><span>${durationLabel}:</span><span>${durationText}</span></div>
<div class="room-cost">
<span>${roomCostLabel}:</span>
<span>${roomPrice.toFixed(2)} ${currency}</span>
</div>
</div>
${ordersHtml}
<div class="grand-total">
<div class="grand-total-row">
<span>${totalLabel}:</span>
<span>${grandTotal.toFixed(2)} ${currency}</span>
</div>
</div>
<div class="footer">
<p>${thankYouLabel}</p>
<p style="margin-top: 5px;">${new Date().toLocaleDateString(getLocaleForRtl(isRtl))}</p>
</div>
</body>
</html>`

    // Use pywebview direct print API if available
    const pywebview = typeof window !== 'undefined' ? (window as any).pywebview : null
    
    if (pywebview?.api?.print_html_direct) {
      pywebview.api.print_html_direct(receiptContent)
    } else {
      // Fallback: use hidden iframe for printing (no popup)
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = 'none'
      iframe.srcdoc = receiptContent
      document.body.appendChild(iframe)
      
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print()
          setTimeout(() => document.body.removeChild(iframe), 1000)
        }, 300)
      }
    }
  }

  const handleCreateOrder = async () => {
    if (orderData.items.length === 0) {
      setError(dictionary?.orders?.addItemsFirst || 'Please add items to the order')
      return
    }

    if (!selectedOrderCustomer) {
      setError(dictionary?.customers?.selectCustomer || 'Please select a customer')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await orderApi.quick({
        customer_phone: selectedOrderCustomer.phone,
        customer_name: selectedOrderCustomer.name || undefined,
        items: orderData.items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity
        }))
      })

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.orders?.orderCreated || 'Order created successfully')
        setOrderDialogOpen(false)
        setOrderData({ customer_phone: '', customer_name: '', items: [] })
        setSelectedOrderCustomer(guestCustomer)
        fetchData()
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get remaining stock for an item in standalone order (stock - quantity already in order)
  const getRemainingStockForOrder = (itemId: number): number => {
    const item = availableItems.find(i => i.id === itemId)
    if (!item) return 0
    const inOrder = orderData.items.find(i => i.item_id === itemId)
    const quantityInOrder = inOrder ? inOrder.quantity : 0
    return Number(item.stock) - quantityInOrder
  }

  const addItemToOrder = (item: CafeteriaItem) => {
    const remainingStock = getRemainingStockForOrder(item.id)
    if (remainingStock <= 0) return // Don't add if no stock
    
    const existingItem = orderData.items.find(i => i.item_id === item.id)
    if (existingItem) {
      setOrderData({
        ...orderData,
        items: orderData.items.map(i =>
          i.item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      })
    } else {
      setOrderData({
        ...orderData,
        items: [
          ...orderData.items,
          { item_id: item.id, name: item.name, price: Number(item.price), quantity: 1 }
        ]
      })
    }
  }

  const updateItemQuantity = (itemId: number, quantity: number) => {
    if (quantity <= 0) {
      setOrderData({
        ...orderData,
        items: orderData.items.filter(i => i.item_id !== itemId)
      })
    } else {
      // Check if increasing and if stock allows
      const currentItem = orderData.items.find(i => i.item_id === itemId)
      if (currentItem && quantity > currentItem.quantity) {
        const remainingStock = getRemainingStockForOrder(itemId)
        if (remainingStock <= 0) return // Don't increase if no stock
      }
      setOrderData({
        ...orderData,
        items: orderData.items.map(i =>
          i.item_id === itemId ? { ...i, quantity } : i
        )
      })
    }
  }

  const orderTotal = orderData.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  if (isLoading && !data) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <CircularProgress />
      </div>
    )
  }

  return (
    <Grid container spacing={6}>
      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity='error' onClose={() => setError(null)} variant='filled'>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={5000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity='success' onClose={() => setSuccessMessage(null)} variant='filled'>
          {successMessage}
        </Alert>
      </Snackbar>

      {/* Quick Stats Banner */}
      <Grid size={{ xs: 12 }}>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <Card>
            <CardContent className='flex items-center gap-4 py-4'>
              <CustomAvatar variant='rounded' color='primary' skin='light' size={50}>
                <i className='tabler-door text-2xl' />
              </CustomAvatar>
              <div>
                <Typography variant='h5' fontWeight={700}>
                  {data?.rooms?.available || 0}/{data?.rooms?.total || 0}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.rooms?.available || 'Available Rooms'}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='flex items-center gap-4 py-4'>
              <CustomAvatar variant='rounded' color='warning' skin='light' size={50}>
                <i className='tabler-calendar-event text-2xl' />
              </CustomAvatar>
              <div>
                <Typography variant='h5' fontWeight={700}>
                  {data?.active_bookings?.length || 0}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.bookings?.activeBookings || 'Active Sessions'}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='flex items-center gap-4 py-4'>
              <CustomAvatar variant='rounded' color='success' skin='light' size={50}>
                <i className='tabler-currency-pound text-2xl' />
              </CustomAvatar>
              <div>
                <Typography variant='h5' fontWeight={700}>
                  {data?.today?.total_revenue?.toFixed(0) || '0'}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.dashboard?.todaysRevenue || "Today's Revenue (EGP)"}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='flex items-center gap-4 py-4'>
              <CustomAvatar variant='rounded' color='error' skin='light' size={50}>
                <i className='tabler-alert-triangle text-2xl' />
              </CustomAvatar>
              <div>
                <Typography variant='h5' fontWeight={700}>
                  {data?.stock_alerts?.low_stock_count || 0}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.frontDesk?.stockAlerts || 'Low Stock Items'}
                </Typography>
              </div>
            </CardContent>
          </Card>
        </div>
      </Grid>

      {/* Quick Actions */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader 
            title={
              <div className='flex items-center gap-2'>
                <i className='tabler-bolt text-2xl text-primary' />
                <Typography variant='h5' fontWeight={600}>
                  {dictionary?.frontDesk?.quickActions || 'Quick Actions'}
                </Typography>
              </div>
            }
            subheader={dictionary?.frontDesk?.quickActionsDesc || 'Fast access to bookings, orders, and customer management'}
          />
          <CardContent>
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
              <Button
                variant='contained'
                color='primary'
                size='large'
                fullWidth
                className='h-20'
                onClick={() => setBookingDialogOpen(true)}
                disabled={availableRooms.length === 0}
              >
                <div className='flex items-center gap-3 w-full'>
                  <i className='tabler-player-play text-2xl' />
                  <div className='flex flex-col items-start'>
                    <Typography variant='body1' fontWeight={600} color='inherit'>
                      {dictionary?.frontDesk?.startBooking || 'Start Booking'}
                    </Typography>
                    <Typography variant='caption' color='inherit' className='opacity-80'>
                      {availableRooms.length} {dictionary?.rooms?.available || 'rooms available'}
                    </Typography>
                  </div>
                </div>
              </Button>
              <Button
                variant='contained'
                color='warning'
                size='large'
                fullWidth
                className='h-20'
                onClick={() => setOrderDialogOpen(true)}
              >
                <div className='flex items-center gap-3 w-full'>
                  <i className='tabler-shopping-cart text-2xl' />
                  <div className='flex flex-col items-start'>
                    <Typography variant='body1' fontWeight={600} color='inherit'>
                      {dictionary?.frontDesk?.newOrder || 'New Order'}
                    </Typography>
                    <Typography variant='caption' color='inherit' className='opacity-80'>
                      {dictionary?.frontDesk?.quickOrder || 'Create order instantly'}
                    </Typography>
                  </div>
                </div>
              </Button>
              <Button
                variant='contained'
                color='success'
                size='large'
                fullWidth
                className='h-20'
                onClick={() => setAddCustomerDialogOpen(true)}
              >
                <div className='flex items-center gap-3 w-full'>
                  <i className='tabler-user-plus text-2xl' />
                  <div className='flex flex-col items-start'>
                    <Typography variant='body1' fontWeight={600} color='inherit'>
                      {dictionary?.customers?.addCustomer || 'Add Customer'}
                    </Typography>
                    <Typography variant='caption' color='inherit' className='opacity-80'>
                      {dictionary?.frontDesk?.newCustomer || 'Register new customer'}
                    </Typography>
                  </div>
                </div>
              </Button>
            </div>
            <Divider className='my-4' />
            <div className='flex flex-wrap gap-3 justify-center'>
              <Chip
                label={`Ctrl+B: ${dictionary?.bookings?.startBooking || 'New Booking'}`}
                size='small'
                variant='outlined'
                icon={<i className='tabler-keyboard' />}
              />
              <Chip
                label={`Ctrl+O: ${dictionary?.orders?.newOrder || 'New Order'}`}
                size='small'
                variant='outlined'
                icon={<i className='tabler-keyboard' />}
              />
            </div>
          </CardContent>
        </Card>
      </Grid>



      {/* Timers Overview */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title={dictionary?.frontDesk?.sessionTimers || 'Session Timers'} />
          <CardContent>
            {data?.active_bookings && data.active_bookings.length > 0 ? (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {data.active_bookings.map((booking: any) => (
                  <Card key={booking.id} variant='outlined' className='p-4'>
                    <div className='flex items-center justify-between mb-3'>
                      <div>
                        <Typography variant='h6' fontWeight={600}>
                          {booking.room_name}
                        </Typography>
                        <Typography variant='body2' color='text.secondary'>
                          {booking.customer_name}
                        </Typography>
                      </div>
                      <Chip
                        label={`${booking.current_duration_hours?.toFixed(1)}h`}
                        color='warning'
                        size='small'
                      />
                    </div>
                    
                    {booking.finished_at ? (
                      (() => {
                        // Calculate timer for scheduled bookings
                        const startTime = parseDateTime(booking.started_at)
                        const endTime = parseDateTime(booking.finished_at)
                        const totalSeconds = Math.floor((endTime - startTime) / 1000)
                        const elapsedSeconds = Math.floor((currentTime - startTime) / 1000)
                        const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds)
                        
                        // Progress: 0% at start, 100% when time is up
                        const progress = Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100))
                        const isCompleted = remainingSeconds === 0
                        const isAlmostDone = progress >= 80 && !isCompleted
                        const color = isCompleted ? '#4caf50' : isAlmostDone ? '#ff9800' : '#2196f3'
                        
                        return (
                          <div>
                            <div className='flex items-center justify-between mb-2'>
                              <Typography variant='body2' fontWeight={600} style={{ color }}>
                                {isCompleted ? dictionary?.bookings?.completed || 'Completed' : `${formatTimer(remainingSeconds)} ${dictionary?.bookings?.remaining || 'remaining'}`}
                              </Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {Math.round(progress)}%
                              </Typography>
                            </div>
                            <div 
                              className='w-full h-3 rounded-full overflow-hidden mb-2'
                              style={{ backgroundColor: `${color}20` }}
                            >
                              <div
                                className='h-full rounded-full transition-all duration-1000 ease-linear'
                                style={{ 
                                  width: `${progress}%`,
                                  backgroundColor: color
                                }}
                              />
                            </div>
                            <div className='flex justify-between'>
                              <Typography variant='caption' color='text.secondary'>
                                {formatLocalTime(booking.started_at)}
                              </Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {formatLocalTime(booking.finished_at)}
                              </Typography>
                            </div>
                          </div>
                        )
                      })()
                    ) : (
                      <div>
                        <div className='flex items-center gap-2 mb-2'>
                          <i className='tabler-infinity text-primary' />
                          <Typography variant='body2' color='primary' fontWeight={600}>
                            {dictionary?.bookings?.openSession || 'Open Session'}
                          </Typography>
                        </div>
                        <Typography variant='caption' color='text.secondary'>
                          {dictionary?.bookings?.startedAt || 'Started at'}: {formatLocalTime(booking.started_at)}
                        </Typography>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <div className='text-center py-8'>
                <i className='tabler-clock-off text-5xl text-textSecondary mb-3' />
                <Typography color='text.secondary'>
                  {dictionary?.timers?.noActiveTimers || 'No active timers'}
                </Typography>
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Active Bookings */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title={dictionary?.frontDesk?.activeSessionsTitle || 'Active Sessions'} />
          <CardContent>
            {data?.active_bookings && data.active_bookings.length > 0 ? (
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b'>
                      <th className='text-start p-2 text-sm'>{dictionary?.bookings?.room || 'Room'}</th>
                      <th className='text-start p-2 text-sm'>{dictionary?.bookings?.customer || 'Customer'}</th>
                      <th className='text-start p-2 text-sm'>{dictionary?.bookings?.duration || 'Duration'}</th>
                      <th className='text-start p-2 text-sm'>{dictionary?.bookings?.timer || 'Timer'}</th>
                      <th className='text-start p-2 text-sm'>{dictionary?.navigation?.orders || 'Orders'}</th>
                      <th className='text-start p-2 text-sm'>{dictionary?.bookings?.discount || 'Discount'}</th>
                      <th className='text-start p-2 text-sm'>{dictionary?.bookings?.estimatedPrice || 'Est. Price'}</th>
                      <th className='text-start p-2 text-sm'>{dictionary?.common?.actions || 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.active_bookings.map((booking: any) => (
                      <tr key={booking.id} className='border-b last:border-0'>
                        <td className='p-2'>
                          <div className='flex items-center gap-1'>
                            <i className='tabler-door text-base' />
                            <Typography variant='body2' fontWeight={500}>
                              {booking.room_name}
                            </Typography>
                          </div>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2'>{booking.customer_name}</Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {booking.customer_phone}
                          </Typography>
                        </td>
                        <td className='p-2'>
                          <Chip
                            label={`${booking.current_duration_hours?.toFixed(1)} ${dictionary?.common?.hours || 'hrs'}`}
                            color='warning'
                            variant='tonal'
                            size='small'
                          />
                        </td>
                        <td className='p-2'>
                          {booking.finished_at ? (
                            (() => {
                              // Calculate timer for scheduled bookings
                              const startTime = parseDateTime(booking.started_at)
                              const endTime = parseDateTime(booking.finished_at)
                              const totalSeconds = Math.floor((endTime - startTime) / 1000)
                              const elapsedSeconds = Math.floor((currentTime - startTime) / 1000)
                              const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds)
                              
                              // Progress: 0% at start, 100% when time is up
                              const progress = Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100))
                              const isCompleted = remainingSeconds === 0
                              const isAlmostDone = progress >= 80 && !isCompleted
                              const color = isCompleted ? '#4caf50' : isAlmostDone ? '#ff9800' : '#2196f3'
                              
                              if (isCompleted) {
                                return (
                                  <div className='min-w-[100px]'>
                                    <div className='flex items-center justify-between mb-1'>
                                      <Typography variant='caption' fontWeight={600} color='success.main'>
                                        {dictionary?.bookings?.completed || 'Done'}
                                      </Typography>
                                      <i className='tabler-check text-xs' style={{ color: '#4caf50' }} />
                                    </div>
                                    <div className='w-full h-1.5 rounded-full overflow-hidden bg-success/20'>
                                      <div className='h-full rounded-full bg-success' style={{ width: '100%' }} />
                                    </div>
                                  </div>
                                )
                              }
                              
                              return (
                                <div className='min-w-[100px]'>
                                  <div className='flex items-center justify-between mb-1'>
                                    <Typography variant='caption' fontWeight={600} style={{ color }}>
                                      {formatTimer(remainingSeconds)}
                                    </Typography>
                                    <i className='tabler-clock text-xs' style={{ color }} />
                                  </div>
                                  <div 
                                    className='w-full h-1.5 rounded-full overflow-hidden'
                                    style={{ backgroundColor: `${color}20` }}
                                  >
                                    <div
                                      className='h-full rounded-full transition-all duration-1000 ease-linear'
                                      style={{ 
                                        width: `${progress}%`,
                                        backgroundColor: color
                                      }}
                                    />
                                  </div>
                                </div>
                              )
                            })()
                          ) : (
                            <Chip
                              label={dictionary?.bookings?.openEnded || 'Open'}
                              color='primary'
                              variant='outlined'
                              size='small'
                              icon={<i className='tabler-infinity text-sm' />}
                            />
                          )}
                        </td>
                        <td className='p-3'>
                          {/* Orders linked to this booking */}
                          {booking.orders_count > 0 ? (
                            <div 
                              className='flex flex-col gap-1 items-start cursor-pointer'
                              onClick={() => {
                                setSelectedBookingOrders(booking)
                                setViewOrdersDialogOpen(true)
                              }}
                            >
                              <Chip
                                icon={<i className='tabler-shopping-cart text-sm' />}
                                label={`${booking.orders_count} ${dictionary?.navigation?.orders || 'orders'}`}
                                color='info'
                                size='small'
                                variant='outlined'
                                clickable
                              />
                              <Typography variant='caption' color='info.main' fontWeight={500}>
                                {Number(booking.orders_total || 0).toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                              </Typography>
                            </div>
                          ) : (
                            <Typography variant='caption' color='text.secondary'>
                              {dictionary?.orders?.noOrders || 'No orders'}
                            </Typography>
                          )}
                        </td>
                        <td className='p-3'>
                          {/* Discount if any */}
                          {Number(booking.discount) > 0 ? (
                            <div className='flex flex-col gap-0.5'>
                              <Typography variant='body2' fontWeight={500} color='error.main'>
                                -{Number(booking.discount).toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                              </Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {dictionary?.bookings?.discount || 'Discount'}
                              </Typography>
                              {(() => {
                                const basePrice = Number(booking.estimated_price || 0)
                                const priceAfterDiscount = Math.max(0, basePrice - Number(booking.discount))
                                return (
                                  <Typography variant='caption' fontWeight={600} color='success.main' sx={{ mt: 0.5 }}>
                                    {dictionary?.bookings?.afterDiscount || 'After'}: {priceAfterDiscount.toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                                  </Typography>
                                )
                              })()}
                            </div>
                          ) : (
                            <Typography variant='caption' color='text.secondary'>
                              {dictionary?.common?.no || 'No'} {dictionary?.bookings?.discount?.toLowerCase() || 'discount'}
                            </Typography>
                          )}
                        </td>
                        <td className='p-3'>
                          {(() => {
                            const basePrice = Number(booking.estimated_price || 0)
                            const discount = Number(booking.discount || 0)
                            const priceAfterDiscount = Math.max(0, basePrice - discount)
                            const ordersTotal = Number(booking.orders_total || 0)
                            const finalTotal = priceAfterDiscount + ordersTotal
                            
                            return (
                              <div className='flex flex-col gap-0.5'>
                                <Typography variant='body2' fontWeight={500} color='success.main'>
                                  {priceAfterDiscount.toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                                </Typography>
                                {ordersTotal > 0 && (
                                  <Typography variant='caption' color='info.main'>
                                    + {ordersTotal.toFixed(2)} {dictionary?.orders?.cafeteriaOrders || 'cafeteria'}
                                  </Typography>
                                )}
                                {ordersTotal > 0 && (
                                  <Typography variant='caption' fontWeight={600} color='primary.main'>
                                    = {finalTotal.toFixed(2)} {dictionary?.common?.total || 'total'}
                                  </Typography>
                                )}
                              </div>
                            )
                          })()}
                        </td>
                        <td className='p-3'>
                          <div className='flex gap-2'>
                            <Button
                              variant='contained'
                              color='error'
                              size='small'
                              onClick={() => {
                                setSelectedBooking(booking)
                                setEndBookingDialogOpen(true)
                              }}
                            >
                              {dictionary?.bookings?.endBooking || 'End'}
                            </Button>
                            <IconButton
                              size='small'
                              color='warning'
                              onClick={() => {
                                setSelectedBookingForDiscount(booking as ActiveBooking)
                                setNewDiscount(Number(booking.discount) || 0)
                                setUpdateDiscountDialogOpen(true)
                              }}
                              title={dictionary?.bookings?.updateDiscount || 'Update Discount'}
                            >
                              <i className='tabler-discount' />
                            </IconButton>
                            <IconButton
                              size='small'
                              color='info'
                              onClick={() => handleOpenAddOrderToBooking(booking as ActiveBooking)}
                              title={dictionary?.orders?.addOrderToBooking || 'Add Order'}
                            >
                              <i className='tabler-shopping-cart-plus' />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className='text-center py-8'>
                <i className='tabler-calendar-off text-5xl text-textSecondary mb-3' />
                <Typography color='text.secondary'>
                  {dictionary?.rooms?.noActiveBooking || 'No active bookings'}
                </Typography>
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Stock Alerts */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={dictionary?.frontDesk?.stockAlerts || 'Stock Alerts'}
            avatar={
              data?.stock_alerts?.low_stock_count ? (
                <Chip
                  label={data.stock_alerts.low_stock_count}
                  color='error'
                  size='small'
                />
              ) : null
            }
          />
          <CardContent>
            {data?.stock_alerts?.low_stock_items && data.stock_alerts.low_stock_items.length > 0 ? (
              <div className='flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2'>
                {data.stock_alerts.low_stock_items.map(item => (
                  <div
                    key={item.id}
                    className='flex items-center justify-between p-3 rounded-lg bg-errorLight'
                  >
                    <div className='flex items-center gap-3'>
                      <i className='tabler-alert-triangle text-error text-xl' />
                      <Typography variant='body2' fontWeight={500}>
                        {item.name}
                      </Typography>
                    </div>
                    <Chip
                      label={`${item.stock} ${dictionary?.common?.stock || 'left'}`}
                      color={item.stock === 0 ? 'error' : 'warning'}
                      size='small'
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-center py-8'>
                <i className='tabler-check-circle text-5xl text-success mb-3' />
                <Typography color='text.secondary'>
                  {dictionary?.cafeteria?.inStock || 'All items stocked'}
                </Typography>
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Recent Bookings - Last 10 completed bookings */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader 
            title={dictionary?.frontDesk?.recentBookings || 'Recent Bookings'}
            subheader={dictionary?.frontDesk?.last10Bookings || 'Last 10 completed bookings'}
            avatar={
              <Chip
                label={recentBookings.length}
                color='primary'
                size='small'
              />
            }
          />
          <CardContent>
            {recentBookings.length > 0 ? (
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b'>
                      <th className='text-start p-3'>#</th>
                      <th className='text-start p-3'>{dictionary?.bookings?.room || 'Room'}</th>
                      <th className='text-start p-3'>{dictionary?.bookings?.customer || 'Customer'}</th>
                      <th className='text-start p-3'>{dictionary?.bookings?.startTime || 'Start'}</th>
                      <th className='text-start p-3'>{dictionary?.bookings?.endTime || 'End'}</th>
                      <th className='text-start p-3'>{dictionary?.bookings?.duration || 'Duration'}</th>
                      <th className='text-start p-3'>{dictionary?.navigation?.orders || 'Orders'}</th>
                      <th className='text-start p-3'>{dictionary?.common?.price || 'Price'}</th>
                      <th className='text-start p-3'>{dictionary?.common?.actions || 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((booking: any, index: number) => {
                      const startTime = booking.started_at || booking.start_time
                      const endTime = booking.finished_at || booking.end_time
                      const duration = formatDuration(startTime, endTime)
                      const durationText = Number(duration) < 1 
                        ? `${Math.round(Number(duration) * 60)} ${dictionary?.common?.mins || 'mins'}`
                        : `${Number(duration).toFixed(1)} ${dictionary?.common?.hours || 'hrs'}`
                      
                      return (
                        <tr key={booking.id} className='border-b last:border-0 hover:bg-actionHover'>
                          <td className='p-3'>
                            <Typography variant='body2' color='text.secondary'>
                              {booking.id}
                            </Typography>
                          </td>
                          <td className='p-3'>
                            <div className='flex items-center gap-2'>
                              <i className='tabler-door text-lg text-primary' />
                              <Typography variant='body2' fontWeight={500}>
                                {booking.room_name}
                              </Typography>
                            </div>
                          </td>
                          <td className='p-3'>
                            <Typography variant='body2'>{booking.customer_name || (dictionary?.bookings?.guestCustomer || 'Guest')}</Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {booking.customer_phone || '-'}
                            </Typography>
                          </td>
                          <td className='p-3'>
                            <Typography variant='body2'>
                              {formatLocalTime(startTime, getLocaleForRtl(isRtl))}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {formatLocalDate(startTime, getLocaleForRtl(isRtl))}
                            </Typography>
                          </td>
                          <td className='p-3'>
                            <Typography variant='body2'>
                              {formatLocalTime(endTime, getLocaleForRtl(isRtl))}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {formatLocalDate(endTime, getLocaleForRtl(isRtl))}
                            </Typography>
                          </td>
                          <td className='p-3'>
                            <Chip
                              label={durationText}
                              color='info'
                              variant='tonal'
                              size='small'
                            />
                          </td>
                          <td className='p-3'>
                            {/* Orders linked to this booking */}
                            {booking.orders_count > 0 ? (
                              <Button
                                size='small'
                                variant='outlined'
                                color='info'
                                startIcon={<i className='tabler-shopping-cart text-sm' />}
                                onClick={() => {
                                  setSelectedBookingOrders(booking)
                                  setViewOrdersDialogOpen(true)
                                }}
                              >
                                {isRtl ? toArabicDigits(booking.orders_count.toString()) : booking.orders_count} ({isRtl ? toArabicDigits(Number(booking.orders_total || 0).toFixed(2)) : Number(booking.orders_total || 0).toFixed(2)})
                              </Button>
                            ) : (
                              <Typography variant='caption' color='text.secondary'>-</Typography>
                            )}
                          </td>
                          <td className='p-3'>
                            <div className='flex flex-col gap-0.5'>
                              <Typography variant='body2' color='success.main' fontWeight={500}>
                                {Number(booking.price || booking.total_price || 0).toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                              </Typography>
                              {Number(booking.orders_total) > 0 && (
                                <Typography variant='caption' fontWeight={500} color='primary.main'>
                                  {dictionary?.common?.total || 'Total'}: {(Number(booking.price || booking.total_price || 0) + Number(booking.orders_total || 0)).toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                                </Typography>
                              )}
                            </div>
                          </td>
                          <td className='p-3'>
                            <IconButton
                              size='small'
                              color='primary'
                              onClick={() => printBookingReceipt({
                                ...booking,
                                price: booking.price || booking.total_price || 0,
                                started_at: startTime,
                                finished_at: endTime
                              })}
                              title={dictionary?.orders?.printReceipt || 'Print Receipt'}
                            >
                              <i className='tabler-printer' />
                            </IconButton>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className='text-center py-8'>
                <i className='tabler-history-off text-5xl text-textSecondary mb-3' />
                <Typography color='text.secondary'>
                  {dictionary?.bookings?.noRecentBookings || 'No recent bookings'}
                </Typography>
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Start Booking Dialog */}
      <Dialog open={bookingDialogOpen} onClose={() => {
        setBookingDialogOpen(false)
        setShowInlineCustomerForm(false)
        setInlineCustomerData({ name: '', phone: '' })
      }} maxWidth='sm' fullWidth>
        <DialogTitle>{dictionary?.bookings?.startBooking || 'Start Booking'}</DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 pt-2'>
            <CustomTextField
              select
              label={dictionary?.bookings?.selectDuration || 'Select Duration'}
              value={bookingData.duration_minutes}
              onChange={e => setBookingData({ ...bookingData, duration_minutes: Number(e.target.value) })}
              fullWidth
              helperText={dictionary?.bookings?.durationHelperText || 'Select a timer or leave open-ended'}
              SelectProps={{
                MenuProps: {
                  PaperProps: {
                    style: { maxHeight: 250 }
                  }
                }
              }}
            >
              <MenuItem value={0}>
                <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <i className='tabler-infinity' />
                  {dictionary?.bookings?.openEnded || 'Open-ended (no timer)'}
                </div>
              </MenuItem>
              {/* Generate time options from 10 min to 3 hours in 10 min increments */}
              {Array.from({ length: 18 }, (_, i) => (i + 1) * 10).map(minutes => {
                const hours = Math.floor(minutes / 60)
                const mins = minutes % 60
                let label = ''
                if (hours === 0) {
                  label = `${isRtl ? toArabicDigits(minutes.toString()) : minutes} ${dictionary?.common?.minutes || 'minutes'}`
                } else if (mins === 0) {
                  label = `${isRtl ? toArabicDigits(hours.toString()) : hours} ${hours === 1 ? dictionary?.common?.hour || 'hour' : dictionary?.common?.hours || 'hours'}`
                } else {
                  label = `${isRtl ? toArabicDigits(hours.toString()) : hours}:${isRtl ? toArabicDigits(mins.toString().padStart(2, '0')) : mins.toString().padStart(2, '0')} ${dictionary?.common?.hours || 'hours'}`
                }
                return (
                  <MenuItem key={minutes} value={minutes}>
                    <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <i className='tabler-clock' />
                      {label}
                    </div>
                  </MenuItem>
                )
              })}
            </CustomTextField>

            <CustomTextField
              select
              label={dictionary?.bookings?.selectRoom || 'Select Room'}
              value={bookingData.room_id}
              onChange={e => setBookingData({ ...bookingData, room_id: Number(e.target.value) })}
              fullWidth
              required
              helperText={dictionary?.bookings?.onlyAvailableRooms || 'Only currently available rooms'}
              SelectProps={{
                MenuProps: {
                  PaperProps: {
                    style: { maxHeight: 250 }
                  }
                }
              }}
            >
              {availableRooms.map(room => {
                const hourCost = isRtl ? toArabicDigits(room.hour_cost.toString()) : room.hour_cost
                const multiCost = room.multi_hour_cost && Number(room.multi_hour_cost) > 0 
                  ? (isRtl ? toArabicDigits(room.multi_hour_cost.toString()) : room.multi_hour_cost) 
                  : null
                const currency = dictionary?.common?.currency || 'EGP'
                const singleLabel = dictionary?.bookings?.single || 'Single'
                const multiLabel = dictionary?.bookings?.multi || 'Multi'
                const priceInfo = multiCost 
                  ? `${singleLabel}: ${hourCost} | ${multiLabel}: ${multiCost} ${currency}`
                  : `${singleLabel}: ${hourCost} ${currency}`
                
                return (
                  <MenuItem key={room.id} value={room.id}>
                    {`${room.name} - ${room.ps} (${priceInfo})`}
                  </MenuItem>
                )
              })}
            </CustomTextField>
            
            {!showInlineCustomerForm ? (
              <Autocomplete
                options={[guestCustomer, ...customers]}
                getOptionLabel={(option) => option.id === -1 ? (dictionary?.bookings?.guestCustomer || 'Guest') : `${option.name} - ${option.phone}`}
                value={selectedBookingCustomer}
                onChange={(_, newValue) => setSelectedBookingCustomer(newValue || guestCustomer)}
                renderInput={(params) => (
                  <CustomTextField
                    {...params}
                    label={dictionary?.customers?.selectCustomer || 'Select Customer'}
                    placeholder={dictionary?.customers?.searchByNameOrPhone || 'Search by name or phone'}
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <div className='flex items-center gap-2'>
                      <i className={option.id === -1 ? 'tabler-user-question' : 'tabler-user'} />
                      <div className='flex flex-col'>
                        <Typography variant='body2' fontWeight={500}>
                          {option.id === -1 ? (dictionary?.bookings?.guestCustomer || 'Guest') : option.name}
                        </Typography>
                        {option.id !== -1 && (
                          <Typography variant='caption' color='text.secondary'>
                            {option.phone}
                          </Typography>
                        )}
                      </div>
                    </div>
                  </li>
                )}
                fullWidth
                isOptionEqualToValue={(option, value) => option.id === value.id}
              />
            ) : (
              <Card variant='outlined' className='border-success'>
                <CardContent className='p-3'>
                  <div className='flex items-center justify-between mb-3'>
                    <Typography variant='subtitle2' color='success.main' fontWeight={600}>
                      <i className='tabler-user-plus mr-2' />
                      {dictionary?.frontDesk?.quickAddCustomer || 'Quick Add Customer'}
                    </Typography>
                    <IconButton size='small' onClick={() => {
                      setShowInlineCustomerForm(false)
                      setInlineCustomerData({ name: '', phone: '' })
                    }}>
                      <i className='tabler-x text-sm' />
                    </IconButton>
                  </div>
                  <div className='flex flex-col gap-3'>
                    <CustomTextField
                      label={dictionary?.customers?.customerName || 'Customer Name'}
                      value={inlineCustomerData.name}
                      onChange={e => setInlineCustomerData({ ...inlineCustomerData, name: e.target.value })}
                      fullWidth
                      size='small'
                      placeholder='John Doe'
                      autoFocus
                    />
                    <CustomTextField
                      label={dictionary?.customers?.phoneNumber || 'Phone Number'}
                      value={inlineCustomerData.phone}
                      onChange={e => setInlineCustomerData({ ...inlineCustomerData, phone: e.target.value })}
                      fullWidth
                      size='small'
                      placeholder='+201234567890'
                    />
                    <Button
                      variant='contained'
                      color='success'
                      size='small'
                      onClick={handleAddInlineCustomer}
                      disabled={isAddingInlineCustomer || !inlineCustomerData.name || !inlineCustomerData.phone}
                      startIcon={isAddingInlineCustomer ? <CircularProgress size={16} /> : <i className='tabler-check' />}
                    >
                      {dictionary?.frontDesk?.addAndSelect || 'Add & Select'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <FormControl component="fieldset">
              <FormLabel component="legend">
                {dictionary?.bookings?.bookingType || 'Booking Type'}
              </FormLabel>
              <RadioGroup
                row
                value={bookingData.is_multi}
                onChange={e => setBookingData({ ...bookingData, is_multi: Number(e.target.value) })}
              >
                <FormControlLabel
                  value={0}
                  control={<Radio />}
                  label={dictionary?.bookings?.single || 'Single Player'}
                />
                <FormControlLabel
                  value={1}
                  control={<Radio />}
                  label={dictionary?.bookings?.multi || 'Multi Player'}
                />
              </RadioGroup>
            </FormControl>

            <CustomTextField
              type="number"
              label={dictionary?.bookings?.discount || 'Discount'}
              value={bookingData.discount}
              onChange={e => setBookingData({ ...bookingData, discount: Number(e.target.value) })}
              fullWidth
              helperText={dictionary?.bookings?.discountHelperText || 'Discount amount in EGP (not percentage)'}
              InputProps={{
                startAdornment: <InputAdornment position="start">{dictionary?.common?.currency || 'EGP'}</InputAdornment>,
                inputProps: { min: 0, step: 0.01 }
              }}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBookingDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          {!showInlineCustomerForm && (
            <Button
              variant='outlined'
              color='success'
              onClick={() => setShowInlineCustomerForm(true)}
              startIcon={<i className='tabler-user-plus' />}
            >
              {dictionary?.frontDesk?.newCustomer || 'New Customer'}
            </Button>
          )}
          <Button
            variant='contained'
            onClick={handleStartBooking}
            disabled={isSubmitting || !bookingData.room_id || !selectedBookingCustomer}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.bookings?.startBooking || 'Start'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={addCustomerDialogOpen} onClose={() => setAddCustomerDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{dictionary?.customers?.addCustomer || 'Add New Customer'}</DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 pt-2'>
            <CustomTextField
              label={dictionary?.customers?.customerName || 'Customer Name'}
              value={newCustomerData.name}
              onChange={e => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
              fullWidth
              required
              placeholder='John Doe'
            />
            <CustomTextField
              label={dictionary?.customers?.phoneNumber || 'Phone Number'}
              value={newCustomerData.phone}
              onChange={e => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
              fullWidth
              required
              placeholder='+201234567890'
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddCustomerDialogOpen(false)
            setNewCustomerData({ name: '', phone: '' })
          }} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            onClick={handleAddCustomer}
            disabled={isSubmitting || !newCustomerData.name || !newCustomerData.phone}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.customers?.addCustomer || 'Add Customer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* End Booking Dialog */}
      <Dialog open={endBookingDialogOpen} onClose={() => setEndBookingDialogOpen(false)}>
        <DialogTitle>{dictionary?.bookings?.endBooking || 'End Booking'}</DialogTitle>
        <DialogContent>
          {selectedBooking && (
            <div className='flex flex-col gap-3 pt-2'>
              <Typography>{dictionary?.bookings?.confirmEnd}</Typography>
              <Card variant='outlined'>
                <CardContent>
                  <Typography variant='subtitle2' fontWeight={600}>
                    {selectedBooking.room_name}
                  </Typography>
                  <Typography variant='body2'>{selectedBooking.customer_name}</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {selectedBooking.current_duration_hours?.toFixed(1)} {dictionary?.common?.hours || 'hours'}
                  </Typography>
                  <Typography variant='h5' color='success.main' className='mt-2'>
                    ~{selectedBooking.estimated_price?.toFixed(2)} EGP
                  </Typography>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEndBookingDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button variant='contained' color='error' onClick={handleEndBooking} disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.bookings?.endBooking || 'End'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Update Discount Dialog */}
      <Dialog open={updateDiscountDialogOpen} onClose={() => setUpdateDiscountDialogOpen(false)} maxWidth='sm' fullWidth dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogTitle className={isRtl ? 'text-right' : ''}>
          {dictionary?.bookings?.updateDiscount || 'Update Discount'}
        </DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 pt-2'>
            <div className={`flex items-center gap-3 p-3 rounded-lg bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <i className='tabler-door text-2xl text-primary' />
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='subtitle1' fontWeight={600}>
                  {selectedBookingForDiscount?.room_name}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {selectedBookingForDiscount?.customer_name} • {selectedBookingForDiscount?.customer_phone}
                </Typography>
              </div>
            </div>

            <div className={`p-3 rounded-lg border ${isRtl ? 'text-right' : ''}`}>
              <Typography variant='caption' color='text.secondary' className='block mb-1'>
                {dictionary?.bookings?.currentDiscount || 'Current Discount'}
              </Typography>
              <Typography variant='h6' color='error.main'>
                {isRtl ? toArabicDigits(Number(selectedBookingForDiscount?.discount || 0).toFixed(2)) : Number(selectedBookingForDiscount?.discount || 0).toFixed(2)} {dictionary?.common?.currency || 'EGP'}
              </Typography>
            </div>

            <CustomTextField
              type="number"
              label={dictionary?.bookings?.newDiscount || 'New Discount'}
              value={newDiscount}
              onChange={e => setNewDiscount(Number(e.target.value))}
              fullWidth
              helperText={dictionary?.bookings?.discountHelperText || 'Discount amount in EGP (not percentage)'}
              InputProps={{
                startAdornment: isRtl ? undefined : <InputAdornment position="start">{dictionary?.common?.currency || 'EGP'}</InputAdornment>,
                endAdornment: isRtl ? <InputAdornment position="end">{dictionary?.common?.currency || 'EGP'}</InputAdornment> : undefined,
                inputProps: { min: 0, step: 0.01 }
              }}
            />
          </div>
        </DialogContent>
        <DialogActions className={isRtl ? 'flex-row-reverse justify-start gap-3' : 'gap-3'}>
          <Button onClick={() => setUpdateDiscountDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            color='warning'
            onClick={handleUpdateDiscount}
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : <i className='tabler-discount-check' />}
          >
            {dictionary?.common?.update || 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Order Dialog */}
      <Dialog open={orderDialogOpen} onClose={() => {
        setOrderDialogOpen(false)
        setShowOrderInlineCustomerForm(false)
        setOrderInlineCustomerData({ name: '', phone: '' })
      }} maxWidth='md' fullWidth>
        <DialogTitle>{dictionary?.orders?.newOrder || 'New Order'}</DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 pt-2'>
            {!showOrderInlineCustomerForm ? (
              <Autocomplete
                options={[guestCustomer, ...customers]}
                getOptionLabel={(option) => option.id === -1 ? (dictionary?.bookings?.guestCustomer || 'Guest') : `${option.name} - ${option.phone}`}
                value={selectedOrderCustomer}
                onChange={(_, newValue) => setSelectedOrderCustomer(newValue || guestCustomer)}
                renderInput={(params) => (
                  <CustomTextField
                    {...params}
                    label={dictionary?.customers?.selectCustomer || 'Select Customer'}
                    placeholder={dictionary?.customers?.searchByNameOrPhone || 'Search by name or phone'}
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <div className='flex items-center gap-2'>
                      <i className={option.id === -1 ? 'tabler-user-question' : 'tabler-user'} />
                      <div className='flex flex-col'>
                        <Typography variant='body2' fontWeight={500}>
                          {option.id === -1 ? (dictionary?.bookings?.guestCustomer || 'Guest') : option.name}
                        </Typography>
                        {option.id !== -1 && (
                          <Typography variant='caption' color='text.secondary'>
                            {option.phone}
                          </Typography>
                        )}
                      </div>
                    </div>
                  </li>
                )}
                fullWidth
                isOptionEqualToValue={(option, value) => option.id === value.id}
              />
            ) : (
              <Card variant='outlined' className='border-success'>
                <CardContent className='p-3'>
                  <div className='flex items-center justify-between mb-3'>
                    <Typography variant='subtitle2' color='success.main' fontWeight={600}>
                      <i className='tabler-user-plus mr-2' />
                      {dictionary?.frontDesk?.quickAddCustomer || 'Quick Add Customer'}
                    </Typography>
                    <IconButton size='small' onClick={() => {
                      setShowOrderInlineCustomerForm(false)
                      setOrderInlineCustomerData({ name: '', phone: '' })
                    }}>
                      <i className='tabler-x text-sm' />
                    </IconButton>
                  </div>
                  <div className='flex flex-col gap-3'>
                    <CustomTextField
                      label={dictionary?.customers?.customerName || 'Customer Name'}
                      value={orderInlineCustomerData.name}
                      onChange={e => setOrderInlineCustomerData({ ...orderInlineCustomerData, name: e.target.value })}
                      fullWidth
                      size='small'
                      placeholder='John Doe'
                      autoFocus
                    />
                    <CustomTextField
                      label={dictionary?.customers?.phoneNumber || 'Phone Number'}
                      value={orderInlineCustomerData.phone}
                      onChange={e => setOrderInlineCustomerData({ ...orderInlineCustomerData, phone: e.target.value })}
                      fullWidth
                      size='small'
                      placeholder='+201234567890'
                    />
                    <Button
                      variant='contained'
                      color='success'
                      size='small'
                      onClick={handleAddOrderInlineCustomer}
                      disabled={isAddingOrderInlineCustomer || !orderInlineCustomerData.name || !orderInlineCustomerData.phone}
                      startIcon={isAddingOrderInlineCustomer ? <CircularProgress size={16} /> : <i className='tabler-check' />}
                    >
                      {dictionary?.frontDesk?.addAndSelect || 'Add & Select'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Divider />

            <Box>
              <Tabs value={orderTab} onChange={(_, v) => setOrderTab(v)}>
                <Tab label={dictionary?.orders?.selectItems || 'Select Items'} />
                <Tab label={`${dictionary?.orders?.orderItems || 'Order'} (${orderData.items.length})`} />
              </Tabs>

              <Box className='mt-4'>
                {orderTab === 0 && (
                  <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto'>
                    {availableItems.map(item => {
                      const remainingStock = getRemainingStockForOrder(item.id)
                      const isOutOfStock = remainingStock <= 0
                      return (
                        <Card
                          key={item.id}
                          variant='outlined'
                          className={`transition-colors ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'}`}
                          onClick={() => !isOutOfStock && addItemToOrder(item)}
                        >
                          <CardContent className='p-3'>
                            <Typography variant='body2' fontWeight={500} noWrap>
                              {item.name}
                            </Typography>
                            <div className='flex justify-between items-center mt-1'>
                              <Typography variant='caption' color='success.main'>
                                {item.price} EGP
                              </Typography>
                              <Typography variant='caption' color={isOutOfStock ? 'error.main' : 'text.secondary'}>
                                {remainingStock} {dictionary?.common?.stock || 'in stock'}
                              </Typography>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}

                {orderTab === 1 && (
                  <div>
                    {orderData.items.length > 0 ? (
                      <div className='flex flex-col gap-3'>
                        {orderData.items.map(item => (
                          <div
                            key={item.item_id}
                            className='flex items-center justify-between p-3 border rounded-lg'
                          >
                            <div>
                              <Typography variant='body2' fontWeight={500}>
                                {item.name}
                              </Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {item.price} EGP x {item.quantity} = {(item.price * item.quantity).toFixed(2)} EGP
                              </Typography>
                            </div>
                            <div className='flex items-center gap-2'>
                              <IconButton
                                size='small'
                                onClick={() => updateItemQuantity(item.item_id, item.quantity - 1)}
                              >
                                <i className='tabler-minus text-sm' />
                              </IconButton>
                              <Typography variant='body2' className='w-8 text-center'>
                                {item.quantity}
                              </Typography>
                              <IconButton
                                size='small'
                                onClick={() => updateItemQuantity(item.item_id, item.quantity + 1)}
                                disabled={getRemainingStockForOrder(item.item_id) <= 0}
                              >
                                <i className='tabler-plus text-sm' />
                              </IconButton>
                            </div>
                          </div>
                        ))}
                        <Divider />
                        <div className='flex justify-between items-center'>
                          <Typography variant='h6'>
                            {dictionary?.orders?.total || 'Total'}
                          </Typography>
                          <Typography variant='h5' color='success.main'>
                            {orderTotal.toFixed(2)} EGP
                          </Typography>
                        </div>
                      </div>
                    ) : (
                      <Typography color='text.secondary' className='text-center py-8'>
                        {dictionary?.orders?.addItemsFirst || 'Add items to the order'}
                      </Typography>
                    )}
                  </div>
                )}
              </Box>
            </Box>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrderDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          {!showOrderInlineCustomerForm && (
            <Button
              variant='outlined'
              color='success'
              onClick={() => setShowOrderInlineCustomerForm(true)}
              startIcon={<i className='tabler-user-plus' />}
            >
              {dictionary?.frontDesk?.newCustomer || 'New Customer'}
            </Button>
          )}
          <Button
            variant='contained'
            onClick={handleCreateOrder}
            disabled={isSubmitting || orderData.items.length === 0 || !selectedOrderCustomer}
          >
            {isSubmitting ? (
              <CircularProgress size={20} />
            ) : (
              `${dictionary?.orders?.addOrder || 'Create Order'} (${orderTotal.toFixed(2)} EGP)`
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Order to Booking Dialog */}
      <Dialog open={addOrderToBookingDialogOpen} onClose={() => setAddOrderToBookingDialogOpen(false)} maxWidth='md' fullWidth dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogTitle className={isRtl ? 'text-right' : ''}>
          <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <i className='tabler-shopping-cart-plus' />
            {dictionary?.orders?.addOrderToBooking || 'Add Order'} - {selectedBookingForOrder?.room_name}
          </div>
        </DialogTitle>
        <DialogContent>
          {selectedBookingForOrder && (
            <div className='flex flex-col gap-4 pt-2'>
              {/* Booking Info */}
              <Card variant='outlined'>
                <CardContent className={`p-3 ${isRtl ? 'text-right' : ''}`}>
                  <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className='rounded-lg p-2 bg-primary/10'>
                      <i className='tabler-door text-primary text-lg' />
                    </div>
                    <div>
                      <Typography variant='subtitle2' fontWeight={600}>
                        {selectedBookingForOrder.room_name}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {selectedBookingForOrder.customer_name || (dictionary?.bookings?.guestCustomer || 'Guest')}
                      </Typography>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Divider />

              <Box>
                <Tabs value={bookingOrderTab} onChange={(_, v) => setBookingOrderTab(v)}>
                  <Tab label={dictionary?.orders?.selectItems || 'Select Items'} />
                  <Tab label={`${dictionary?.orders?.orderItems || 'Order'} (${bookingOrderItems.length})`} />
                </Tabs>

                <Box className='mt-4'>
                  {bookingOrderTab === 0 && (
                    <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto'>
                      {availableItems.length > 0 ? (
                        availableItems.map(item => {
                          const remainingStock = getRemainingStockForBookingOrder(item.id)
                          const isOutOfStock = remainingStock <= 0
                          return (
                            <Card
                              key={item.id}
                              variant='outlined'
                              className={`transition-colors ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'}`}
                              onClick={() => !isOutOfStock && addItemToBookingOrder(item)}
                            >
                              <CardContent className='p-3'>
                                <Typography variant='body2' fontWeight={500} noWrap>
                                  {item.name}
                                </Typography>
                                <div className={`flex justify-between items-center mt-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                                  <Typography variant='caption' color='success.main'>
                                    {isRtl ? toArabicDigits(String(item.price)) : item.price} {dictionary?.common?.currency || 'EGP'}
                                  </Typography>
                                  <Typography variant='caption' color={isOutOfStock ? 'error.main' : 'text.secondary'}>
                                    {isRtl ? toArabicDigits(String(remainingStock)) : remainingStock} {dictionary?.common?.inStock || 'left'}
                                  </Typography>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })
                      ) : (
                        <div className='col-span-3 text-center py-8'>
                          <CircularProgress size={24} />
                          <Typography color='text.secondary' className='mt-2'>
                            {dictionary?.common?.loading || 'Loading...'}
                          </Typography>
                        </div>
                      )}
                    </div>
                  )}

                  {bookingOrderTab === 1 && (
                    <div>
                      {bookingOrderItems.length > 0 ? (
                        <div className='flex flex-col gap-3'>
                          {bookingOrderItems.map(item => (
                            <div
                              key={item.item_id}
                              className={`flex items-center justify-between p-3 border rounded-lg ${isRtl ? 'flex-row-reverse' : ''}`}
                            >
                              <div className={isRtl ? 'text-right' : ''}>
                                <Typography variant='body2' fontWeight={500}>
                                  {item.name}
                                </Typography>
                                <Typography variant='caption' color='text.secondary'>
                                  {isRtl ? toArabicDigits(String(item.price)) : item.price} {dictionary?.common?.currency || 'EGP'} x {isRtl ? toArabicDigits(String(item.quantity)) : item.quantity} = {isRtl ? toArabicDigits((item.price * item.quantity).toFixed(2)) : (item.price * item.quantity).toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                                </Typography>
                              </div>
                              <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                                <IconButton
                                  size='small'
                                  onClick={() => updateBookingOrderItemQuantity(item.item_id, item.quantity - 1)}
                                >
                                  <i className='tabler-minus text-sm' />
                                </IconButton>
                                <Typography variant='body2' className='w-8 text-center'>
                                  {isRtl ? toArabicDigits(String(item.quantity)) : item.quantity}
                                </Typography>
                                <IconButton
                                  size='small'
                                  onClick={() => updateBookingOrderItemQuantity(item.item_id, item.quantity + 1)}
                                  disabled={getRemainingStockForBookingOrder(item.item_id) <= 0}
                                >
                                  <i className='tabler-plus text-sm' />
                                </IconButton>
                              </div>
                            </div>
                          ))}
                          <Divider />
                          <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                            <Typography variant='h6'>
                              {dictionary?.orders?.total || 'Total'}
                            </Typography>
                            <Typography variant='h5' color='success.main'>
                              {isRtl ? toArabicDigits(bookingOrderTotal.toFixed(2)) : bookingOrderTotal.toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                            </Typography>
                          </div>
                        </div>
                      ) : (
                        <Typography color='text.secondary' className='text-center py-8'>
                          {dictionary?.orders?.addItemsFirst || 'Add items to the order'}
                        </Typography>
                      )}
                    </div>
                  )}
                </Box>
              </Box>
            </div>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 1 }}>
          <Button onClick={() => setAddOrderToBookingDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            startIcon={<i className='tabler-shopping-cart-check' />}
            onClick={handleCreateBookingOrder}
            disabled={isSubmitting || bookingOrderItems.length === 0}
          >
            {isSubmitting ? (
              <CircularProgress size={20} />
            ) : (
              `${dictionary?.orders?.createOrder || 'Create Order'} (${isRtl ? toArabicDigits(bookingOrderTotal.toFixed(2)) : bookingOrderTotal.toFixed(2)} ${dictionary?.common?.currency || 'EGP'})`
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Orders Dialog */}
      <Dialog open={viewOrdersDialogOpen} onClose={() => setViewOrdersDialogOpen(false)} maxWidth='md' fullWidth dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogTitle className={isRtl ? 'text-right' : ''}>
          <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <i className='tabler-shopping-cart' />
            {dictionary?.orders?.orderDetails || 'Order Details'} - {selectedBookingOrders?.room_name}
          </div>
        </DialogTitle>
        <DialogContent>
          {selectedBookingOrders && (
            <div className='flex flex-col gap-4 pt-2'>
              {/* Booking Summary */}
              <Card variant='outlined'>
                <CardContent className='p-3'>
                  <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <div className='rounded-lg p-2 bg-primary/10'>
                        <i className='tabler-door text-primary text-lg' />
                      </div>
                      <div className={isRtl ? 'text-right' : ''}>
                        <Typography variant='subtitle2' fontWeight={600}>
                          {selectedBookingOrders.room_name}
                        </Typography>
                        <Typography variant='body2' color='text.secondary'>
                          {selectedBookingOrders.customer_name || (dictionary?.bookings?.guestCustomer || 'Guest')}
                        </Typography>
                      </div>
                    </div>
                    <div className={isRtl ? 'text-left' : 'text-right'}>
                      <Typography variant='h6' color='info.main'>
                        {isRtl ? toArabicDigits(selectedBookingOrders.orders_count?.toString() || '0') : selectedBookingOrders.orders_count} {dictionary?.navigation?.orders || 'orders'}
                      </Typography>
                      <Typography variant='body2' color='success.main' fontWeight={600}>
                        {isRtl ? toArabicDigits(Number(selectedBookingOrders.orders_total || 0).toFixed(2)) : Number(selectedBookingOrders.orders_total || 0).toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                      </Typography>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Orders List */}
              <div className='flex flex-col gap-3 max-h-[400px] overflow-y-auto'>
                {selectedBookingOrders.orders?.map((order: any, orderIndex: number) => (
                  <Card key={order.id} variant='outlined'>
                    <CardContent className='p-3'>
                      {/* Order Header */}
                      <div className={`flex items-center justify-between mb-3 pb-2 border-b ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <Chip 
                            label={`#${isRtl ? toArabicDigits(order.id.toString()) : order.id}`} 
                            size='small' 
                            color='primary' 
                            variant='outlined'
                          />
                          <Typography variant='caption' color='text.secondary'>
                            {formatLocalTime(order.created_at, getLocaleForRtl(isRtl))}
                          </Typography>
                        </div>
                        <Typography variant='subtitle2' color='success.main' fontWeight={600}>
                          {isRtl ? toArabicDigits(Number(order.total_amount || 0).toFixed(2)) : Number(order.total_amount || 0).toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                        </Typography>
                      </div>

                      {/* Order Items */}
                      <div className='flex flex-col gap-2'>
                        {order.items?.map((item: any, itemIndex: number) => (
                          <div 
                            key={`${order.id}-${item.item_id || itemIndex}`}
                            className={`flex items-center justify-between py-1 ${isRtl ? 'flex-row-reverse' : ''}`}
                          >
                            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                              <div className='w-6 h-6 rounded bg-actionHover flex items-center justify-center'>
                                <Typography variant='caption' fontWeight={500}>
                                  {isRtl ? toArabicDigits(item.quantity?.toString() || '1') : item.quantity || 1}x
                                </Typography>
                              </div>
                              <Typography variant='body2'>
                                {item.item_name || item.name}
                              </Typography>
                            </div>
                            <Typography variant='body2' color='text.secondary'>
                              {isRtl ? toArabicDigits(Number(item.total_price || item.unit_price * item.quantity || 0).toFixed(2)) : Number(item.total_price || item.unit_price * item.quantity || 0).toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                            </Typography>
                          </div>
                        ))}
                      </div>

                      {/* Discount if any */}
                      {Number(order.discount) > 0 && (
                        <div className={`flex items-center justify-between mt-2 pt-2 border-t ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <Typography variant='caption' color='error.main'>
                            {dictionary?.common?.discount || 'Discount'}
                          </Typography>
                          <Typography variant='caption' color='error.main'>
                            -{isRtl ? toArabicDigits(Number(order.discount || 0).toFixed(2)) : Number(order.discount || 0).toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                          </Typography>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Grand Total */}
              {selectedBookingOrders.orders?.length > 0 && (
                <Card variant='outlined' sx={{ bgcolor: 'success.lighter' }}>
                  <CardContent className='p-3'>
                    <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <Typography variant='subtitle1' fontWeight={600}>
                        {dictionary?.orders?.total || 'Total'}
                      </Typography>
                      <Typography variant='h5' color='success.main' fontWeight={700}>
                        {isRtl ? toArabicDigits(Number(selectedBookingOrders.orders_total || 0).toFixed(2)) : Number(selectedBookingOrders.orders_total || 0).toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                      </Typography>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* No orders message */}
              {(!selectedBookingOrders.orders || selectedBookingOrders.orders.length === 0) && (
                <div className='text-center py-8'>
                  <i className='tabler-shopping-cart-off text-4xl text-textSecondary mb-2' />
                  <Typography color='text.secondary'>
                    {dictionary?.orders?.noOrders || 'No orders for this booking'}
                  </Typography>
                </div>
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions className={isRtl ? 'flex-row-reverse justify-start' : ''}>
          <Button onClick={() => setViewOrdersDialogOpen(false)}>
            {dictionary?.common?.close || 'Close'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Receipt Dialog - shown after ending a booking */}
      <Dialog open={showReceiptDialog} onClose={() => setShowReceiptDialog(false)} dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogTitle className={isRtl ? 'text-right' : ''}>
          <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <i className='tabler-check-circle text-success' />
            {dictionary?.bookings?.bookingEnded || 'Booking Ended'}
          </div>
        </DialogTitle>
        <DialogContent>
          {lastEndedBooking && (
            <div className='flex flex-col gap-3 pt-2'>
              <Alert severity='success'>
                {dictionary?.bookings?.bookingEndedSuccess || 'The booking has been ended successfully.'}
              </Alert>
              <Card variant='outlined'>
                <CardContent>
                  <Typography variant='subtitle2' fontWeight={600}>
                    {lastEndedBooking.room_name}
                  </Typography>
                  <Typography variant='body2'>{lastEndedBooking.customer_name}</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {lastEndedBooking.current_duration_hours?.toFixed(1)} {dictionary?.common?.hours || 'hours'}
                  </Typography>
                  <Divider className='my-2' />
                  <div className='flex flex-col gap-1'>
                    <div className={`flex justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <Typography variant='body2' color='text.secondary'>
                        {dictionary?.bookings?.roomCost || 'Room Cost'}:
                      </Typography>
                      <Typography variant='body2' fontWeight={500}>
                        {(lastEndedBooking.price || lastEndedBooking.estimated_price || 0).toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                      </Typography>
                    </div>
                    {Number(lastEndedBooking.orders_total) > 0 && (
                      <div className={`flex justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <Typography variant='body2' color='text.secondary'>
                          {dictionary?.navigation?.orders || 'Orders'}:
                        </Typography>
                        <Typography variant='body2' fontWeight={500}>
                          {Number(lastEndedBooking.orders_total || 0).toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                        </Typography>
                      </div>
                    )}
                  </div>
                  <Divider className='my-2' />
                  <div className={`flex justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <Typography variant='h6'>
                      {dictionary?.orders?.total || 'Total'}:
                    </Typography>
                    <Typography variant='h5' color='success.main'>
                      {(Number(lastEndedBooking.price || lastEndedBooking.estimated_price || 0) + Number(lastEndedBooking.orders_total || 0)).toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                    </Typography>
                  </div>
                </CardContent>
              </Card>
              <Typography variant='body2' color='text.secondary' className={isRtl ? 'text-right' : ''}>
                {dictionary?.orders?.wouldYouLikeToPrint || 'Would you like to print a receipt?'}
              </Typography>
            </div>
          )}
        </DialogContent>
        <DialogActions className={isRtl ? 'flex-row-reverse justify-start' : ''}>
          <Button onClick={() => {
            setShowReceiptDialog(false)
            setLastEndedBooking(null)
          }}>
            {dictionary?.common?.close || 'Close'}
          </Button>
          <Button
            variant='contained'
            startIcon={<i className='tabler-printer' />}
            onClick={() => {
              if (lastEndedBooking) {
                printBookingReceipt(lastEndedBooking)
              }
              setShowReceiptDialog(false)
              setLastEndedBooking(null)
            }}
          >
            {dictionary?.orders?.printReceipt || 'Print Receipt'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default FrontDesk