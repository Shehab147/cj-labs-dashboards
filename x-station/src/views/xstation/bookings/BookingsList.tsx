'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import InputAdornment from '@mui/material/InputAdornment'
import Autocomplete from '@mui/material/Autocomplete'
import TablePagination from '@mui/material/TablePagination'

import { bookingApi, roomApi, customerApi, cafeteriaApi, orderApi } from '@/services/api'
import type { Booking, Room, ActiveBooking, Customer, CafeteriaItem } from '@/types/xstation'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import CustomTextField from '@core/components/mui/TextField'
import { useAuth } from '@/contexts/authContext'
import { i18n } from '@configs/i18n'
import type { Locale } from '@configs/i18n'
import { parseServerDateTimeMs, formatLocalTime, formatLocalDate, formatTimerDisplay, getLocaleForRtl, toServerDateTime } from '@/utils/timezone'

interface BookingsListProps {
  dictionary: any
}

interface OrderItem {
  item_id: number
  name: string
  price: number
  quantity: number
}

// Helper function to convert digits to Arabic numerals
const toArabicDigits = (str: string): string => {
  return str.replace(/\d/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)])
}

const BookingsList = ({ dictionary }: BookingsListProps) => {
  const { admin } = useAuth()
  const isSuperadmin = admin?.role === 'superadmin'
  
  // Get locale for RTL support
  const params = useParams()
  const locale = (params?.lang as Locale) || i18n.defaultLocale
  const isRtl = i18n.langDirection[locale] === 'rtl'

  const [bookings, setBookings] = useState<Booking[]>([])
  const [activeBookings, setActiveBookings] = useState<ActiveBooking[]>([])
  const [availableRooms, setAvailableRooms] = useState<Room[]>([])
  const [allRooms, setAllRooms] = useState<Room[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter states
  const [statusFilter, setStatusFilter] = useState('active')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination states
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(5)

  // Dialog states
  const [startBookingDialogOpen, setStartBookingDialogOpen] = useState(false)
  const [endBookingDialogOpen, setEndBookingDialogOpen] = useState(false)
  const [switchRoomDialogOpen, setSwitchRoomDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<ActiveBooking | null>(null)

  // Form states
  const [newBooking, setNewBooking] = useState({
    room_id: 0,
    customer_id: -1, // -1 = Guest (default)
    duration_minutes: 0 // 0 = open-ended, 30, 60, 90 minutes
  })
  const [newRoomId, setNewRoomId] = useState(0)

  // Order Dialog states
  const [addOrderDialogOpen, setAddOrderDialogOpen] = useState(false)
  const [selectedBookingForOrder, setSelectedBookingForOrder] = useState<ActiveBooking | null>(null)
  const [availableItems, setAvailableItems] = useState<CafeteriaItem[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [orderTab, setOrderTab] = useState(0)

  // View Orders Dialog states
  const [viewOrdersDialogOpen, setViewOrdersDialogOpen] = useState(false)
  const [selectedBookingOrders, setSelectedBookingOrders] = useState<any>(null)

  // Timer states for countdown (now based on server finished_at)
  const [timers, setTimers] = useState<{ [bookingId: number]: number }>({}) // remaining seconds
  const [clientTimers, setClientTimers] = useState<{ [bookingId: number]: { endTime: number; totalSeconds: number } }>({}) // Fallback client-side timers
  const processedEndingsRef = useRef<Set<number>>(new Set()) // Track bookings we've already tried to end
  const [isMounted, setIsMounted] = useState(false) // Track if component is fully mounted
  const [currentTime, setCurrentTime] = useState(Date.now()) // For real-time timer updates

  // Load client timers from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('xstation_client_timers')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Clean up expired timers
        const now = Date.now()
        const cleaned: { [key: number]: { endTime: number; totalSeconds: number } } = {}
        Object.entries(parsed).forEach(([key, value]: [string, any]) => {
          if (value.endTime > now) {
            cleaned[Number(key)] = value
          }
        })
        setClientTimers(cleaned)
      }
    } catch (e) {
      console.error('Failed to load client timers:', e)
    }
  }, [])

  // Save client timers to localStorage
  useEffect(() => {
    try {
      if (Object.keys(clientTimers).length > 0) {
        localStorage.setItem('xstation_client_timers', JSON.stringify(clientTimers))
      } else {
        localStorage.removeItem('xstation_client_timers')
      }
    } catch (e) {
      console.error('Failed to save client timers:', e)
    }
  }, [clientTimers])

  const fetchData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true)
      const [bookingsRes, activeRes, availableRoomsRes, allRoomsRes, customersRes] = await Promise.all([
        bookingApi.getAll(),
        bookingApi.getActive(),
        roomApi.getAvailable(),
        roomApi.list(),
        customerApi.list()
      ])

      if (bookingsRes.status === 'success') {
        // API returns { data: { bookings: [...], summary: {...} } }
        setBookings(bookingsRes.data?.bookings || bookingsRes.data || [])
      }
      if (activeRes.status === 'success') {
        setActiveBookings(activeRes.data as ActiveBooking[] || [])
        // Clear processed endings for bookings that are no longer active
        const activeIds = new Set((activeRes.data as ActiveBooking[] || []).map(b => b.id))
        processedEndingsRef.current.forEach(id => {
          if (!activeIds.has(id)) {
            processedEndingsRef.current.delete(id)
          }
        })
      }
      if (availableRoomsRes.status === 'success') {
        setAvailableRooms(availableRoomsRes.data || [])
      }
      if (allRoomsRes.status === 'success') {
        setAllRooms(allRoomsRes.data || [])
      }
      if (customersRes.status === 'success') {
        setCustomers(customersRes.data || [])
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [dictionary])

  useEffect(() => {
    fetchData()
    // Mark as mounted after initial data fetch
    const timer = setTimeout(() => setIsMounted(true), 2000) // Give 2 seconds grace period
    
    // Refresh data every 2 seconds (silent - no loading spinner)
    const refreshInterval = setInterval(() => {
      fetchData(false)
    }, 2000)
    
    return () => {
      clearTimeout(timer)
      clearInterval(refreshInterval)
    }
  }, [fetchData])

  // Initialize timers for active bookings based on server finished_at or client timers
  useEffect(() => {
    const activeBookingIds = activeBookings.map(b => b.id)
    
    // Clean up client timers for bookings that are no longer active
    const clientTimerIds = Object.keys(clientTimers).map(Number)
    const expiredClientTimers = clientTimerIds.filter(id => !activeBookingIds.includes(id))
    if (expiredClientTimers.length > 0) {
      setClientTimers(prev => {
        const updated = { ...prev }
        expiredClientTimers.forEach(id => delete updated[id])
        return updated
      })
    }
    
    setTimers(prev => {
      const updated = { ...prev }
      
      // Remove timers for bookings that are no longer active
      Object.keys(updated).forEach(key => {
        const id = Number(key)
        if (!activeBookingIds.includes(id)) {
          delete updated[id]
        }
      })
      
      // Add timers for active bookings (only if timer doesn't exist yet - don't reset countdown in progress)
      activeBookings.forEach(booking => {
        // Skip if timer already exists (let it continue counting down)
        if (updated[booking.id] !== undefined) {
          return
        }
        
        // Priority 1: Use server finished_at if available
        if (booking.finished_at) {
          const endTime = parseServerDateTimeMs(booking.finished_at)
          const now = Date.now()
          const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
          updated[booking.id] = remaining
        } 
        // Priority 2: Use client-side timer as fallback
        else if (clientTimers[booking.id]) {
          const { endTime } = clientTimers[booking.id]
          const now = Date.now()
          const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
          updated[booking.id] = remaining
        }
      })
      
      return updated
    })
  }, [activeBookings, clientTimers])

  // Countdown timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const updated = { ...prev }
        let hasChanges = false
        Object.keys(updated).forEach(key => {
          const id = Number(key)
          if (updated[id] > 0) {
            updated[id] = updated[id] - 1
            hasChanges = true
          }
        })
        return hasChanges ? updated : prev
      })
      // Update current time for real-time progress calculation
      setCurrentTime(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Auto-end booking when timer reaches 0
  useEffect(() => {
    // Don't auto-end during initial mount/refresh
    if (!isMounted) return
    
    Object.entries(timers).forEach(([bookingId, remaining]) => {
      const id = Number(bookingId)
      
      // Skip if already processed or remaining time > 0
      if (remaining > 0 || processedEndingsRef.current.has(id)) {
        return
      }
      
      const booking = activeBookings.find(b => b.id === id)
      if (!booking) {
        return
      }
      
      // Check if the time has actually passed (either server or client timer)
      let shouldEnd = false
      
      if (booking.finished_at) {
        const endTime = parseServerDateTimeMs(booking.finished_at)
        const now = Date.now()
        shouldEnd = now >= endTime
      } else if (clientTimers[id]) {
        const { endTime } = clientTimers[id]
        const now = Date.now()
        shouldEnd = now >= endTime
      }
      
      if (!shouldEnd) {
        return // Not yet time to end
      }
      
      // Mark as processed to prevent duplicate calls
      processedEndingsRef.current.add(id)
      
      // Remove from timers immediately
      setTimers(prev => {
        const updated = { ...prev }
        delete updated[id]
        return updated
      })
      setClientTimers(prev => {
        const updated = { ...prev }
        delete updated[id]
        return updated
      })

      // Auto-end the booking using timerUpdate
      // Get the finished_at time from either server or client timer
      let finishedAt: string | null = null
      if (booking.finished_at) {
        finishedAt = booking.finished_at
      } else if (clientTimers[id]) {
        const endDate = new Date(clientTimers[id].endTime)
        finishedAt = endDate.toISOString().slice(0, 19).replace('T', ' ')
      }
      
      if (finishedAt) {
        bookingApi.timerUpdate(id, finishedAt).then(response => {
          if (response.status === 'success') {
            setSuccessMessage(dictionary?.bookings?.bookingAutoEnded || 'Booking ended automatically')
            fetchData()
          }
          // Clear from processed after API call completes
          processedEndingsRef.current.delete(id)
        }).catch(() => {
          processedEndingsRef.current.delete(id)
        })
      } else {
        processedEndingsRef.current.delete(id)
      }
    })
  }, [timers, activeBookings, clientTimers, dictionary, fetchData, isMounted])

  const handleStartBooking = async () => {
    try {
      setIsSubmitting(true)
      const isGuest = newBooking.customer_id === -1 || newBooking.customer_id === 0
      const selectedCustomer = isGuest ? null : customers.find(c => c.id === newBooking.customer_id)
      
      // Use selected customer or default "Guest" data
      const customerName = isGuest ? (dictionary?.bookings?.guestCustomer || 'Guest') : (selectedCustomer?.name || 'Guest')
      const customerPhone = isGuest ? '0000000000' : (selectedCustomer?.phone || '0000000000')

      const durationMinutes = newBooking.duration_minutes
      
      // Calculate started_at and finished_at if duration is set
      let startedAt = null
      let finishedAt = null
      let clientEndTime = null
      if (durationMinutes > 0) {
        const startTime = new Date()
        const endTime = new Date()
        endTime.setMinutes(endTime.getMinutes() + durationMinutes)
        // Convert to UTC for server (server expects UTC)
        startedAt = toServerDateTime(startTime)
        finishedAt = toServerDateTime(endTime)
        clientEndTime = endTime.getTime()
      }
      
      // Use quickStart with started_at and finished_at if timed booking
      const response = await bookingApi.quickStart({
        room_id: newBooking.room_id,
        customer_phone: customerPhone,
        customer_name: customerName,
        ...(startedAt && { started_at: startedAt }),
        ...(finishedAt && { finished_at: finishedAt })
      })

      if (response.status === 'success') {
        // Store client-side timer as fallback (in case API doesn't return finished_at yet)
        if (durationMinutes > 0 && response.data?.booking_id && clientEndTime) {
          const totalSeconds = durationMinutes * 60
          setClientTimers(prev => ({
            ...prev,
            [response.data.booking_id]: { endTime: clientEndTime, totalSeconds }
          }))
        }
        
        setSuccessMessage(dictionary?.bookings?.bookingStarted || 'Booking started successfully')
        setStartBookingDialogOpen(false)
        setNewBooking({ room_id: 0, customer_id: -1, duration_minutes: 0 })
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
      const bookingId = selectedBooking.id
      const response = await bookingApi.end(bookingId)

      if (response.status === 'success') {
        // Clean up timer state for this booking
        setTimers(prev => {
          const updated = { ...prev }
          delete updated[bookingId]
          return updated
        })
        setClientTimers(prev => {
          const updated = { ...prev }
          delete updated[bookingId]
          return updated
        })
        
        setSuccessMessage(dictionary?.bookings?.bookingEnded || 'Booking ended successfully')
        setEndBookingDialogOpen(false)
        setSelectedBooking(null)
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

  const handleSwitchRoom = async () => {
    if (!selectedBooking || !newRoomId) return

    try {
      setIsSubmitting(true)
      const response = await bookingApi.switchRoom(selectedBooking.id, newRoomId)

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.bookings?.roomSwitched || 'Room switched successfully')
        setSwitchRoomDialogOpen(false)
        setSelectedBooking(null)
        setNewRoomId(0)
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

  // Fetch cafeteria items for order dialog
  const fetchCafeteriaItems = useCallback(async () => {
    try {
      const response = await cafeteriaApi.getAvailable()
      if (response.status === 'success') {
        setAvailableItems(response.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch cafeteria items:', err)
    }
  }, [])

  // Open add order dialog
  const handleOpenAddOrder = (booking: ActiveBooking) => {
    setSelectedBookingForOrder(booking)
    setOrderItems([])
    setOrderTab(0)
    fetchCafeteriaItems()
    setAddOrderDialogOpen(true)
  }

  // Add item to order
  const addItemToOrder = (item: CafeteriaItem) => {
    const existingItem = orderItems.find(i => i.item_id === item.id)
    if (existingItem) {
      setOrderItems(orderItems.map(i =>
        i.item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i
      ))
    } else {
      setOrderItems([
        ...orderItems,
        { item_id: item.id, name: item.name, price: Number(item.price), quantity: 1 }
      ])
    }
  }

  // Update item quantity
  const updateItemQuantity = (itemId: number, quantity: number) => {
    if (quantity <= 0) {
      setOrderItems(orderItems.filter(i => i.item_id !== itemId))
    } else {
      setOrderItems(orderItems.map(i =>
        i.item_id === itemId ? { ...i, quantity } : i
      ))
    }
  }

  // Calculate order total
  const orderTotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  // Create order linked to booking
  const handleCreateBookingOrder = async () => {
    if (!selectedBookingForOrder || orderItems.length === 0) {
      setError(dictionary?.orders?.addItemsFirst || 'Please add items to the order')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await orderApi.quick({
        customer_phone: selectedBookingForOrder.customer_phone || '0000000000',
        customer_name: selectedBookingForOrder.customer_name || (dictionary?.bookings?.guestCustomer || 'Guest'),
        items: orderItems.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity
        })),
        booking_id: selectedBookingForOrder.id
      })

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.orders?.orderCreated || 'Order created successfully')
        setAddOrderDialogOpen(false)
        setSelectedBookingForOrder(null)
        setOrderItems([])
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'warning'
      case 'completed':
        return 'success'
      case 'cancelled':
        return 'error'
      default:
        return 'default'
    }
  }

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = parseServerDateTimeMs(startTime)
    const end = endTime ? parseServerDateTimeMs(endTime) : Date.now()
    const diff = (end - start) / (1000 * 60 * 60) // hours
    return diff.toFixed(1)
  }

  const formatTimer = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    // Format numbers based on locale
    const formatNum = (num: number, pad = false) => {
      const str = pad ? num.toString().padStart(2, '0') : num.toString()
      return isRtl ? toArabicDigits(str) : str
    }
    
    if (hrs > 0) {
      return `${formatNum(hrs)}:${formatNum(mins, true)}:${formatNum(secs, true)}`
    }
    return `${formatNum(mins)}:${formatNum(secs, true)}`
  }

  // Print booking receipt with room hours and orders
  const printBookingReceipt = (booking: any) => {
    const dir = isRtl ? 'rtl' : 'ltr'
    const duration = formatDuration(booking.started_at || booking.start_time, booking.finished_at || booking.end_time)
    const durationText = Number(duration) < 1 
      ? `${Math.round(Number(duration) * 60)} ${dictionary?.common?.mins || 'mins'}`
      : `${Number(duration).toFixed(1)} ${dictionary?.common?.hours || 'hrs'}`
    
    const roomPrice = Number(booking.price || booking.total_price || 0)
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

    // Use pywebview print API if available
    const pywebview = typeof window !== 'undefined' ? (window as any).pywebview : null
    
    if (pywebview?.api?.print_html) {
      pywebview.api.print_html(receiptContent)
    } else {
      // Fallback: Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=400,height=600')
      if (printWindow) {
        printWindow.document.write(receiptContent)
        printWindow.document.close()
        printWindow.onload = () => {
          printWindow.print()
        }
        // Trigger print after a short delay as fallback
        setTimeout(() => {
          printWindow.print()
        }, 500)
      }
    }
  }

  // Use centralized timezone utilities for proper UTC to local conversion
  const parseDateTime = parseServerDateTimeMs

  const displayBookings = statusFilter === 'active' ? activeBookings : bookings

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <CircularProgress />
      </div>
    )
  }

  return (
    <Grid container spacing={6} dir={isRtl ? 'rtl' : 'ltr'}>
      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          severity='error' 
          onClose={() => setError(null)}
          variant='filled'
          sx={{ 
            overflow: 'hidden',
            '& .MuiAlert-message': { overflow: 'hidden', textOverflow: 'ellipsis' }
          }}
        >
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={5000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          severity='success' 
          onClose={() => setSuccessMessage(null)}
          variant='filled'
          sx={{ 
            overflow: 'hidden',
            '& .MuiAlert-message': { overflow: 'hidden', textOverflow: 'ellipsis' }
          }}
        >
          {successMessage}
        </Alert>
      </Snackbar>

      {/* Header */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={dictionary?.navigation?.bookings || 'Bookings'}
            action={
              <Button
                variant='contained'
                startIcon={<i className='tabler-plus' />}
                onClick={() => setStartBookingDialogOpen(true)}
                disabled={availableRooms.length === 0}
              >
                {dictionary?.bookings?.startBooking || 'Start Booking'}
              </Button>
            }
          />
          <CardContent>
            <div className={`flex flex-wrap gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomTextField
                select
                label={dictionary?.common?.status || 'Status'}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className='min-w-[150px]'
              >
                <MenuItem value='active'>{dictionary?.bookings?.activeBookings || 'Active'}</MenuItem>
                <MenuItem value='today'>{dictionary?.bookings?.todaysBookings || "Today's"}</MenuItem>
              </CustomTextField>
              <CustomTextField
                label={dictionary?.common?.search || 'Search'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={dictionary?.customers?.customerName || 'Customer name'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position={isRtl ? 'end' : 'start'}>
                      <i className='tabler-search' />
                    </InputAdornment>
                  )
                }}
              />
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Active Bookings Summary */}
      {statusFilter === 'active' && (
        <Grid size={{ xs: 12 }}>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
            <Card variant='outlined'>
              <CardContent className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className='rounded-lg p-3 bg-primary'>
                  <i className={`tabler-door-enter text-white text-2xl ${isRtl ? 'scale-x-[-1]' : ''}`} />
                </div>
                <div className={isRtl ? 'text-right' : ''}>
                  <Typography variant='h5'>{isRtl ? toArabicDigits(activeBookings.length.toString()) : activeBookings.length}</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {dictionary?.bookings?.activeBookings || 'Active Bookings'}
                  </Typography>
                </div>
              </CardContent>
            </Card>
            <Card variant='outlined'>
              <CardContent className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className='rounded-lg p-3 bg-success'>
                  <i className='tabler-door text-white text-2xl' />
                </div>
                <div className={isRtl ? 'text-right' : ''}>
                  <Typography variant='h5'>{isRtl ? toArabicDigits(availableRooms.length.toString()) : availableRooms.length}</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {dictionary?.rooms?.available || 'Available Rooms'}
                  </Typography>
                </div>
              </CardContent>
            </Card>
          </div>
        </Grid>
      )}

      {/* Bookings Table */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            {displayBookings.length > 0 ? (
              <div className='overflow-x-auto'>
                <table className='w-full' dir={isRtl ? 'rtl' : 'ltr'}>
                  <thead>
                    <tr className='border-b'>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.room || 'Room'}</th>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.customer || 'Customer'}</th>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.common?.type || 'Type'}</th>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.startTime || 'Start Time'}</th>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.duration || 'Duration'}</th>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.timer || 'Timer'}</th>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.navigation?.orders || 'Orders'}</th>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.price || 'Price'}</th>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.common?.actions || 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(displayBookings as any[])
                      .filter(b =>
                        !searchQuery ||
                        b.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        b.room_name?.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((booking: any) => {
                        const isActive = statusFilter === 'active' || booking.status === 'active'
                        const isPending = booking.status === 'pending'
                        const isScheduled = booking.booking_type === 'scheduled'
                        const duration = isActive 
                          ? (booking.current_duration_hours || booking.elapsed_hours || 0)
                          : formatDuration(booking.started_at || booking.start_time, booking.finished_at || booking.end_time)
                        
                        return (
                          <tr key={booking.id} className='border-b last:border-0'>
                            <td className='p-3'>
                              <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                                <i className='tabler-door text-lg' />
                                <Typography variant='body2' fontWeight={500}>
                                  {booking.room_name}
                                </Typography>
                              </div>
                            </td>
                            <td className='p-3'>
                              <Typography variant='body2'>{booking.customer_name}</Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {booking.customer_phone}
                              </Typography>
                            </td>
                            <td className='p-3'>
                              <div className='flex flex-col gap-1'>
                                <Chip
                                  label={isScheduled ? (dictionary?.bookings?.scheduled || 'Scheduled') : (dictionary?.bookings?.open || 'Open')}
                                  color={isScheduled ? 'info' : 'primary'}
                                  size='small'
                                  variant='outlined'
                                />
                                {isPending && (
                                  <Chip
                                    label={dictionary?.bookings?.pending || 'Pending'}
                                    color='warning'
                                    size='small'
                                    variant='outlined'
                                  />
                                )}
                              </div>
                            </td>
                            <td className='p-3'>
                              <Typography variant='body2'>
                                {formatLocalTime(booking.started_at || booking.start_time, getLocaleForRtl(isRtl))}
                              </Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {formatLocalDate(booking.started_at || booking.start_time, getLocaleForRtl(isRtl))}
                              </Typography>
                            </td>
                            <td className='p-3'>
                              <Chip
                                label={typeof duration === 'number' 
                                  ? (duration < 1 
                                    ? (duration === 0 
                                      ? (dictionary?.bookings?.justStarted || 'Just started')
                                      : `${isRtl ? toArabicDigits(Math.round(duration * 60).toString()) : Math.round(duration * 60)} ${dictionary?.common?.mins || 'mins'}`)
                                    : `${isRtl ? toArabicDigits(duration.toFixed(1)) : duration.toFixed(1)} ${dictionary?.common?.hours || 'hrs'}`)
                                  : `${isRtl ? toArabicDigits(duration.toString()) : duration} ${dictionary?.common?.hours || 'hrs'}`}
                                color={isActive ? 'warning' : 'default'}
                                variant={isActive ? 'filled' : 'outlined'}
                                size='small'
                              />
                              {isScheduled && booking.remaining_hours && (
                                <Typography variant='caption' color='text.secondary' className='block mt-1'>
                                  {isRtl 
                                    ? `${toArabicDigits(booking.remaining_hours.toFixed(1))} ${dictionary?.common?.hoursRemaining || 'ساعة متبقية'}`
                                    : `${booking.remaining_hours.toFixed(1)}h remaining`}
                                </Typography>
                              )}
                            </td>
                            <td className='p-3'>
                              {isActive && booking.finished_at && booking.started_at ? (
                                (() => {
                                  // Calculate total duration from start to finish
                                  const startTime = parseDateTime(booking.started_at)
                                  const endTime = parseDateTime(booking.finished_at)
                                  const totalSeconds = Math.floor((endTime - startTime) / 1000)
                                  
                                  // Calculate elapsed time dynamically using currentTime for real-time updates
                                  const elapsedSeconds = Math.floor((currentTime - startTime) / 1000)
                                  const remainingSeconds = Math.max(0, Math.floor((endTime - currentTime) / 1000))
                                  
                                  // Progress: 0% at start, 100% when time is up
                                  const progress = Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100))
                                  const isCompleted = progress >= 100
                                  const isAlmostDone = progress >= 80 && !isCompleted
                                  const isNearEnd = progress >= 50 && progress < 80
                                  const color = isCompleted ? '#4caf50' : isAlmostDone ? '#ff9800' : '#2196f3'
                                  
                                  if (isCompleted) {
                                    return (
                                      <div className='min-w-[120px]'>
                                        <div className={`flex items-center justify-between mb-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                                          <Typography variant='caption' fontWeight={600} color='success.main'>
                                            {dictionary?.bookings?.completed || 'Done'}
                                          </Typography>
                                          <i className='tabler-check text-sm' style={{ color: '#4caf50' }} />
                                        </div>
                                        <div className='w-full h-2 rounded-full overflow-hidden bg-success/20'>
                                          <div className='h-full rounded-full bg-success' style={{ width: '100%' }} />
                                        </div>
                                        <Typography variant='caption' color='text.secondary' className={`block mt-0.5 ${isRtl ? 'text-right' : ''}`}>
                                          {dictionary?.bookings?.timesUp || "Time's up!"}
                                        </Typography>
                                      </div>
                                    )
                                  }
                                  
                                  return (
                                    <div className='min-w-[120px]'>
                                      <div className={`flex items-center justify-between mb-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                                        <Typography variant='caption' fontWeight={600} style={{ color }}>
                                          {formatTimer(remainingSeconds)} {dictionary?.bookings?.left || 'left'}
                                        </Typography>
                                        <i className={`tabler-clock text-sm ${isAlmostDone ? 'animate-pulse' : ''}`} style={{ color }} />
                                      </div>
                                      <div 
                                        className='w-full h-2 rounded-full overflow-hidden'
                                        style={{ backgroundColor: `${color}20` }}
                                      >
                                        <div
                                          className={`h-full rounded-full transition-all duration-300 ease-linear ${isRtl ? 'ml-auto' : ''}`}
                                          style={{ 
                                            width: `${progress}%`,
                                            backgroundColor: color
                                          }}
                                        />
                                      </div>
                                      <Typography variant='caption' color='text.secondary' className={`block mt-0.5 ${isRtl ? 'text-right' : ''}`}>
                                        {isRtl ? Math.round(progress).toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]) : Math.round(progress)}% {dictionary?.bookings?.elapsed || 'elapsed'}
                                      </Typography>
                                    </div>
                                  )
                                })()
                              ) : (
                                <Typography variant='body2' color='text.secondary'>
                                  {dictionary?.bookings?.openEnded || 'Open'}
                                </Typography>
                              )}
                            </td>
                            <td className='p-3'>
                              {/* Orders linked to this booking */}
                              {booking.orders_count > 0 ? (
                                <div 
                                  className={`flex flex-col gap-1 ${isRtl ? 'items-end' : 'items-start'} cursor-pointer`}
                                  onClick={() => {
                                    setSelectedBookingOrders(booking)
                                    setViewOrdersDialogOpen(true)
                                  }}
                                >
                                  <Chip
                                    icon={<i className='tabler-shopping-cart text-sm' />}
                                    label={`${isRtl ? toArabicDigits(booking.orders_count.toString()) : booking.orders_count} ${dictionary?.navigation?.orders || 'orders'}`}
                                    color='info'
                                    size='small'
                                    variant='outlined'
                                    clickable
                                  />
                                  <Typography variant='caption' color='info.main' fontWeight={500}>
                                    {isRtl ? toArabicDigits(Number(booking.orders_total || 0).toFixed(2)) : Number(booking.orders_total || 0).toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                                  </Typography>
                                </div>
                              ) : (
                                <Typography variant='caption' color='text.secondary'>
                                  {dictionary?.orders?.noOrders || 'No orders'}
                                </Typography>
                              )}
                            </td>
                            <td className='p-3'>
                              <div className='flex flex-col gap-0.5'>
                                <Typography variant='body2' fontWeight={500} color='success.main'>
                                  {isActive
                                    ? `~${isRtl ? toArabicDigits(booking.estimated_price?.toFixed(2) || '0') : booking.estimated_price?.toFixed(2)}`
                                    : (isRtl ? toArabicDigits((booking.price || booking.total_price || 0).toString()) : (booking.price || booking.total_price || 0))} {dictionary?.common?.currency || 'EGP'}
                                </Typography>
                                {Number(booking.orders_total) > 0 && (
                                  <Typography variant='caption' color='text.secondary'>
                                    + {isRtl ? toArabicDigits(Number(booking.orders_total || 0).toFixed(2)) : Number(booking.orders_total || 0).toFixed(2)} {dictionary?.orders?.cafeteriaOrders || 'cafeteria'}
                                  </Typography>
                                )}
                                {(isActive && Number(booking.orders_total) > 0) && (
                                  <Typography variant='caption' fontWeight={600} color='primary.main'>
                                    = {isRtl ? toArabicDigits((Number(booking.estimated_price || 0) + Number(booking.orders_total || 0)).toFixed(2)) : (Number(booking.estimated_price || 0) + Number(booking.orders_total || 0)).toFixed(2)} {dictionary?.common?.total || 'total'}
                                  </Typography>
                                )}
                              </div>
                            </td>
                            <td className='p-3'>
                              {isActive && !isPending && !booking.finished_at && (
                                <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                                  <IconButton
                                    size='small'
                                    color='info'
                                    onClick={() => handleOpenAddOrder(booking as ActiveBooking)}
                                    title={dictionary?.orders?.addOrderToBooking || 'Add Order'}
                                  >
                                    <i className='tabler-shopping-cart-plus' />
                                  </IconButton>
                                  <Button
                                    variant='contained'
                                    color='error'
                                    size='small'
                                    onClick={() => {
                                      setSelectedBooking(booking as ActiveBooking)
                                      setEndBookingDialogOpen(true)
                                    }}
                                  >
                                    {dictionary?.bookings?.endBooking || 'End'}
                                  </Button>
                                </div>
                              )}
                              {isActive && !isPending && booking.finished_at && (
                                <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                                  <IconButton
                                    size='small'
                                    color='info'
                                    onClick={() => handleOpenAddOrder(booking as ActiveBooking)}
                                    title={dictionary?.orders?.addOrderToBooking || 'Add Order'}
                                  >
                                    <i className='tabler-shopping-cart-plus' />
                                  </IconButton>
                                  <Button
                                    variant='contained'
                                    color='error'
                                    size='small'
                                    onClick={() => {
                                      setSelectedBooking(booking as ActiveBooking)
                                      setEndBookingDialogOpen(true)
                                    }}
                                  >
                                    {dictionary?.bookings?.endBooking || 'End'}
                                  </Button>
                                 
                                </div>
                              )}
                              {isPending && (
                                <Chip label={dictionary?.bookings?.notStarted || 'Not Started'} size='small' color='default' />
                              )}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className='text-center py-12'>
                <i className='tabler-calendar-off text-5xl text-textSecondary mb-3' />
                <Typography color='text.secondary'>
                  {statusFilter === 'active'
                    ? dictionary?.rooms?.noActiveBooking || 'No active bookings'
                    : dictionary?.bookings?.noBookingsToday || 'No bookings today'}
                </Typography>
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Last Completed Bookings */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={dictionary?.bookings?.lastCompletedBookings || 'Last Completed Bookings'}
            avatar={<i className='tabler-history text-xl' />}
          />
          <CardContent>
            {(() => {
              const completedBookings = (Array.isArray(bookings) ? bookings : [])
                .filter(b => b.status === 'completed')
                .sort((a, b) => parseServerDateTimeMs(b.finished_at || b.end_time) - parseServerDateTimeMs(a.finished_at || a.end_time))
                .slice(0, 10)
              
              if (completedBookings.length === 0) {
                return (
                  <div className='text-center py-8'>
                    <i className='tabler-calendar-check text-4xl text-textSecondary mb-2' />
                    <Typography color='text.secondary'>
                      {dictionary?.bookings?.noCompletedBookings || 'No completed bookings today'}
                    </Typography>
                  </div>
                )
              }
              
              return (
                <div className='overflow-x-auto'>
                  <table className='w-full' dir={isRtl ? 'rtl' : 'ltr'}>
                    <thead>
                      <tr className='border-b'>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.room || 'Room'}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.customer || 'Customer'}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.startTime || 'Start Time'}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.endTime || 'End Time'}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.duration || 'Duration'}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.navigation?.orders || 'Orders'}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.price || 'Price'}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.common?.actions || 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedBookings.map((booking: any) => {
                        const duration = formatDuration(booking.started_at || booking.start_time, booking.finished_at || booking.end_time)
                        
                        return (
                          <tr key={booking.id} className='border-b last:border-0'>
                            <td className='p-3'>
                              <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                                <i className='tabler-door text-lg text-success' />
                                <Typography variant='body2' fontWeight={500}>
                                  {booking.room_name}
                                </Typography>
                              </div>
                            </td>
                            <td className='p-3'>
                              <Typography variant='body2'>{booking.customer_name}</Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {booking.customer_phone}
                              </Typography>
                            </td>
                            <td className='p-3'>
                              <Typography variant='body2'>
                                {formatLocalTime(booking.started_at || booking.start_time, getLocaleForRtl(isRtl))}
                              </Typography>
                            </td>
                            <td className='p-3'>
                              <Typography variant='body2'>
                                {formatLocalTime(booking.finished_at || booking.end_time, getLocaleForRtl(isRtl))}
                              </Typography>
                            </td>
                            <td className='p-3'>
                              <Chip
                                label={Number(duration) < 1 
                                  ? `${isRtl ? toArabicDigits(Math.round(Number(duration) * 60).toString()) : Math.round(Number(duration) * 60)} ${dictionary?.common?.mins || 'mins'}` 
                                  : `${isRtl ? toArabicDigits(Number(duration).toFixed(1)) : Number(duration).toFixed(1)} ${dictionary?.common?.hours || 'hrs'}`}
                                color='default'
                                variant='outlined'
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
                                <Typography variant='body2' fontWeight={500} color='success.main'>
                                  {isRtl ? toArabicDigits((booking.price || booking.total_price || 0).toString()) : (booking.price || booking.total_price || 0)} {dictionary?.common?.currency || 'EGP'}
                                </Typography>
                                {Number(booking.orders_total) > 0 && (
                                  <Typography variant='caption' fontWeight={500} color='primary.main'>
                                    {dictionary?.common?.total || 'Total'}: {isRtl ? toArabicDigits((Number(booking.price || 0) + Number(booking.orders_total || 0)).toFixed(2)) : (Number(booking.price || 0) + Number(booking.orders_total || 0)).toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                                  </Typography>
                                )}
                              </div>
                            </td>
                            <td className='p-3'>
                              <IconButton
                                size='small'
                                color='primary'
                                onClick={() => printBookingReceipt(booking)}
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
              )
            })()}
          </CardContent>
        </Card>
      </Grid>

      <Dialog open={startBookingDialogOpen} onClose={() => setStartBookingDialogOpen(false)} maxWidth='sm' fullWidth dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogTitle className={isRtl ? 'text-right' : ''}>{dictionary?.bookings?.startBooking || 'Start Booking'}</DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 pt-2'>
            <CustomTextField
              select
              label={dictionary?.bookings?.selectDuration || 'Select Duration'}
              value={newBooking.duration_minutes}
              onChange={e => setNewBooking({ ...newBooking, duration_minutes: Number(e.target.value) })}
              fullWidth
              helperText={dictionary?.bookings?.durationHelperText || 'Select a timer or leave open-ended'}
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
              value={newBooking.room_id}
              onChange={e => setNewBooking({ ...newBooking, room_id: Number(e.target.value) })}
              fullWidth
              required
              helperText={dictionary?.bookings?.onlyAvailableRooms || 'Only currently available rooms'}
            >
              {availableRooms.map(room => (
                <MenuItem key={room.id} value={room.id}>
                  {room.name} - {room.ps} ({isRtl ? toArabicDigits(room.hour_cost.toString()) : room.hour_cost} {dictionary?.common?.currencyPerHour || 'EGP/hr'})
                </MenuItem>
              ))}
            </CustomTextField>

            <Autocomplete
              options={[{ id: -1, name: dictionary?.bookings?.guestCustomer || 'Guest', phone: '0000000000' } as Customer, ...customers]}
              getOptionLabel={(option) => option.id === -1 ? (dictionary?.bookings?.guestCustomer || 'Guest') : `${option.name} - ${option.phone}`}
              value={newBooking.customer_id === -1 
                ? { id: -1, name: dictionary?.bookings?.guestCustomer || 'Guest', phone: '0000000000' } as Customer
                : customers.find(c => c.id === newBooking.customer_id) || { id: -1, name: dictionary?.bookings?.guestCustomer || 'Guest', phone: '0000000000' } as Customer
              }
              onChange={(_, newValue) => setNewBooking({ ...newBooking, customer_id: newValue?.id || -1 })}
              renderInput={(params) => (
                <CustomTextField
                  {...params}
                  label={dictionary?.customers?.selectCustomer || 'Select Customer'}
                  placeholder={dictionary?.common?.search || 'Search by name or phone'}
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <i className={option.id === -1 ? 'tabler-user-question' : 'tabler-user'} />
                    {option.id === -1 ? (dictionary?.bookings?.guestCustomer || 'Guest') : `${option.name} - ${option.phone}`}
                  </div>
                </li>
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              filterOptions={(options, { inputValue }) => {
                const searchTerm = inputValue.toLowerCase()
                return options.filter(
                  (option) =>
                    option.id === -1 ||
                    option.name?.toLowerCase().includes(searchTerm) ||
                    option.phone?.toLowerCase().includes(searchTerm)
                )
              }}
            />
          </div>
        </DialogContent>
        <DialogActions className={isRtl ? 'flex-row-reverse justify-start' : ''}>
          <Button onClick={() => setStartBookingDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            onClick={handleStartBooking}
            disabled={isSubmitting || !newBooking.room_id}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.bookings?.startBooking || 'Start Now'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* End Booking Dialog */}
      <Dialog open={endBookingDialogOpen} onClose={() => setEndBookingDialogOpen(false)} dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogTitle className={isRtl ? 'text-right' : ''}>{dictionary?.bookings?.endBooking || 'End Booking'}</DialogTitle>
        <DialogContent>
          {selectedBooking && (
            <div className='flex flex-col gap-3 pt-2'>
              <Typography>{dictionary?.bookings?.confirmEnd || 'Are you sure you want to end this booking?'}</Typography>
              <Card variant='outlined'>
                <CardContent>
                  <Typography variant='subtitle2' fontWeight={600}>
                    {selectedBooking.room_name}
                  </Typography>
                  <Typography variant='body2'>{selectedBooking.customer_name}</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {(() => {
                      const hrs = selectedBooking.current_duration_hours || selectedBooking.elapsed_hours || 0;
                      const minsVal = Math.round(hrs * 60);
                      const hrsVal = hrs.toFixed(1);
                      return hrs < 1 
                        ? `${isRtl ? toArabicDigits(minsVal.toString()) : minsVal} ${dictionary?.common?.mins || 'mins'}` 
                        : `${isRtl ? toArabicDigits(hrsVal) : hrsVal} ${dictionary?.common?.hours || 'hours'}`;
                    })()}
                  </Typography>
                  <Typography variant='h5' color='success.main' className='mt-2'>
                    ~{isRtl ? toArabicDigits(selectedBooking.estimated_price?.toFixed(2) || '0') : selectedBooking.estimated_price?.toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                  </Typography>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
        <DialogActions className={isRtl ? 'flex-row-reverse justify-start' : ''}>
          <Button onClick={() => setEndBookingDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button variant='contained' color='error' onClick={handleEndBooking} disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.bookings?.endBooking || 'End'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Switch Room Dialog */}
      <Dialog open={switchRoomDialogOpen} onClose={() => setSwitchRoomDialogOpen(false)} maxWidth='sm' fullWidth dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogTitle className={isRtl ? 'text-right' : ''}>{dictionary?.bookings?.switchRoom || 'Switch Room'}</DialogTitle>
        <DialogContent>
          {selectedBooking && (
            <div className='flex flex-col gap-4 pt-2'>
              <Typography>
                {dictionary?.bookings?.switchFromRoom || 'Switching from'}: <strong>{selectedBooking.room_name}</strong>
              </Typography>
              <CustomTextField
                select
                label={dictionary?.bookings?.selectNewRoom || 'Select New Room'}
                value={newRoomId}
                onChange={e => setNewRoomId(Number(e.target.value))}
                fullWidth
                required
              >
                {availableRooms.map(room => (
                  <MenuItem key={room.id} value={room.id}>
                    {room.name} - {room.ps} ({isRtl ? toArabicDigits(room.hour_cost.toString()) : room.hour_cost} {dictionary?.common?.currencyPerHour || 'EGP/hr'})
                  </MenuItem>
                ))}
              </CustomTextField>
            </div>
          )}
        </DialogContent>
        <DialogActions className={isRtl ? 'flex-row-reverse justify-start' : ''}>
          <Button onClick={() => setSwitchRoomDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            onClick={handleSwitchRoom}
            disabled={isSubmitting || !newRoomId}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.bookings?.switchRoom || 'Switch'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Order to Booking Dialog */}
      <Dialog open={addOrderDialogOpen} onClose={() => setAddOrderDialogOpen(false)} maxWidth='md' fullWidth dir={isRtl ? 'rtl' : 'ltr'}>
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
                <Tabs value={orderTab} onChange={(_, v) => setOrderTab(v)}>
                  <Tab label={dictionary?.orders?.selectItems || 'Select Items'} />
                  <Tab label={`${dictionary?.orders?.orderItems || 'Order'} (${orderItems.length})`} />
                </Tabs>

                <Box className='mt-4'>
                  {orderTab === 0 && (
                    <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto'>
                      {availableItems.length > 0 ? (
                        availableItems.map(item => (
                          <Card
                            key={item.id}
                            variant='outlined'
                            className='cursor-pointer hover:border-primary transition-colors'
                            onClick={() => addItemToOrder(item)}
                          >
                            <CardContent className='p-3'>
                              <Typography variant='body2' fontWeight={500} noWrap>
                                {item.name}
                              </Typography>
                              <div className={`flex justify-between items-center mt-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                                <Typography variant='caption' color='success.main'>
                                  {isRtl ? toArabicDigits(String(item.price)) : item.price} {dictionary?.common?.currency || 'EGP'}
                                </Typography>
                                <Typography variant='caption' color='text.secondary'>
                                  {isRtl ? toArabicDigits(String(item.stock)) : item.stock} {dictionary?.common?.inStock || 'left'}
                                </Typography>
                              </div>
                            </CardContent>
                          </Card>
                        ))
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

                  {orderTab === 1 && (
                    <div>
                      {orderItems.length > 0 ? (
                        <div className='flex flex-col gap-3'>
                          {orderItems.map(item => (
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
                                  onClick={() => updateItemQuantity(item.item_id, item.quantity - 1)}
                                >
                                  <i className='tabler-minus text-sm' />
                                </IconButton>
                                <Typography variant='body2' className='w-8 text-center'>
                                  {isRtl ? toArabicDigits(String(item.quantity)) : item.quantity}
                                </Typography>
                                <IconButton
                                  size='small'
                                  onClick={() => updateItemQuantity(item.item_id, item.quantity + 1)}
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
                              {isRtl ? toArabicDigits(orderTotal.toFixed(2)) : orderTotal.toFixed(2)} {dictionary?.common?.currency || 'EGP'}
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
          <Button onClick={() => setAddOrderDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            startIcon={<i className='tabler-shopping-cart-check' />}
            onClick={handleCreateBookingOrder}
            disabled={isSubmitting || orderItems.length === 0}
          >
            {isSubmitting ? (
              <CircularProgress size={20} />
            ) : (
              `${dictionary?.orders?.createOrder || 'Create Order'} (${isRtl ? toArabicDigits(orderTotal.toFixed(2)) : orderTotal.toFixed(2)} ${dictionary?.common?.currency || 'EGP'})`
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
            </div>
          )}
        </DialogContent>
        <DialogActions className={isRtl ? 'flex-row-reverse justify-start' : ''}>
          <Button onClick={() => setViewOrdersDialogOpen(false)}>
            {dictionary?.common?.close || 'Close'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default BookingsList
